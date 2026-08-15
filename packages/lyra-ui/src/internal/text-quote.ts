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
  /** Maximum DOM nodes/direct item children traversed while locating those text nodes. */
  maxTraversalNodes: number;
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
  maxTraversalNodes: 20_000,
  maxNodeCodeUnits: 1_000_000,
  maxNormalizationWorkCodeUnits: 2_000_000,
  maxQueryCodeUnits: 4_096,
  maxMatches: 10_000,
  maxSearchWorkCodeUnits: 4_000_000,
  maxCacheEntries: 64,
});

function resolvedLimits(overrides?: Partial<TextQuoteLimits>): TextQuoteLimits {
  const boundedInteger = (value: number | undefined, hardMaximum: number): number =>
    Number.isFinite(value)
      ? Math.min(hardMaximum, Math.max(0, Math.floor(value!)))
      : hardMaximum;
  return {
    maxCorpusCodeUnits: boundedInteger(overrides?.maxCorpusCodeUnits, TEXT_QUOTE_LIMITS.maxCorpusCodeUnits),
    maxNodes: boundedInteger(overrides?.maxNodes, TEXT_QUOTE_LIMITS.maxNodes),
    maxTraversalNodes: boundedInteger(
      overrides?.maxTraversalNodes,
      TEXT_QUOTE_LIMITS.maxTraversalNodes,
    ),
    maxNodeCodeUnits: boundedInteger(overrides?.maxNodeCodeUnits, TEXT_QUOTE_LIMITS.maxNodeCodeUnits),
    maxNormalizationWorkCodeUnits: boundedInteger(
      overrides?.maxNormalizationWorkCodeUnits,
      TEXT_QUOTE_LIMITS.maxNormalizationWorkCodeUnits,
    ),
    maxQueryCodeUnits: boundedInteger(overrides?.maxQueryCodeUnits, TEXT_QUOTE_LIMITS.maxQueryCodeUnits),
    maxMatches: boundedInteger(overrides?.maxMatches, TEXT_QUOTE_LIMITS.maxMatches),
    maxSearchWorkCodeUnits: boundedInteger(
      overrides?.maxSearchWorkCodeUnits,
      TEXT_QUOTE_LIMITS.maxSearchWorkCodeUnits,
    ),
    maxCacheEntries: boundedInteger(overrides?.maxCacheEntries, TEXT_QUOTE_LIMITS.maxCacheEntries),
  };
}

/** NFC-normalizes, strips soft hyphens, collapses every whitespace run to one ASCII space, and
 *  trims. The single normalization used for a whole standalone string -- an anchor's `quote`/
 *  `prefix`/`suffix`, or a fully-selected Range's text. Building a scope's own per-node corpus uses
 *  a related, non-trimming variant internally (see `normalizeSegment`) so inter-node spacing survives. */
