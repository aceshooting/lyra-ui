import type { LyraAnchor } from '../components/viewers/document-viewer/anchors.js';
import { TEXT_QUOTE_CONTEXT_CHARS } from '../components/viewers/document-viewer/anchors.js';

const SOFT_HYPHEN = '­';
// ECMAScript's `\s` already covers every Unicode Space_Separator code point plus NBSP and
// ZWNBSP (see the WhiteSpace production in the spec), so it needs no custom character class --
// an earlier hand-written range here (meant to add NBSP/wide Unicode spaces) had corrupted,
// redundant endpoints that CodeQL flagged as an overly permissive range overlapping `\s`.
const WHITESPACE_CHAR_RE = /\s/u;

/** NFC-normalizes, strips soft hyphens, collapses every whitespace run to one ASCII space, and
 *  trims. The single normalization used for a whole standalone string -- an anchor's `quote`/
 *  `prefix`/`suffix`, or a fully-selected Range's text. Building a scope's own per-node corpus uses
 *  a related, non-trimming variant internally (see `normalizeSegment`) so inter-node spacing survives. */
export function normalizeQuoteText(s: string): string {
  return collapseWhitespaceAndSoftHyphen(s).trim();
}

function collapseWhitespaceAndSoftHyphen(s: string): string {
  let out = '';
  let lastWasSpace = false;
  for (const ch of s) {
    if (ch === SOFT_HYPHEN) continue;
    if (WHITESPACE_CHAR_RE.test(ch)) {
      if (lastWasSpace) continue;
      lastWasSpace = true;
      out += ' ';
    } else {
      lastWasSpace = false;
      out += ch;
    }
  }
  return out;
}

/** One DOM text node's contribution to a `TextQuoteScope`: its normalized text starts at
 *  `normalizedStart` in the scope's full `text`, and `rawOffsets[i]` is the raw index into
 *  `node.data` that produced the i-th character of this segment's normalized text. */
export interface TextQuoteSegment {
  node: Text;
  normalizedStart: number;
  rawOffsets: number[];
}

/** A searchable corpus (`text`) with an offset map (`segments`) back to real DOM positions. */
export interface TextQuoteScope {
  text: string;
  segments: TextQuoteSegment[];
}

/** Normalizes `raw` (NOT trimmed -- trimming per-node would eat meaningful inter-node spacing, e.g.
 *  the single space between `</em>` and following text living in its own text node) and returns both
 *  the normalized text and a same-length array mapping each output character back to its raw index.
 *  NFC-composes first, but only keeps the composed form when it doesn't change the character count
 *  for this node -- the overwhelmingly common case, since browsers already store most DOM text
 *  precomposed. A rare node whose content is genuinely decomposed (composition changes length) keeps
 *  its original codepoints for offset-mapping purposes rather than needing full per-codepoint
 *  composition tracking, which isn't worth building for that narrow case. */
function normalizeSegment(raw: string): { text: string; rawOffsets: number[] } {
  const nfc = raw.normalize('NFC');
  const base = nfc.length === raw.length ? nfc : raw;
  const chars: string[] = [];
  const rawOffsets: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < base.length; i++) {
    const ch = base[i]!; // safe: i < base.length
    if (ch === SOFT_HYPHEN) continue;
    if (WHITESPACE_CHAR_RE.test(ch)) {
      if (lastWasSpace) continue;
      lastWasSpace = true;
      chars.push(' ');
      rawOffsets.push(i);
    } else {
      lastWasSpace = false;
      chars.push(ch);
      rawOffsets.push(i);
    }
  }
  return { text: chars.join(''), rawOffsets };
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

/** Builds a scope by walking `root`'s text nodes in document order (skipping
 *  script/style/template/noscript), concatenating each node's normalized text. Callers pass their
 *  *content* element (e.g. markdown's `[part="content"]`) so toolbar chrome never enters the corpus. */
export function scopeFromElement(root: Element): TextQuoteScope {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const parent = node.parentElement;
      if (parent && SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const segments: TextQuoteSegment[] = [];
  let text = '';
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const { text: segText, rawOffsets } = normalizeSegment(textNode.data);
    if (segText.length === 0) continue;
    segments.push({ node: textNode, normalizedStart: text.length, rawOffsets });
    text += segText;
  }
  return { text, segments };
}

function firstTextNode(element: Element): Text | null {
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) return child as Text;
  }
  return null;
}

/** Builds a scope from an ordered list of `{ text, element }` items -- pdf.js text-layer spans
 *  joined in reading order. Normalizes each item's own `text` (the authoritative content) and maps
 *  offsets into `element`'s first text node, which is expected to hold that same text verbatim (true
 *  for pdf.js's `TextLayer`, whose sole text child of each span IS that item's text). An item whose
 *  element has no text node is skipped -- it can't be resolved to a `Range` either way. */
export function scopeFromItems(items: { text: string; element: Element }[]): TextQuoteScope {
  const segments: TextQuoteSegment[] = [];
  let text = '';
  for (const item of items) {
    const node = firstTextNode(item.element);
    if (!node) continue;
    const { text: segText, rawOffsets } = normalizeSegment(item.text);
    if (segText.length === 0) continue;
    if (text.length > 0) text += ' ';
    segments.push({ node, normalizedStart: text.length, rawOffsets });
    text += segText;
  }
  return { text, segments };
}

