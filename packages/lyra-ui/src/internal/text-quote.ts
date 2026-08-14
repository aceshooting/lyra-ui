import type { LyraAnchor } from '../components/viewers/document-viewer/anchors.js';
import { TEXT_QUOTE_CONTEXT_CHARS } from '../components/viewers/document-viewer/anchors.js';
import { getSegmenter, resolveIntlLocale } from './intl-cache.js';

const SOFT_HYPHEN = '­';
// ECMAScript's `\s` already covers every Unicode Space_Separator code point plus NBSP and
// ZWNBSP (see the WhiteSpace production in the spec), so it needs no custom character class --
// an earlier hand-written range here (meant to add NBSP/wide Unicode spaces) had corrupted,
// redundant endpoints that CodeQL flagged as an overly permissive range overlapping `\s`.
const WHITESPACE_CHAR_RE = /\s/u;

export interface TextQuoteLimits {
  /** Maximum UTF-16 code units retained in one normalized searchable corpus. */
  maxCorpusCodeUnits: number;
  /** Maximum text nodes/items visited while building one corpus. */
  maxNodes: number;
  /** Maximum UTF-16 code units inspected from any single text node/item. */
  maxNodeCodeUnits: number;
  /** Maximum source UTF-16 code units inspected while normalizing one corpus. */
  maxNormalizationWorkCodeUnits: number;
  /** Maximum UTF-16 code units accepted in one query/quote/context string. */
  maxQueryCodeUnits: number;
  /** Maximum occurrence offsets retained for one query. */
  maxMatches: number;
  /** Maximum corpus code units folded/scanned in one logical search or paint pass. */
  maxSearchWorkCodeUnits: number;
  /** Maximum distinct occurrence lists cached by one content/locale index. */
  maxCacheEntries: number;
}

/** Resource ceilings shared by text-quote anchors and DOM-text viewer search. Counts are UTF-16
 * code units because DOM Range offsets and String#indexOf use that coordinate space. */
export const TEXT_QUOTE_LIMITS: Readonly<TextQuoteLimits> = Object.freeze({
  maxCorpusCodeUnits: 1_000_000,
  maxNodes: 20_000,
  maxNodeCodeUnits: 1_000_000,
  maxNormalizationWorkCodeUnits: 2_000_000,
  maxQueryCodeUnits: 4_096,
  maxMatches: 10_000,
  maxSearchWorkCodeUnits: 4_000_000,
  maxCacheEntries: 64,
});

function resolvedLimits(overrides?: Partial<TextQuoteLimits>): TextQuoteLimits {
  const positiveInteger = (value: number | undefined, fallback: number): number =>
    Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : fallback;
  return {
    maxCorpusCodeUnits: positiveInteger(overrides?.maxCorpusCodeUnits, TEXT_QUOTE_LIMITS.maxCorpusCodeUnits),
    maxNodes: positiveInteger(overrides?.maxNodes, TEXT_QUOTE_LIMITS.maxNodes),
    maxNodeCodeUnits: positiveInteger(overrides?.maxNodeCodeUnits, TEXT_QUOTE_LIMITS.maxNodeCodeUnits),
    maxNormalizationWorkCodeUnits: positiveInteger(
      overrides?.maxNormalizationWorkCodeUnits,
      TEXT_QUOTE_LIMITS.maxNormalizationWorkCodeUnits,
    ),
    maxQueryCodeUnits: positiveInteger(overrides?.maxQueryCodeUnits, TEXT_QUOTE_LIMITS.maxQueryCodeUnits),
    maxMatches: positiveInteger(overrides?.maxMatches, TEXT_QUOTE_LIMITS.maxMatches),
    maxSearchWorkCodeUnits: positiveInteger(
      overrides?.maxSearchWorkCodeUnits,
      TEXT_QUOTE_LIMITS.maxSearchWorkCodeUnits,
    ),
    maxCacheEntries: positiveInteger(overrides?.maxCacheEntries, TEXT_QUOTE_LIMITS.maxCacheEntries),
  };
}

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