export function normalizeQuoteText(s: string): string {
  return collapseWhitespaceAndSoftHyphen(s.normalize('NFC')).trim();
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
  /** Canonically changed graphemes as packed `[normalizedStart, normalizedEnd, rawStart, rawEnd]`. */
  rawClusterRuns?: Uint32Array;
  /** Raw node length at scope construction, used to fail closed after stale DOM mutations. */
  rawLength?: number;
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
 *  the normalized text and sparse typed offset runs for the places where raw/normalized offsets
 *  diverge.
 *  NFC-changed graphemes retain coarse raw cluster boundaries, so canonical composition or
 *  reordering maps a match back to the complete source grapheme without a per-character JS array. */
interface NormalizedSegment {
  text: string;
  rawOffsetRuns: Uint32Array;
  rawClusterRuns: Uint32Array;
  workCodeUnits: number;
  truncated: boolean;
  lastWasSpace: boolean;
}

interface NormalizationCluster {
  text: string;
  rawStart: number;
  rawEnd: number;
}

const MARK_RE = /\p{Mark}/u;

function* normalizationClusters(value: string): Generator<NormalizationCluster> {
  if (typeof Intl.Segmenter === 'function') {
    for (const { segment, index } of segmenterFor().segment(value)) {
      yield { text: segment, rawStart: index, rawEnd: index + segment.length };
    }
    return;
  }
  let cluster = '';
  let rawStart = 0;
  let rawEnd = 0;
  let joinsNext = false;
  for (const char of value) {
    const continuation = cluster !== '' && (MARK_RE.test(char) || char === '\ufe0f' || joinsNext);
    if (!continuation && cluster) {
      yield { text: cluster, rawStart, rawEnd };
      cluster = '';
      rawStart = rawEnd;
    }
    cluster += char;
    rawEnd += char.length;
    joinsNext = char === '\u200d';
  }
  if (cluster) yield { text: cluster, rawStart, rawEnd };
}

function normalizeSegment(
  raw: string,
  maxOutputCodeUnits: number,
  maxWorkCodeUnits: number,
  initialLastWasSpace = false,
): NormalizedSegment {
  const inspectedLength = Math.min(raw.length, maxWorkCodeUnits);
  const inspected = raw.slice(0, inspectedLength);
  const nfc = inspected.normalize('NFC');
  const chunks: string[] = [];
  let chunk = '';
  let normalizedLength = 0;
  const rawOffsetRuns: number[] = [];
  const rawClusterRuns: number[] = [];
  let currentDelta = 0;
  let lastWasSpace = initialLastWasSpace;
  let outputTruncated = false;

  const appendUnit = (ch: string, rawIndex: number): boolean => {
    if (ch === SOFT_HYPHEN) return true;
    if (WHITESPACE_CHAR_RE.test(ch)) {
      if (lastWasSpace) return true;
      lastWasSpace = true;
      if (normalizedLength >= maxOutputCodeUnits) return false;
      const delta = rawIndex - normalizedLength;
      if (delta !== currentDelta) {
        rawOffsetRuns.push(normalizedLength, rawIndex);
        currentDelta = delta;
      }
      chunk += ' ';
      normalizedLength++;
    } else {
      lastWasSpace = false;
      if (normalizedLength >= maxOutputCodeUnits) return false;
      const delta = rawIndex - normalizedLength;
      if (delta !== currentDelta) {
        rawOffsetRuns.push(normalizedLength, rawIndex);
        currentDelta = delta;
      }
      chunk += ch;
      normalizedLength++;
    }
    if (chunk.length >= 4_096) {
      chunks.push(chunk);
      chunk = '';
    }
    return true;
  };

  if (nfc === inspected) {
    for (let rawIndex = 0; rawIndex < inspected.length; rawIndex++) {
      if (!appendUnit(inspected[rawIndex]!, rawIndex)) {
        outputTruncated = true;
        break;
      }
    }
  } else {
    for (const cluster of normalizationClusters(inspected)) {
      const normalizedCluster = cluster.text.normalize('NFC');
      if (normalizedCluster === cluster.text) {
        for (let local = 0; local < cluster.text.length; local++) {
          if (!appendUnit(cluster.text[local]!, cluster.rawStart + local)) {
            outputTruncated = true;
            break;
          }
        }
        if (outputTruncated) break;
        continue;
      }
      const normalizedVisible = collapseWhitespaceAndSoftHyphen(normalizedCluster);
      if (!normalizedVisible) continue;
      if (normalizedLength + normalizedVisible.length > maxOutputCodeUnits) {
        outputTruncated = true;
        break;
      }
      const normalizedStart = normalizedLength;
      chunk += normalizedVisible;
      normalizedLength += normalizedVisible.length;
      lastWasSpace = normalizedVisible.endsWith(' ');
      rawClusterRuns.push(normalizedStart, normalizedLength, cluster.rawStart, cluster.rawEnd);
      if (chunk.length >= 4_096) {
        chunks.push(chunk);
        chunk = '';
      }
    }
  }
  const terminalDelta = inspectedLength - normalizedLength;
  if (terminalDelta !== currentDelta) rawOffsetRuns.push(normalizedLength, inspectedLength);
  return {
    text: chunks.join('') + chunk,
    rawOffsetRuns: Uint32Array.from(rawOffsetRuns),
    rawClusterRuns: Uint32Array.from(rawClusterRuns),
    workCodeUnits: inspectedLength,
    truncated: outputTruncated || inspectedLength < raw.length,
    lastWasSpace,
  };
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

function nextNodeWithin(root: Node, node: Node, descend: boolean): Node | null {
  if (descend && node.firstChild) return node.firstChild;
  let current: Node | null = node;
  while (current && current !== root) {
    if (current.nextSibling) return current.nextSibling;
    current = current.parentNode;
  }
  return null;
}

/** Builds a scope by walking `root`'s text nodes in document order (skipping
 *  script/style/template/noscript), concatenating each node's normalized text. Callers pass their
 *  *content* element (e.g. markdown's `[part="content"]`) so toolbar chrome never enters the corpus. */
export function scopeFromElement(
  root: Element,
  limitOverrides?: Partial<TextQuoteLimits>,
): TextQuoteScope {
  const limits = resolvedLimits(limitOverrides);
  const segments: TextQuoteSegment[] = [];
  const textChunks: string[] = [];
  let textLength = 0;
  let textNodesVisited = 0;
  let traversalNodesVisited = 0;
  let workCodeUnits = 0;
  let lastWasSpace = false;
  let truncated = false;
  let node: Node | null = root.firstChild;
  while (node) {
    if (traversalNodesVisited >= limits.maxTraversalNodes) {
      truncated = true;
      break;
    }
    traversalNodesVisited++;
    const skipChildren = node.nodeType === Node.ELEMENT_NODE
      && SKIP_TAGS.has((node as Element).tagName);
    const next = nextNodeWithin(root, node, !skipChildren);
    if (node.nodeType !== Node.TEXT_NODE) {
      node = next;
      continue;
    }
    if (textNodesVisited >= limits.maxNodes) {
      truncated = true;
      break;
    }
    textNodesVisited++;
    const textNode = node as Text;
    const workRemaining = Math.max(0, limits.maxNormalizationWorkCodeUnits - workCodeUnits);
    if (workRemaining === 0) {
      truncated = true;
      break;
    }
    const nodeWork = Math.min(limits.maxNodeCodeUnits, workRemaining);
    const {
      text: segText,
      rawOffsetRuns,
      rawClusterRuns,
      workCodeUnits: used,
      truncated: segmentTruncated,
      lastWasSpace: nextLastWasSpace,
    } =
      normalizeSegment(
        textNode.data,
        Math.max(0, limits.maxCorpusCodeUnits - textLength),
        nodeWork,
        lastWasSpace,
      );
    workCodeUnits += used;
    lastWasSpace = nextLastWasSpace;
    if (segText.length === 0) {
      if (segmentTruncated) {
        truncated = true;
        break;
      }
      node = next;
      continue;
    }
    segments.push({
      node: textNode,
      normalizedStart: textLength,
      normalizedLength: segText.length,
      rawOffsetRuns,
      rawClusterRuns,
      rawLength: textNode.data.length,
    });
    textChunks.push(segText);
    textLength += segText.length;
    if (segmentTruncated) {
      truncated = true;
      break;
    }
    if (textLength === limits.maxCorpusCodeUnits) {
      truncated = next !== null;
      break;
    }
    node = next;
  }
  return { text: textChunks.join(''), segments, truncated };
}

function firstTextNode(
  element: Element,
  traversalRemaining: number,
): { node: Text | null; inspected: number; truncated: boolean } {
  let inspected = 0;
  let child: ChildNode | null = element.firstChild;
  while (child && inspected < traversalRemaining) {
    inspected++;
    if (child.nodeType === Node.TEXT_NODE) return { node: child as Text, inspected, truncated: false };
    child = child.nextSibling;
  }
  return { node: null, inspected, truncated: child !== null };
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
  let traversalNodesVisited = 0;
  let lastWasSpace = false;
  let truncated = false;
  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    if (itemIndex >= limits.maxNodes) {
      truncated = true;
      break;
    }
    const item = items[itemIndex]!;
    const located = firstTextNode(
      item.element,
      Math.max(0, limits.maxTraversalNodes - traversalNodesVisited),
    );
    traversalNodesVisited += located.inspected;
    if (located.truncated) {
      truncated = true;
      break;
    }
    const node = located.node;
    if (!node) continue;
    const workRemaining = Math.max(0, limits.maxNormalizationWorkCodeUnits - workCodeUnits);
    if (workRemaining === 0) {
      truncated = true;
      break;
    }
    const {
      text: segText,
      rawOffsetRuns,
      rawClusterRuns,
      workCodeUnits: used,
      truncated: segmentTruncated,
      lastWasSpace: nextLastWasSpace,
    } =
      normalizeSegment(
        item.text,
        Math.max(0, limits.maxCorpusCodeUnits - textLength - (textLength > 0 && !lastWasSpace ? 1 : 0)),
        Math.min(limits.maxNodeCodeUnits, workRemaining),
        lastWasSpace,
      );
    workCodeUnits += used;
    const needsSyntheticJoin = textLength > 0 && !lastWasSpace && !segText.startsWith(' ');
    lastWasSpace = nextLastWasSpace;
    if (segText.length === 0) {
      if (segmentTruncated) {
        truncated = true;
        break;
      }
      continue;
    }
    if (needsSyntheticJoin) {
      if (textLength >= limits.maxCorpusCodeUnits) {
        truncated = true;
        break;
      }
      textChunks.push(' ');
      textLength++;
    }
    segments.push({
      node,
      normalizedStart: textLength,
      normalizedLength: segText.length,
      rawOffsetRuns,
      rawClusterRuns,
      rawLength: node.data.length,
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
  /** Packed `[rawStart, rawEnd, foldedStart, foldedEnd]` entries. */
  expansions: Uint32Array;
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
  if (text.length === value.length) return { text, expansions: new Uint32Array() };

  let expansions = new Uint32Array(Math.min(64, Math.max(1, value.length)) * 4);
  let expansionCount = 0;
  const appendExpansion = (
    rawStart: number,
    rawEnd: number,
    foldedStart: number,
    foldedEnd: number,
  ): void => {
    if (expansionCount * 4 === expansions.length) {
      const nextCapacity = Math.min(value.length, Math.max(1, (expansions.length >> 2) * 2));
      const next = new Uint32Array(nextCapacity * 4);
      next.set(expansions);
      expansions = next;
    }
    const offset = expansionCount * 4;
    expansions[offset] = rawStart;
    expansions[offset + 1] = rawEnd;
    expansions[offset + 2] = foldedStart;
    expansions[offset + 3] = foldedEnd;
    expansionCount++;
  };
  let foldedStart = 0;
  for (const segment of caseMappingSegments(value, locale)) {
    // Length-changing special casing is grapheme-local. Contextual casing such as Greek final
    // sigma changes code points but not UTF-16 length, so it does not need an offset entry.
    const isolatedLength = caseFold(segment.text, locale).length;
    const foldedEnd = segment.rawEnd === value.length
      ? text.length
      : Math.min(text.length, foldedStart + isolatedLength);
    if (foldedEnd - foldedStart !== segment.rawEnd - segment.rawStart) {
      appendExpansion(segment.rawStart, segment.rawEnd, foldedStart, foldedEnd);
    }
    foldedStart = foldedEnd;
  }
  return { text, expansions: expansions.slice(0, expansionCount * 4) };
}

function rawStartForFoldedOffset(folded: FoldedText, foldedOffset: number): number {
  let lo = 0;
  let hi = (folded.expansions.length >> 2) - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (folded.expansions[mid * 4 + 2]! <= foldedOffset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return foldedOffset;
  const offset = found * 4;
  const rawStart = folded.expansions[offset]!;
  const rawEnd = folded.expansions[offset + 1]!;
  const foldedEnd = folded.expansions[offset + 3]!;
  if (foldedOffset < foldedEnd) return rawStart;
  return foldedOffset - (foldedEnd - rawEnd);
}

function rawEndForFoldedOffset(folded: FoldedText, foldedOffset: number): number {
  let lo = 0;
  let hi = (folded.expansions.length >> 2) - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (folded.expansions[mid * 4 + 2]! < foldedOffset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return foldedOffset;
  const offset = found * 4;
  const rawEnd = folded.expansions[offset + 1]!;
  const foldedEnd = folded.expansions[offset + 3]!;
  if (foldedOffset <= foldedEnd) return rawEnd;
  return foldedOffset - (foldedEnd - rawEnd);
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

/** An exact, allocation-light empty occurrence collection for viewer state initialization/reset. */
export function emptyTextQuoteMatches(): TextQuoteMatches {
  return emptyMatches(true, true);
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
  let lo = 0;
  let hi = (folded.expansions.length >> 2) - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (folded.expansions[mid * 4]! <= rawOffset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return rawOffset;
  const offset = found * 4;
  const rawEnd = folded.expansions[offset + 1]!;
  const foldedStart = folded.expansions[offset + 2]!;
  const foldedEnd = folded.expansions[offset + 3]!;
  if (rawOffset < rawEnd) return foldedStart;
  return rawOffset + (foldedEnd - rawEnd);
}

function foldedEndForRawOffset(folded: FoldedText, rawOffset: number): number {
  let lo = 0;
  let hi = (folded.expansions.length >> 2) - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (folded.expansions[mid * 4]! < rawOffset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return rawOffset;
  const offset = found * 4;
  const rawEnd = folded.expansions[offset + 1]!;
  const foldedEnd = folded.expansions[offset + 3]!;
  if (rawOffset <= rawEnd) return foldedEnd;
  return rawOffset + (foldedEnd - rawEnd);
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

interface RawClusterRun {
  normalizedStart: number;
  normalizedEnd: number;
  rawStart: number;
  rawEnd: number;
}

function clusterAtNormalizedOffset(
  segment: TextQuoteSegment,
  normalizedOffset: number,
): RawClusterRun | null {
  const runs = segment.rawClusterRuns ?? new Uint32Array();
  let lo = 0;
  let hi = (runs.length >> 2) - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (runs[mid * 4]! <= normalizedOffset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0 || normalizedOffset >= runs[found * 4 + 1]!) return null;
  return {
    normalizedStart: runs[found * 4]!,
    normalizedEnd: runs[found * 4 + 1]!,
    rawStart: runs[found * 4 + 2]!,
    rawEnd: runs[found * 4 + 3]!,
  };
}

function clusterAtRawOffset(segment: TextQuoteSegment, rawOffset: number): RawClusterRun | null {
  const runs = segment.rawClusterRuns ?? new Uint32Array();
  let lo = 0;
  let hi = (runs.length >> 2) - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (runs[mid * 4 + 2]! <= rawOffset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0 || rawOffset >= runs[found * 4 + 3]!) return null;
  return {
    normalizedStart: runs[found * 4]!,
    normalizedEnd: runs[found * 4 + 1]!,
    rawStart: runs[found * 4 + 2]!,
    rawEnd: runs[found * 4 + 3]!,
  };
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

function normalizedBoundaryAtRaw(
  segment: TextQuoteSegment,
  rawOffset: number,
  endBoundary: boolean,
): number {
  const cluster = clusterAtRawOffset(segment, rawOffset);
  if (cluster) {
    if (rawOffset === cluster.rawStart) return cluster.normalizedStart;
    return endBoundary ? cluster.normalizedEnd : cluster.normalizedStart;
  }
  return normalizedOffsetAtOrAfterRaw(segment, rawOffset);
}

/** Binary-searches `scope.segments` (sorted by `normalizedStart`) for the segment containing
 *  `normalizedOffset`, then maps it to a DOM position through that segment's sparse offset runs. */
function locate(
  scope: TextQuoteScope,
  normalizedOffset: number,
  endCharacter: boolean,
): { node: Text; offset: number } | null {
  if (!Number.isInteger(normalizedOffset) || normalizedOffset < 0 || normalizedOffset >= scope.text.length) {
    return null;
  }
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
  if (local < 0 || local >= segment.normalizedLength) return null;
  if (segment.rawLength !== undefined && segment.node.data.length !== segment.rawLength) return null;
  const cluster = clusterAtNormalizedOffset(segment, local);
  const offset = cluster
    ? endCharacter ? cluster.rawEnd - 1 : cluster.rawStart
    : rawOffsetAt(segment, local);
  return offset >= 0 && offset < segment.node.data.length ? { node: segment.node, offset } : null;
}

function rangeFromOffsets(scope: TextQuoteScope, start: number, end: number): Range | null {
  if (
    !Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end <= start
    || end > scope.text.length
  ) return null;
  const startPos = locate(scope, start, false);
  const endPos = locate(scope, end - 1, true); // last included character
  if (!startPos || !endPos) return null;
  if (startPos.node.ownerDocument !== endPos.node.ownerDocument) return null;
  try {
    const range = startPos.node.ownerDocument.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset + 1);
    return range.collapsed ? null : range;
  } catch {
    return null;
  }
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
  private _scope: TextQuoteScope;

  constructor(
    scope: TextQuoteScope,
    readonly locale?: string,
    limitOverrides?: Partial<TextQuoteLimits>,
  ) {
    this._scope = scope;
    this.limits = resolvedLimits(limitOverrides);
  }

  get scope(): TextQuoteScope {
    return this._scope;
  }

  /** Rebinds offset-to-node materialization after a structurally different but semantically
   * identical DOM paint, preserving the folded corpus and occurrence cache. */
  rebindScope(scope: TextQuoteScope): boolean {
    if (scope.text !== this._scope.text || scope.truncated !== this._scope.truncated) return false;
    this._scope = scope;
    return true;
  }

  get scanCount(): number {
    return this._scanCount;
  }

  createWorkBudget(maxCodeUnits = this.limits.maxSearchWorkCodeUnits): TextQuoteWorkBudget {
    const bounded = Number.isFinite(maxCodeUnits)
      ? Math.min(this.limits.maxSearchWorkCodeUnits, Math.max(0, Math.floor(maxCodeUnits)))
      : this.limits.maxSearchWorkCodeUnits;
    return { remainingCodeUnits: bounded };
  }

  private consumeWork(budget: TextQuoteWorkBudget, amount: number): boolean {
    if (!Number.isFinite(budget.remainingCodeUnits) || budget.remainingCodeUnits < amount) return false;
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
    const folded = caseInsensitive ? this.foldedFor(budget) ?? undefined : undefined;
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
    // Context is a disambiguator, not a best-effort hint. Returning an admitted prefix candidate
    // when a resource ceiling omitted a later one can silently resolve to the wrong passage.
    if (!candidates.matchCountExact) return null;

    const foldedScope = this.foldedFor(budget);
    if (!foldedScope) return null;
    const foldedPrefix = prefix ? caseFold(prefix, this.locale) : undefined;
    const foldedSuffix = suffix ? caseFold(suffix, this.locale) : undefined;
    let best = first;
    let bestScore = -1;
    for (const candidate of candidates) {
      const contextWork = (foldedPrefix?.length ?? 0) + (foldedSuffix?.length ?? 0);
      if (!this.consumeWork(budget, contextWork)) return null;
      let score = 0;
      const foldedStart = foldedStartForRawOffset(foldedScope, candidate.start);
      const foldedEnd = foldedEndForRawOffset(foldedScope, candidate.end);
      if (foldedPrefix) {
        let beforeEnd = foldedStart;
        while (beforeEnd > 0 && WHITESPACE_CHAR_RE.test(foldedScope.text[beforeEnd - 1]!)) {
          if (!this.consumeWork(budget, 1)) return null;
          beforeEnd--;
        }
        if (foldedScope.text.endsWith(foldedPrefix, beforeEnd)) score++;
      }
      if (foldedSuffix) {
        let afterStart = foldedEnd;
        while (afterStart < foldedScope.text.length && WHITESPACE_CHAR_RE.test(foldedScope.text[afterStart]!)) {
          if (!this.consumeWork(budget, 1)) return null;
          afterStart++;
        }
        if (foldedScope.text.startsWith(foldedSuffix, afterStart)) score++;
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

/** Resolves a DOM boundary point `(container, offset)` to a concrete `(Text node, offset)` pair.
 *  `container` is already a Text node for a Selection-derived Range, but a Range built via
 *  `selectNodeContents(element)` reports the element itself with `offset` as a child index, so that
 *  case is resolved from the already-bounded scope segments, never recursive DOM descent. */
function resolveBoundaryTextNode(
  container: Node,
  offset: number,
  scope: TextQuoteScope,
): { node: Text; offset: number } | null {
  if (container.nodeType === Node.TEXT_NODE) return { node: container as Text, offset };
  const child = container.childNodes[offset];
  if (!child) return null;
  let traversalRemaining = TEXT_QUOTE_LIMITS.maxTraversalNodes;
  for (const segment of scope.segments) {
    let cursor: Node | null = segment.node;
    while (cursor && traversalRemaining > 0) {
      traversalRemaining--;
      if (cursor === child) return { node: segment.node, offset: 0 };
      if (cursor === container) break;
      cursor = cursor.parentNode;
    }
    if (traversalRemaining === 0) return null;
  }
  return null;
}

function findRangeStartInScope(scope: TextQuoteScope, range: Range): number | null {
  const boundary = resolveBoundaryTextNode(range.startContainer, range.startOffset, scope);
  if (!boundary) return null;
  const segment = scope.segments.find((s) => s.node === boundary.node);
  if (!segment) return null;
  if (boundary.offset < 0 || boundary.offset > boundary.node.data.length) return null;
  const local = normalizedBoundaryAtRaw(segment, boundary.offset, false);
  return segment.normalizedStart + local;
}

/** Resolves a DOM *end* boundary point `(container, offset)` to a concrete `(Text node, offset)`
 *  pair. Mirrors `resolveBoundaryTextNode`: an end container that's already a Text node is used
 *  directly, but a Range built via `selectNodeContents(element)` reports its end as the element
 *  with `offset` one past the last included child index, so that case resolves to the full length
 *  of the last text descendant of the child immediately before that index. */
function resolveEndBoundaryTextNode(
  container: Node,
  offset: number,
  scope: TextQuoteScope,
): { node: Text; offset: number } | null {
  if (container.nodeType === Node.TEXT_NODE) return { node: container as Text, offset };
  const child = container.childNodes[offset - 1];
  if (!child) return null;
  let traversalRemaining = TEXT_QUOTE_LIMITS.maxTraversalNodes;
  for (let index = scope.segments.length - 1; index >= 0; index--) {
    const segment = scope.segments[index]!;
    let cursor: Node | null = segment.node;
    while (cursor && traversalRemaining > 0) {
      traversalRemaining--;
      if (cursor === child) return { node: segment.node, offset: segment.node.data.length };
      if (cursor === container) break;
      cursor = cursor.parentNode;
    }
    if (traversalRemaining === 0) return null;
  }
  return null;
}

/** Same mapping as `findRangeStartInScope`, but for a range's end boundary: returns the exclusive
 *  normalized offset one past the range's last included character. */
function findRangeEndInScope(scope: TextQuoteScope, range: Range): number | null {
  const boundary = resolveEndBoundaryTextNode(range.endContainer, range.endOffset, scope);
  if (!boundary) return null;
  const segment = scope.segments.find((s) => s.node === boundary.node);
  if (!segment) return null;
  if (boundary.offset < 0 || boundary.offset > boundary.node.data.length) return null;
  const local = normalizedBoundaryAtRaw(segment, boundary.offset, true);
  return segment.normalizedStart + local;
}

/** Builds a `text-quote` `LyraAnchor` from a live selection `Range`, capturing
 *  `TEXT_QUOTE_CONTEXT_CHARS` of normalized context before/after as `prefix`/`suffix`. The quote
 *  itself is read back out of `scope.text` (via the range's start/end mapped into scope offsets)
 *  rather than `range.toString()` -- a range spanning multiple sibling elements with no DOM
 *  whitespace between them (e.g. one `<span>` per pdf.js text-layer word) stringifies with no
 *  inter-word spaces, which `scope.text`'s own synthesized word-joining space already accounts for.
 *  Falls back to a bounded DOM walk when the range's boundaries can't be mapped into `scope` at
 *  all (e.g. a selection outside the scoped content). Quotes are capped at the shared 4,096-code-
 *  unit query ceiling. Per-format `page` enrichment is the caller's job. */
function boundedRangeText(range: Range, maxCodeUnits: number): string {
  if (maxCodeUnits <= 0) return '';
  if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
    return (range.startContainer as Text).data.slice(
      range.startOffset,
      Math.min(range.endOffset, range.startOffset + maxCodeUnits),
    );
  }
  const root = range.commonAncestorContainer;
  let node: Node | null = root.nodeType === Node.TEXT_NODE ? root : root.firstChild;
  let visited = 0;
  let text = '';
  while (node && visited < TEXT_QUOTE_LIMITS.maxTraversalNodes && text.length < maxCodeUnits) {
    visited++;
    const next = node === root ? null : nextNodeWithin(root, node, true);
    if (node.nodeType === Node.TEXT_NODE) {
      let included = false;
      try {
        included = range.intersectsNode(node);
      } catch {
        return text;
      }
      if (included) {
        const value = (node as Text).data;
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : value.length;
        text += value.slice(start, Math.min(end, start + maxCodeUnits - text.length));
      }
    }
    node = next;
  }
  return text;
}

/** Returns normalized selection text without ever materializing the range's unbounded full
 * `toString()` value. The public ceiling is the same one quote anchors and viewer queries accept. */
export function boundedSelectionText(
  range: Range,
  maxCodeUnits = TEXT_QUOTE_LIMITS.maxQueryCodeUnits,
): string {
  const bounded = Number.isFinite(maxCodeUnits)
    ? Math.min(TEXT_QUOTE_LIMITS.maxQueryCodeUnits, Math.max(0, Math.floor(maxCodeUnits)))
    : TEXT_QUOTE_LIMITS.maxQueryCodeUnits;
  return normalizeQuoteText(boundedRangeText(range, bounded));
}

export const TEXT_SELECTION_RECT_LIMIT = 1_000;

/** Copies at most the hard rect ceiling instead of retaining an unbounded `DOMRectList`. */
export function boundedSelectionRects(
  range: Range,
  maxRects = TEXT_SELECTION_RECT_LIMIT,
): DOMRect[] {
  const bounded = Number.isFinite(maxRects)
    ? Math.min(TEXT_SELECTION_RECT_LIMIT, Math.max(0, Math.floor(maxRects)))
    : TEXT_SELECTION_RECT_LIMIT;
  const output: DOMRect[] = [];
  for (const rect of range.getClientRects()) {
    if (output.length >= bounded) break;
    output.push(rect as DOMRect);
  }
  return output;
}

export function buildQuoteAnchor(range: Range, scope: TextQuoteScope): LyraAnchor {
  const startOffset = findRangeStartInScope(scope, range);
  const endOffset = findRangeEndInScope(scope, range);
  const mappedQuote =
    startOffset != null && endOffset != null && endOffset > startOffset
      ? scope.text.slice(startOffset, Math.min(endOffset, startOffset + TEXT_QUOTE_LIMITS.maxQueryCodeUnits))
      : '';
  const fallbackText = mappedQuote
    ? ''
    : boundedRangeText(range, TEXT_QUOTE_LIMITS.maxQueryCodeUnits);
  const quote = normalizeQuoteText(
    (mappedQuote || fallbackText).slice(0, TEXT_QUOTE_LIMITS.maxQueryCodeUnits),
  );
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