function findAllOccurrences(haystack: string, needle: string, caseInsensitive: boolean): number[] {
  const h = caseInsensitive ? haystack.toLowerCase() : haystack;
  const n = caseInsensitive ? needle.toLowerCase() : needle;
  const positions: number[] = [];
  let from = 0;
  for (;;) {
    const index = h.indexOf(n, from);
    if (index === -1) break;
    positions.push(index);
    from = index + 1;
  }
  return positions;
}

/** Binary-searches `scope.segments` (sorted by `normalizedStart`) for the segment containing
 *  `normalizedOffset`, then maps it to a `(node, rawOffset)` DOM position via that segment's
 *  `rawOffsets` table. */
function locate(scope: TextQuoteScope, normalizedOffset: number): { node: Text; offset: number } | null {
  let lo = 0;
  let hi = scope.segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1; // safe below: lo <= mid <= hi keeps segments[mid] in bounds
    if (scope.segments[mid]!.normalizedStart <= normalizedOffset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found === -1) return null;
  const segment = scope.segments[found]!; // safe: found is an in-bounds index (set from mid, != -1)
  const local = normalizedOffset - segment.normalizedStart;
  if (local >= segment.rawOffsets.length) {
    // The offset lands exactly at (or past) this segment's own end -- resolve to one past its last
    // mapped raw character rather than stepping into the next segment (any offset strictly inside
    // the next segment is found directly via its own `normalizedStart` instead).
    const lastRaw = segment.rawOffsets[segment.rawOffsets.length - 1] ?? 0;
    return { node: segment.node, offset: Math.min(segment.node.data.length, lastRaw + 1) };
  }
  return { node: segment.node, offset: segment.rawOffsets[local]! }; // safe: local < rawOffsets.length checked above
}

function rangeFromOffsets(scope: TextQuoteScope, start: number, end: number): Range | null {
  const startPos = locate(scope, start);
  const endPos = locate(scope, Math.max(start, end - 1)); // last included character
  if (!startPos || !endPos) return null;
  const range = startPos.node.ownerDocument!.createRange();
  range.setStart(startPos.node, startPos.offset);
  const endOffset = Math.min(endPos.node.data.length, endPos.offset + 1);
  range.setEnd(endPos.node, endOffset);
  return range;
}

/** Resolves a `{ quote, prefix?, suffix? }` anchor against `scope`: normalizes the quote, finds every
 *  case-sensitive occurrence (falling back to one case-insensitive pass if there are none), scores
 *  each candidate by whether the normalized `prefix`/`suffix` match immediately around it, and
 *  returns a DOM `Range` for the highest-scoring (earliest-position tiebreak) candidate. `null` when
 *  the quote isn't found at all. No fuzzy matching. */
export function resolveTextQuote(
  scope: TextQuoteScope,
  anchor: { quote: string; prefix?: string; suffix?: string },
): Range | null {
  const quote = normalizeQuoteText(anchor.quote);
  if (!quote) return null;
  const prefix = anchor.prefix ? normalizeQuoteText(anchor.prefix) : undefined;
  const suffix = anchor.suffix ? normalizeQuoteText(anchor.suffix) : undefined;

  let candidates = findAllOccurrences(scope.text, quote, false);
  if (candidates.length === 0) candidates = findAllOccurrences(scope.text, quote, true);
  if (candidates.length === 0) return null;

  let best = candidates[0]!; // safe: candidates.length > 0 checked above
  let bestScore = -1;
  for (const start of candidates) {
    let score = 0;
    if (prefix) {
      const before = scope.text.slice(Math.max(0, start - prefix.length), start);
      if (before.toLowerCase() === prefix.toLowerCase()) score += 1;
    }
    if (suffix) {
      const end = start + quote.length;
      const after = scope.text.slice(end, end + suffix.length);
      if (after.toLowerCase() === suffix.toLowerCase()) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = start;
    }
  }

  return rangeFromOffsets(scope, best, best + quote.length);
}

/** Returns every DOM range matching a normalized text query, in document order. Used by
 * text-oriented viewers to implement search navigation without losing the normalized-to-DOM
 * offset mapping that text-quote anchors already use. */
export function findTextQuoteRanges(scope: TextQuoteScope, query: string): Range[] {
  const needle = normalizeQuoteText(query);
  if (!needle) return [];
  const haystack = scope.text.toLocaleLowerCase();
  const normalizedNeedle = needle.toLocaleLowerCase();
  const ranges: Range[] = [];
  for (let from = 0; ; ) {
    const index = haystack.indexOf(normalizedNeedle, from);
    if (index < 0) break;
    const range = rangeFromOffsets(scope, index, index + needle.length);
    if (range) ranges.push(range);
    from = index + 1;
  }
  return ranges;
}

/** Finds the first Text node descendant of `node` in document order, e.g. to resolve a boundary
 *  point whose container is an Element (a Range from `selectNodeContents()` reports its container as
 *  the element itself, not the text node it contains). */