/** One DOM text node's contribution to a `TextQuoteScope`. `rawOffsetRuns` stores sparse pairs of
 *  `[normalizedOffset, rawOffset]` only where the otherwise-identity mapping changes (collapsed
 *  whitespace or removed soft hyphens). Ordinary text therefore retains no per-character map. */
export interface TextQuoteSegment {
  node: Text;
  normalizedStart: number;
  normalizedLength: number;
  rawOffsetRuns: Uint32Array;
}

/** A bounded searchable corpus with a sparse offset map back to DOM positions. `truncated=true`
 * means later source content was not indexed, so a retained match count is only a lower bound. */
export interface TextQuoteScope {
  text: string;
  segments: TextQuoteSegment[];
  truncated: boolean;
}

/** Normalizes `raw` (NOT trimmed -- trimming per-node would eat meaningful inter-node spacing, e.g.
 *  the single space between `</em>` and following text living in its own text node) and returns both
 *  the normalized text and a same-length array mapping each output character back to its raw index.
 *  NFC-composes first, but only keeps the composed form when it doesn't change the character count
 *  for this node -- the overwhelmingly common case, since browsers already store most DOM text
 *  precomposed. A rare node whose content is genuinely decomposed (composition changes length) keeps
 *  its original codepoints for offset-mapping purposes rather than needing full per-codepoint
 *  composition tracking, which isn't worth building for that narrow case. */
function normalizeSegment(
  raw: string,
  maxOutputCodeUnits: number,
  maxWorkCodeUnits: number,
): { text: string; rawOffsetRuns: Uint32Array; workCodeUnits: number; truncated: boolean } {
  const inspectedLength = Math.min(raw.length, maxWorkCodeUnits);
  const inspected = raw.slice(0, inspectedLength);
  const nfc = inspected.normalize('NFC');
  const base = nfc.length === inspected.length ? nfc : inspected;
  const chunks: string[] = [];
  let chunk = '';
  let normalizedLength = 0;
  const rawOffsetRuns: number[] = [];
  let currentDelta = 0;
  let lastWasSpace = false;
  for (let i = 0; i < base.length; i++) {
    const ch = base[i]!; // safe: i < base.length
    if (ch === SOFT_HYPHEN) continue;
    if (WHITESPACE_CHAR_RE.test(ch)) {
      if (lastWasSpace) continue;
      lastWasSpace = true;
      if (normalizedLength >= maxOutputCodeUnits) {
        return {
          text: chunks.join('') + chunk,
          rawOffsetRuns: Uint32Array.from(rawOffsetRuns),
          workCodeUnits: inspectedLength,
          truncated: true,
        };
      }
      const delta = i - normalizedLength;
      if (delta !== currentDelta) {
        rawOffsetRuns.push(normalizedLength, i);
        currentDelta = delta;
      }
      chunk += ' ';
      normalizedLength++;
    } else {
      lastWasSpace = false;
      if (normalizedLength >= maxOutputCodeUnits) {
        return {
          text: chunks.join('') + chunk,
          rawOffsetRuns: Uint32Array.from(rawOffsetRuns),
          workCodeUnits: inspectedLength,
          truncated: true,
        };
      }
      const delta = i - normalizedLength;
      if (delta !== currentDelta) {
        rawOffsetRuns.push(normalizedLength, i);
        currentDelta = delta;
      }
      chunk += ch;
      normalizedLength++;
    }
    if (chunk.length >= 4_096) {
      chunks.push(chunk);
      chunk = '';
    }
  }
  return {
    text: chunks.join('') + chunk,
    rawOffsetRuns: Uint32Array.from(rawOffsetRuns),
    workCodeUnits: inspectedLength,
    truncated: inspectedLength < raw.length,
  };
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

/** Builds a scope by walking `root`'s text nodes in document order (skipping
 *  script/style/template/noscript), concatenating each node's normalized text. Callers pass their
 *  *content* element (e.g. markdown's `[part="content"]`) so toolbar chrome never enters the corpus. */
export function scopeFromElement(
  root: Element,
  limitOverrides?: Partial<TextQuoteLimits>,
): TextQuoteScope {
  const limits = resolvedLimits(limitOverrides);
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const parent = node.parentElement;
      if (parent && SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const segments: TextQuoteSegment[] = [];
  const textChunks: string[] = [];
  let textLength = 0;
  let nodesVisited = 0;
  let workCodeUnits = 0;
  let truncated = false;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (nodesVisited >= limits.maxNodes) {
      truncated = true;
      break;
    }
    nodesVisited++;
    const textNode = node as Text;
    const workRemaining = Math.max(0, limits.maxNormalizationWorkCodeUnits - workCodeUnits);
    if (workRemaining === 0) {
      truncated = true;
      break;
    }
    const nodeWork = Math.min(limits.maxNodeCodeUnits, workRemaining);
    const { text: segText, rawOffsetRuns, workCodeUnits: used, truncated: segmentTruncated } =
      normalizeSegment(
        textNode.data,
        Math.max(0, limits.maxCorpusCodeUnits - textLength),
        nodeWork,
      );
    workCodeUnits += used;
    if (segText.length === 0) {
      if (segmentTruncated) {
        truncated = true;
        break;
      }
      continue;
    }
    segments.push({
      node: textNode,
      normalizedStart: textLength,
      normalizedLength: segText.length,
      rawOffsetRuns,
    });
    textChunks.push(segText);
    textLength += segText.length;
    if (segmentTruncated) {
      truncated = true;
      break;
    }
    if (textLength === limits.maxCorpusCodeUnits) {
      truncated = walker.nextNode() !== null;
      break;
    }
  }
  return { text: textChunks.join(''), segments, truncated };
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
export function scopeFromItems(
  items: { text: string; element: Element }[],
  limitOverrides?: Partial<TextQuoteLimits>,
): TextQuoteScope {
  const limits = resolvedLimits(limitOverrides);
  const segments: TextQuoteSegment[] = [];
  const textChunks: string[] = [];
  let textLength = 0;
  let workCodeUnits = 0;
  let truncated = false;
  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    if (itemIndex >= limits.maxNodes) {
      truncated = true;
      break;
    }
    const item = items[itemIndex]!;
    const node = firstTextNode(item.element);
    if (!node) continue;
    const joinLength = textLength > 0 ? 1 : 0;
    const workRemaining = Math.max(0, limits.maxNormalizationWorkCodeUnits - workCodeUnits);
    if (workRemaining === 0) {
      truncated = true;
      break;
    }
    const { text: segText, rawOffsetRuns, workCodeUnits: used, truncated: segmentTruncated } =
      normalizeSegment(
        item.text,
        Math.max(0, limits.maxCorpusCodeUnits - textLength - joinLength),
        Math.min(limits.maxNodeCodeUnits, workRemaining),
      );
    workCodeUnits += used;
    if (segText.length === 0) {
      if (segmentTruncated) {
        truncated = true;
        break;
      }
      continue;
    }
    if (joinLength) {
      textChunks.push(' ');
      textLength++;
    }
    segments.push({
      node,
      normalizedStart: textLength,
      normalizedLength: segText.length,
      rawOffsetRuns,
    });
    textChunks.push(segText);
    textLength += segText.length;
    if (segmentTruncated) {
      truncated = true;
      break;
    }
    if (textLength === limits.maxCorpusCodeUnits) {
      truncated = itemIndex + 1 < items.length;
      break;
    }
  }
  return { text: textChunks.join(''), segments, truncated };
}

interface FoldedText {
  text: string;
  expansions: CaseExpansion[];
}

interface CaseExpansion {
  rawStart: number;
  rawEnd: number;
  foldedStart: number;
  foldedEnd: number;
}

function caseFold(value: string, locale?: string): string {
  let lowered: string;
  if (!locale) {
    lowered = value.toLowerCase();
  } else {
    lowered = value.toLocaleLowerCase(resolveIntlLocale(locale));
  }
  // Locale lower-casing preserves an already-lowercase final sigma (`ς`) while a standalone
  // uppercase/medial sigma query becomes `σ`. Unicode caseless matching treats both as equivalent.
  return lowered.replaceAll('ς', 'σ');
}

interface CaseMappingSegment {
  text: string;
  rawStart: number;
  rawEnd: number;
}

function segmenterFor(locale?: string): Intl.Segmenter {
  try {
    return getSegmenter(locale, { granularity: 'grapheme' });
  } catch (error) {
    if (error instanceof RangeError) {
      return getSegmenter(undefined, { granularity: 'grapheme' });
    }
    throw error;
  }
}

function* caseMappingSegments(value: string, locale?: string): Generator<CaseMappingSegment> {
  if (typeof Intl.Segmenter === 'function') {
    for (const { segment, index } of segmenterFor(locale).segment(value)) {
      yield {
        text: segment,
        rawStart: index,
        rawEnd: index + segment.length,
      };
    }
    return;
  }

  let rawStart = 0;
  for (const text of value) {
    yield { text, rawStart, rawEnd: rawStart + text.length };
    rawStart += text.length;
  }
}

/** Locale-folds the complete string so contextual Unicode casing is preserved, while retaining a
 * sparse map only for graphemes whose UTF-16 length expands or contracts. Same-length documents
 * need no Segmenter and no per-character offset arrays; the sparse expansion map keeps values such
 * as English `İ` and Lithuanian accent-sensitive `I` aligned with DOM offsets. */
function foldText(value: string, locale?: string): FoldedText {
  const text = caseFold(value, locale);
  if (text.length === value.length) return { text, expansions: [] };

  let isolatedTotal = 0;
  for (const segment of caseMappingSegments(value, locale)) {
    isolatedTotal += caseFold(segment.text, locale).length;
  }

  const expansions: CaseExpansion[] = [];
  let foldedStart = 0;
  for (const segment of caseMappingSegments(value, locale)) {
    const foldedEnd = segment.rawEnd === value.length
      ? text.length
      : isolatedTotal === text.length
        ? foldedStart + caseFold(segment.text, locale).length
        : caseFold(value.slice(0, segment.rawEnd), locale).length;
    if (foldedEnd - foldedStart !== segment.rawEnd - segment.rawStart) {
      expansions.push({
        rawStart: segment.rawStart,
        rawEnd: segment.rawEnd,
        foldedStart,
        foldedEnd,
      });
    }
    foldedStart = foldedEnd;
  }
  return { text, expansions };
}

function rawStartForFoldedOffset(folded: FoldedText, foldedOffset: number): number {
  let adjustment = 0;
  for (const expansion of folded.expansions) {
    if (foldedOffset < expansion.foldedStart) break;
    if (foldedOffset < expansion.foldedEnd) return expansion.rawStart;
    adjustment +=
      (expansion.foldedEnd - expansion.foldedStart) -
      (expansion.rawEnd - expansion.rawStart);
  }
  return foldedOffset - adjustment;
}

function rawEndForFoldedOffset(folded: FoldedText, foldedOffset: number): number {
  let adjustment = 0;
  for (const expansion of folded.expansions) {
    if (foldedOffset <= expansion.foldedStart) break;
    if (foldedOffset <= expansion.foldedEnd) return expansion.rawEnd;
    adjustment +=
      (expansion.foldedEnd - expansion.foldedStart) -
      (expansion.rawEnd - expansion.rawStart);
  }
  return foldedOffset - adjustment;
}

export interface TextQuoteMatch {
  start: number;
  end: number;
}

/** Compact occurrence collection. Match boundaries are retained as packed Uint32 pairs and only
 * materialized as short-lived objects when a caller asks for/iterates a particular match. */
export interface TextQuoteMatches extends Iterable<TextQuoteMatch> {
  readonly packedOffsets: Uint32Array;
  readonly length: number;
  /** `false` means `length` is a known lower bound because a corpus/match/query/work ceiling hit. */
  readonly matchCountExact: boolean;
  /** Whether the retained corpus was scanned to its end (separate from scope truncation). */
  readonly scanComplete: boolean;
  at(index: number): TextQuoteMatch | undefined;
}

class PackedTextQuoteMatches implements TextQuoteMatches {
  constructor(
    readonly packedOffsets: Uint32Array,
    readonly matchCountExact: boolean,
    readonly scanComplete: boolean,
  ) {}

  get length(): number {
    return this.packedOffsets.length >> 1;
  }

  at(index: number): TextQuoteMatch | undefined {
    if (!Number.isInteger(index) || index < 0 || index >= this.length) return undefined;
    return {
      start: this.packedOffsets[index * 2]!,
      end: this.packedOffsets[index * 2 + 1]!,
    };
  }

  *[Symbol.iterator](): Iterator<TextQuoteMatch> {
    for (let index = 0; index < this.length; index++) yield this.at(index)!;
  }
}

function emptyMatches(matchCountExact: boolean, scanComplete = matchCountExact): TextQuoteMatches {
  return new PackedTextQuoteMatches(new Uint32Array(), matchCountExact, scanComplete);
}

function scanOccurrences(
  haystack: string,
  needle: string,
  foldedHaystack: FoldedText | undefined,
  maxMatches: number,
  scopeTruncated: boolean,
): TextQuoteMatches {
  const packed = new Uint32Array(maxMatches * 2);
  let count = 0;
  let scanComplete = true;
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) break;
    if (count >= maxMatches) {
      scanComplete = false;
      break;
    }
    if (foldedHaystack) {
      packed[count * 2] = rawStartForFoldedOffset(foldedHaystack, index);
      packed[count * 2 + 1] = rawEndForFoldedOffset(foldedHaystack, index + needle.length);
    } else {
      packed[count * 2] = index;
      packed[count * 2 + 1] = index + needle.length;
    }
    count++;
    from = index + 1;
  }
  return new PackedTextQuoteMatches(
    packed.slice(0, count * 2),
    scanComplete && !scopeTruncated,
    scanComplete,
  );
}