function firstTextNodeDeep(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  for (const child of Array.from(node.childNodes)) {
    const found = firstTextNodeDeep(child);
    if (found) return found;
  }
  return null;
}

/** Resolves a DOM boundary point `(container, offset)` to a concrete `(Text node, offset)` pair.
 *  `container` is already a Text node for a Selection-derived Range, but a Range built via
 *  `selectNodeContents(element)` reports the element itself with `offset` as a child index, so that
 *  case is resolved to the first text descendant of the child at that index. */
function resolveBoundaryTextNode(container: Node, offset: number): { node: Text; offset: number } | null {
  if (container.nodeType === Node.TEXT_NODE) return { node: container as Text, offset };
  const child = container.childNodes[offset];
  if (!child) return null;
  const node = firstTextNodeDeep(child);
  return node ? { node, offset: 0 } : null;
}

function findRangeStartInScope(scope: TextQuoteScope, range: Range): number | null {
  const boundary = resolveBoundaryTextNode(range.startContainer, range.startOffset);
  if (!boundary) return null;
  const segment = scope.segments.find((s) => s.node === boundary.node);
  if (!segment) return null;
  const rawIndex = segment.rawOffsets.findIndex((raw) => raw >= boundary.offset);
  const local = rawIndex === -1 ? segment.rawOffsets.length : rawIndex;
  return segment.normalizedStart + local;
}

/** Finds the last Text node descendant of `node` in document order (the mirror of
 *  `firstTextNodeDeep`), used to resolve an end boundary whose container is an element. */
function lastTextNodeDeep(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  const children = node.childNodes;
  for (let i = children.length - 1; i >= 0; i--) {
    const found = lastTextNodeDeep(children[i]!); // safe: 0 <= i < children.length
    if (found) return found;
  }
  return null;
}

/** Resolves a DOM *end* boundary point `(container, offset)` to a concrete `(Text node, offset)`
 *  pair. Mirrors `resolveBoundaryTextNode`: an end container that's already a Text node is used
 *  directly, but a Range built via `selectNodeContents(element)` reports its end as the element
 *  with `offset` one past the last included child index, so that case resolves to the full length
 *  of the last text descendant of the child immediately before that index. */
function resolveEndBoundaryTextNode(container: Node, offset: number): { node: Text; offset: number } | null {
  if (container.nodeType === Node.TEXT_NODE) return { node: container as Text, offset };
  const child = container.childNodes[offset - 1];
  if (!child) return null;
  const node = lastTextNodeDeep(child);
  return node ? { node, offset: node.data.length } : null;
}

/** Same mapping as `findRangeStartInScope`, but for a range's end boundary: returns the exclusive
 *  normalized offset one past the range's last included character. */
function findRangeEndInScope(scope: TextQuoteScope, range: Range): number | null {
  const boundary = resolveEndBoundaryTextNode(range.endContainer, range.endOffset);
  if (!boundary) return null;
  const segment = scope.segments.find((s) => s.node === boundary.node);
  if (!segment) return null;
  let local = 0;
  while (local < segment.rawOffsets.length && segment.rawOffsets[local]! < boundary.offset) local++; // safe: index guarded by the length check in the same condition
  return segment.normalizedStart + local;
}

/** Builds a `text-quote` `LyraAnchor` from a live selection `Range`, capturing
 *  `TEXT_QUOTE_CONTEXT_CHARS` of normalized context before/after as `prefix`/`suffix`. The quote
 *  itself is read back out of `scope.text` (via the range's start/end mapped into scope offsets)
 *  rather than `range.toString()` -- a range spanning multiple sibling elements with no DOM
 *  whitespace between them (e.g. one `<span>` per pdf.js text-layer word) stringifies with no
 *  inter-word spaces, which `scope.text`'s own synthesized word-joining space already accounts for.
 *  Falls back to `normalizeQuoteText(range.toString())` when the range's boundaries can't be mapped
 *  into `scope` at all (e.g. a selection outside the scoped content). Per-format `page` enrichment
 *  is the caller's job (e.g. pdf-viewer sets `page` from the page containing the range start). */
export function buildQuoteAnchor(range: Range, scope: TextQuoteScope): LyraAnchor {
  const startOffset = findRangeStartInScope(scope, range);
  const endOffset = findRangeEndInScope(scope, range);
  const quote =
    startOffset != null && endOffset != null && endOffset > startOffset
      ? scope.text.slice(startOffset, endOffset)
      : normalizeQuoteText(range.toString());
  let prefix: string | undefined;
  let suffix: string | undefined;
  if (startOffset != null) {
    const before = scope.text.slice(Math.max(0, startOffset - TEXT_QUOTE_CONTEXT_CHARS), startOffset).trim();
    prefix = before || undefined;
  }
  if (endOffset != null) {
    const after = scope.text.slice(endOffset, endOffset + TEXT_QUOTE_CONTEXT_CHARS).trim();
    suffix = after || undefined;
  }
  return {
    kind: 'text-quote',
    quote,
    ...(prefix ? { prefix } : {}),
    ...(suffix ? { suffix } : {}),
  };
}