function foldedStartForRawOffset(folded: FoldedText, rawOffset: number): number {
  let adjustment = 0;
  for (const expansion of folded.expansions) {
    if (rawOffset < expansion.rawStart) break;
    if (rawOffset < expansion.rawEnd) return expansion.foldedStart;
    adjustment +=
      (expansion.foldedEnd - expansion.foldedStart) -
      (expansion.rawEnd - expansion.rawStart);
  }
  return rawOffset + adjustment;
}

function foldedEndForRawOffset(folded: FoldedText, rawOffset: number): number {
  let adjustment = 0;
  for (const expansion of folded.expansions) {
    if (rawOffset <= expansion.rawStart) break;
    if (rawOffset <= expansion.rawEnd) return expansion.foldedEnd;
    adjustment +=
      (expansion.foldedEnd - expansion.foldedStart) -
      (expansion.rawEnd - expansion.rawStart);
  }
  return rawOffset + adjustment;
}

function rawOffsetAt(segment: TextQuoteSegment, normalizedOffset: number): number {
  const runs = segment.rawOffsetRuns;
  let lo = 0;
  let hi = (runs.length >> 1) - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (runs[mid * 2]! <= normalizedOffset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return normalizedOffset;
  const normalizedStart = runs[found * 2]!;
  const rawStart = runs[found * 2 + 1]!;
  return rawStart + normalizedOffset - normalizedStart;
}

function normalizedOffsetAtOrAfterRaw(segment: TextQuoteSegment, rawOffset: number): number {
  let lo = 0;
  let hi = segment.normalizedLength;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rawOffsetAt(segment, mid) < rawOffset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Binary-searches `scope.segments` (sorted by `normalizedStart`) for the segment containing
 *  `normalizedOffset`, then maps it to a DOM position through that segment's sparse offset runs. */
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
  if (local >= segment.normalizedLength) {
    // The offset lands exactly at (or past) this segment's own end -- resolve to one past its last
    // mapped raw character rather than stepping into the next segment (any offset strictly inside
    // the next segment is found directly via its own `normalizedStart` instead).
    const lastRaw = segment.normalizedLength > 0
      ? rawOffsetAt(segment, segment.normalizedLength - 1)
      : 0;
    return { node: segment.node, offset: Math.min(segment.node.data.length, lastRaw + 1) };
  }
  return { node: segment.node, offset: rawOffsetAt(segment, local) };
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

export interface TextQuoteWorkBudget {
  remainingCodeUnits: number;
}

/** Reusable per-content/per-locale occurrence index. Cached queries allocate packed offsets; a
 * caller supplies a fresh work budget for each logical operation so one paint pass cannot turn
 * N distinct highlights into N full-corpus scans. */
export class TextQuoteIndex {
  private readonly limits: TextQuoteLimits;
  private readonly occurrenceCache = new Map<string, TextQuoteMatches>();
  private foldedScope?: FoldedText;
  private _scanCount = 0;

  constructor(
    readonly scope: TextQuoteScope,
    readonly locale?: string,
    limitOverrides?: Partial<TextQuoteLimits>,
  ) {
    this.limits = resolvedLimits(limitOverrides);
  }

  get scanCount(): number {
    return this._scanCount;
  }

  createWorkBudget(maxCodeUnits = this.limits.maxSearchWorkCodeUnits): TextQuoteWorkBudget {
    return { remainingCodeUnits: Math.max(0, Math.floor(maxCodeUnits)) };
  }

  private consumeWork(budget: TextQuoteWorkBudget, amount: number): boolean {
    if (budget.remainingCodeUnits < amount) return false;
    budget.remainingCodeUnits -= amount;
    return true;
  }

  private boundedQuery(value: string | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    if (value.length > this.limits.maxQueryCodeUnits) return null;
    const normalized = normalizeQuoteText(value);
    return normalized.length <= this.limits.maxQueryCodeUnits ? normalized : null;
  }

  private foldedFor(budget: TextQuoteWorkBudget): FoldedText | null {
    if (this.foldedScope) return this.foldedScope;
    if (!this.consumeWork(budget, this.scope.text.length)) return null;
    this.foldedScope = foldText(this.scope.text, this.locale);
    return this.foldedScope;
  }

  private cache(key: string, matches: TextQuoteMatches): void {
    if (this.limits.maxCacheEntries === 0) return;
    if (this.occurrenceCache.size >= this.limits.maxCacheEntries) {
      const oldest = this.occurrenceCache.keys().next().value as string | undefined;
      if (oldest !== undefined) this.occurrenceCache.delete(oldest);
    }
    this.occurrenceCache.set(key, matches);
  }

  private occurrences(
    needle: string,
    caseInsensitive: boolean,
    budget: TextQuoteWorkBudget,
  ): TextQuoteMatches {
    const folded = caseInsensitive ? this.foldedFor(budget) : undefined;
    if (caseInsensitive && !folded) return emptyMatches(false, false);
    const searchableNeedle = caseInsensitive ? caseFold(needle, this.locale) : needle;
    const haystack = folded?.text ?? this.scope.text;
    const key = `${caseInsensitive ? 'i' : 's'}:${searchableNeedle}`;
    const cached = this.occurrenceCache.get(key);
    if (cached) return cached;
    if (searchableNeedle.length === 0) return emptyMatches(!this.scope.truncated, true);
    if (searchableNeedle.length > haystack.length) {
      const result = emptyMatches(!this.scope.truncated, true);
      this.cache(key, result);
      return result;
    }
    if (!this.consumeWork(budget, haystack.length)) return emptyMatches(false, false);
    this._scanCount++;
    const result = scanOccurrences(
      haystack,
      searchableNeedle,
      folded,
      this.limits.maxMatches,
      this.scope.truncated,
    );
    this.cache(key, result);
    return result;
  }

  search(query: string, budget = this.createWorkBudget()): TextQuoteMatches {
    const needle = this.boundedQuery(query);
    if (needle === null) return emptyMatches(false, false);
    if (!needle) return emptyMatches(true, true);
    return this.occurrences(needle, true, budget);
  }

  resolve(
    anchor: { quote: string; prefix?: string; suffix?: string },
    budget = this.createWorkBudget(),
  ): TextQuoteMatch | null {
    const quote = this.boundedQuery(anchor.quote);
    const prefix = this.boundedQuery(anchor.prefix);
    const suffix = this.boundedQuery(anchor.suffix);
    if (!quote || prefix === null || suffix === null) return null;

    let candidates = this.occurrences(quote, false, budget);
    if (candidates.length === 0 && candidates.scanComplete) {
      candidates = this.occurrences(quote, true, budget);
    }
    const first = candidates.at(0);
    if (!first || (!prefix && !suffix)) return first ?? null;

    const foldedScope = this.foldedFor(budget);
    if (!foldedScope) return first;
    const foldedPrefix = prefix ? caseFold(prefix, this.locale) : undefined;
    const foldedSuffix = suffix ? caseFold(suffix, this.locale) : undefined;
    let best = first;
    let bestScore = -1;
    for (const candidate of candidates) {
      let score = 0;
      const foldedStart = foldedStartForRawOffset(foldedScope, candidate.start);
      const foldedEnd = foldedEndForRawOffset(foldedScope, candidate.end);
      if (foldedPrefix) {
        const availableBefore = foldedScope.text.slice(0, foldedStart).trimEnd();
        const before = availableBefore.slice(Math.max(0, availableBefore.length - foldedPrefix.length));
        if (before === foldedPrefix) score++;
      }
      if (foldedSuffix) {
        const after = foldedScope.text.slice(foldedEnd).trimStart().slice(0, foldedSuffix.length);
        if (after === foldedSuffix) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }
}

export function createTextQuoteIndex(
  scope: TextQuoteScope,
  locale?: string,
  limitOverrides?: Partial<TextQuoteLimits>,
): TextQuoteIndex {
  return new TextQuoteIndex(scope, locale, limitOverrides);
}

/** Resolves within the bounded scope/index. Quotes after a truncated corpus prefix or beyond an
 * occurrence/work ceiling are intentionally unresolved rather than allocating without limit. */
export function resolveTextQuote(
  scope: TextQuoteScope,
  anchor: { quote: string; prefix?: string; suffix?: string },
  locale?: string,
): Range | null {
  const match = createTextQuoteIndex(scope, locale).resolve(anchor);
  return match ? rangeFromOffsets(scope, match.start, match.end) : null;
}

/** Every retained occurrence of `query` in `scope`, packed as offsets. `matchCountExact=false`
 * makes corpus/match/query/work truncation explicit to search-event callers. */
export function findTextQuoteMatches(
  scope: TextQuoteScope,
  query: string,
  locale?: string,
  limitOverrides?: Partial<TextQuoteLimits>,
): TextQuoteMatches {
  return createTextQuoteIndex(scope, locale, limitOverrides).search(query);
}

/** Materializes one `TextQuoteMatch` into a live `Range`, or null if the scope no longer covers
 *  those offsets (the document changed since the match was found). */
export function rangeFromTextQuoteMatch(scope: TextQuoteScope, match: TextQuoteMatch): Range | null {
  return rangeFromOffsets(scope, match.start, match.end);
}

export function findTextQuoteRanges(scope: TextQuoteScope, query: string, locale?: string): Range[] {
  const ranges: Range[] = [];
  for (const match of findTextQuoteMatches(scope, query, locale)) {
    const range = rangeFromOffsets(scope, match.start, match.end);
    if (range) ranges.push(range);
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
  const local = normalizedOffsetAtOrAfterRaw(segment, boundary.offset);
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
  const local = normalizedOffsetAtOrAfterRaw(segment, boundary.offset);
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
