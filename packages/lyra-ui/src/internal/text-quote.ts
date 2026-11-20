import type { LyraAnchor } from './document-anchors.js';
import { TEXT_QUOTE_CONTEXT_CHARS } from './document-anchors.js';
import { getSegmenter } from './intl-cache.js';
import {
  SOFT_HYPHEN,
  TEXT_QUOTE_LIMITS,
  WHITESPACE_CHAR_RE,
  boundedRangeText,
  collapseWhitespaceAndSoftHyphen,
  nextNodeWithin,
  normalizeNfc,
  normalizeQuoteText,
  type TextQuoteLimits,
} from './text-selection.js';

export {
  TEXT_QUOTE_LIMITS,
  TEXT_SELECTION_RECT_LIMIT,
  boundedSelectionRects,
  boundedSelectionText,
  normalizeQuoteText,
  type TextQuoteLimits,
} from './text-selection.js';

const NORMALIZATION_SPECIAL_CHAR_RE = /[\s­]/u;

/** Host-supplied text-quote highlights a viewer resolves and paints in one pass. */
export const TEXT_QUOTE_PAINT_LIMIT = 100;

export const TEXT_QUOTE_TRAVERSAL_ALLOWANCE_MAX = 4096;

export function resolvedLimits(overrides?: Partial<TextQuoteLimits>): TextQuoteLimits {
  // Each limit clamps to its default; only the traversal limit may be raised, by a bounded allowance.
  const limits = {} as TextQuoteLimits;
  for (const key of Object.keys(TEXT_QUOTE_LIMITS) as (keyof TextQuoteLimits)[]) {
    const fallback = TEXT_QUOTE_LIMITS[key];
    const hardMaximum = key === 'maxTraversalNodes' ? fallback + TEXT_QUOTE_TRAVERSAL_ALLOWANCE_MAX : fallback;
    const value = overrides?.[key] ?? fallback;
    limits[key] = Number.isFinite(value) ? Math.min(hardMaximum, Math.max(0, Math.floor(value))) : hardMaximum;
  }
  return limits;
}

/** One DOM text node's contribution to a `TextQuoteScope`. `rawOffsetRuns` stores sparse pairs of
 *  `[normalizedOffset, rawOffset]` only where the otherwise-identity mapping changes (collapsed
 *  whitespace or removed soft hyphens). Ordinary text therefore retains no per-character map. */
interface TextQuoteSegment {
  node: Text;
  normalizedStart: number;
  normalizedLength: number;
  rawOffsetRuns: Uint32Array;
  /** Canonically changed graphemes as packed `[normalizedStart, normalizedEnd, rawStart, rawEnd]`. */
  rawClusterRuns?: Uint32Array;
  /** Raw node length at scope construction, used to fail closed after stale DOM mutations. */
  rawLength?: number;
  /** Exact raw node value and parent at scope construction, used to reject same-length edits and
   * detach/reparent operations without rebuilding the whole corpus during Range materialization. */
  rawText?: string;
  parentNode?: Node | null;
  previousSibling?: Node | null;
  nextSibling?: Node | null;
}

/** A bounded searchable corpus with a sparse offset map back to DOM positions. `truncated=true`
 * means later source content was not indexed, so a retained match count is only a lower bound. */
export interface TextQuoteScope {
  text: string;
  segments: TextQuoteSegment[];
  truncated: boolean;
  /** Sparse mapping from whole-scope NFC offsets back to the per-segment normalized coordinate. */
  globalNormalization?: TextOffsetMapping;
}

export interface TextOffsetMapping {
  text: string;
  /** Packed `[sourceStart, sourceEnd, mappedStart, mappedEnd]` entries. */
  expansions: Uint32Array | number[];
}

interface TrackedScopeRoot {
  readonly traversalLimit: number;
  readonly root: Node;
  readonly textInterval: readonly Text[];
  readonly textValues: readonly string[];
  readonly valid: boolean;
  readonly includesRootPrefix: boolean;
  readonly includesRootSuffix: boolean;
}

const scopeRoots = new WeakMap<TextQuoteScope, TrackedScopeRoot>();
const incrementalScopeFreshness = new WeakMap<TextQuoteScope, () => boolean>();
export const incrementalScopeChanges = new WeakMap<TextQuoteScope, { owner: object; stableEnd: number; settledEnd: number }>();

function trackScopeRoot(
  scope: TextQuoteScope,
  root: Node,
  includesRootPrefix = false,
  includesRootSuffix = false,
  traversalLimit: number = TEXT_QUOTE_LIMITS.maxTraversalNodes,
): TextQuoteScope {
  const first = scope.segments[0]?.node;
  const last = scope.segments.at(-1)?.node;
  if (!first || !last) return scope;
  let node: Node | null = includesRootPrefix ? nextNodeWithin(root, root, true) : first;
  const textInterval: Text[] = [];
  const textValues: string[] = [];
  let segmentIndex = 0;
  let traversed = 0;
  let reachedLast = false;
  let unexpectedItemText = false;
  while (node && traversed++ < traversalLimit) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      textInterval.push(text);
      textValues.push(text.data);
      if (text === scope.segments[segmentIndex]?.node) {
        segmentIndex++;
      } else if (!includesRootPrefix) {
        unexpectedItemText = true;
      }
      if (node === last) {
        reachedLast = true;
        if (!includesRootSuffix) break;
      }
    }
    const descend = !includesRootPrefix
      || node.nodeType !== Node.ELEMENT_NODE
      || !SKIP_TAGS.has((node as Element).tagName);
    node = nextNodeWithin(root, node, descend);
  }
  scopeRoots.set(scope, {
    root,
    traversalLimit,
    textInterval,
    valid: reachedLast
      && segmentIndex === scope.segments.length
      && !unexpectedItemText
      && (!includesRootSuffix || node === null),
    textValues,
    includesRootPrefix,
    includesRootSuffix,
  });
  return scope;
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

type HangulSyllableType = 'L' | 'V' | 'T' | 'LV' | 'LVT' | null;

function hangulSyllableType(character: string): HangulSyllableType {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return null;
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f)
    || (codePoint >= 0xa960 && codePoint <= 0xa97c)
  ) return 'L';
  if (
    (codePoint >= 0x1160 && codePoint <= 0x11a7)
    || (codePoint >= 0xd7b0 && codePoint <= 0xd7c6)
  ) return 'V';
  if (
    (codePoint >= 0x11a8 && codePoint <= 0x11ff)
    || (codePoint >= 0xd7cb && codePoint <= 0xd7fb)
  ) return 'T';
  if (codePoint < 0xac00 || codePoint > 0xd7a3) return null;
  return (codePoint - 0xac00) % 28 === 0 ? 'LV' : 'LVT';
}

function continuesHangulSyllable(previous: string, next: string): boolean {
  const previousType = hangulSyllableType(previous);
  const nextType = hangulSyllableType(next);
  return previousType === 'L'
    ? nextType === 'L' || nextType === 'V' || nextType === 'LV' || nextType === 'LVT'
    : previousType === 'LV' || previousType === 'V'
      ? nextType === 'V' || nextType === 'T'
      : (previousType === 'LVT' || previousType === 'T') && nextType === 'T';
}

function lastCodePoint(value: string): string | undefined {
  if (value.length === 0) return undefined;
  const last = value.charCodeAt(value.length - 1);
  const start = last >= 0xdc00
    && last <= 0xdfff
    && value.length > 1
    && value.charCodeAt(value.length - 2) >= 0xd800
    && value.charCodeAt(value.length - 2) <= 0xdbff
    ? value.length - 2
    : value.length - 1;
  return value.slice(start);
}

function firstVisibleCodePoint(value: string): string | undefined {
  for (const character of value) {
    if (character === SOFT_HYPHEN) continue;
    return WHITESPACE_CHAR_RE.test(character) ? ' ' : character;
  }
  return undefined;
}

function continuesPreviousGrapheme(
  previousCharacter: string | undefined,
  firstCharacter: string | undefined,
): boolean {
  if (firstCharacter === undefined) return false;
  const composesAcrossBoundary = previousCharacter !== undefined
    && normalizeNfc(`${previousCharacter}${firstCharacter}`)
      !== `${normalizeNfc(previousCharacter)}${normalizeNfc(firstCharacter)}`;
  return MARK_RE.test(firstCharacter)
    || firstCharacter === '\ufe0f'
    || firstCharacter === '\u200d'
    || previousCharacter === '\u200d'
    || (previousCharacter !== undefined && continuesHangulSyllable(previousCharacter, firstCharacter))
    || composesAcrossBoundary;
}

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
  let previousCharacter = '';
  for (const char of value) {
    const continuation = cluster !== '' && (
      MARK_RE.test(char)
      || char === '\ufe0f'
      || joinsNext
      || continuesHangulSyllable(previousCharacter, char)
    );
    if (!continuation && cluster) {
      yield { text: cluster, rawStart, rawEnd };
      cluster = '';
      rawStart = rawEnd;
    }
    cluster += char;
    rawEnd += char.length;
    joinsNext = char === '\u200d';
    previousCharacter = char;
  }
  if (cluster) yield { text: cluster, rawStart, rawEnd };
}

function normalizeScopeGlobally(scope: TextQuoteScope): TextQuoteScope {
  const normalized = normalizeNfc(scope.text);
  if (normalized === scope.text) return scope;
  const expansions: number[] = [];
  const chunks: string[] = [];
  let mappedStart = 0;
  for (const cluster of normalizationClusters(scope.text)) {
    const mapped = normalizeNfc(cluster.text);
    const mappedEnd = mappedStart + mapped.length;
    if (mapped !== cluster.text) {
      expansions.push(cluster.rawStart, cluster.rawEnd, mappedStart, mappedEnd);
    }
    chunks.push(mapped);
    mappedStart = mappedEnd;
  }
  const mapping: TextOffsetMapping = {
    text: chunks.join(''),
    expansions: Uint32Array.from(expansions),
  };
  scope.text = mapping.text;
  scope.globalNormalization = mapping;
  return scope;
}

function normalizeSegment(
  raw: string,
  maxOutputCodeUnits: number,
  maxWorkCodeUnits: number,
  initialLastWasSpace = false,
): NormalizedSegment {
  const inspectedLength = Math.min(raw.length, maxWorkCodeUnits);
  const inspected = raw.slice(0, inspectedLength);
  const nfc = normalizeNfc(inspected);
  const chunks: string[] = [];
  let chunk = '';
  let normalizedLength = 0;
  const rawOffsetRuns: number[] = [];
  const rawClusterRuns: number[] = [];
  let currentDelta = 0;
  let lastWasSpace = initialLastWasSpace;
  let outputTruncated = false;

  // The overwhelmingly common viewer corpus is already-NFC text without whitespace or soft
  // hyphens. Avoid one JavaScript callback/regular-expression probe per code unit in that case;
  // native normalize/test/slice keep the million-code-unit hard boundary practical on all three
  // engines while retaining the same UTF-16 coordinate semantics as the general path below.
  if (nfc === inspected && !NORMALIZATION_SPECIAL_CHAR_RE.test(inspected)) {
    const retainedLength = Math.min(inspected.length, maxOutputCodeUnits);
    const terminalRuns = retainedLength < inspected.length
      ? new Uint32Array([retainedLength, inspected.length])
      : new Uint32Array();
    return {
      text: inspected.slice(0, retainedLength),
      rawOffsetRuns: terminalRuns,
      rawClusterRuns: new Uint32Array(),
      workCodeUnits: inspectedLength,
      truncated: retainedLength < inspected.length || inspectedLength < raw.length,
      lastWasSpace: inspected.length === 0 ? initialLastWasSpace : false,
    };
  }

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
    // Same rule as appendUnit(), applied per run: text between special runs (lone U+0020 word
    // spaces included) keeps the identity mapping and is copied natively, so ordinary prose costs
    // no per-code-unit callback. Only soft hyphens and real whitespace runs are visited.
    const appendStretch = (start: number, end: number): boolean => {
      // A lone word space directly after a collapsed space (only possible at a segment start).
      if (lastWasSpace && start < end && inspected.charCodeAt(start) === 0x20) start++;
      const take = Math.min(end - start, Math.max(0, maxOutputCodeUnits - normalizedLength));
      if (take > 0) {
        const delta = start - normalizedLength;
        if (delta !== currentDelta) {
          rawOffsetRuns.push(normalizedLength, start);
          currentDelta = delta;
        }
        chunks.push(inspected.slice(start, start + take));
        normalizedLength += take;
        lastWasSpace = inspected.charCodeAt(start + take - 1) === 0x20;
      }
      return take === end - start;
    };
    const specialRuns = /[\s\u00AD]{2,}|[^\S ]|\u00AD/g;
    let rawIndex = 0;
    for (let run = specialRuns.exec(inspected); run; run = specialRuns.exec(inspected)) {
      if (!appendStretch(rawIndex, run.index)) {
        outputTruncated = true;
        break;
      }
      rawIndex = specialRuns.lastIndex;
      let firstSpace = run.index;
      while (firstSpace < rawIndex && inspected.charCodeAt(firstSpace) === 0xad) firstSpace++;
      // Soft hyphens alone vanish; whitespace collapses into one space unless one was just emitted.
      if (firstSpace === rawIndex || lastWasSpace) continue;
      if (normalizedLength >= maxOutputCodeUnits) {
        outputTruncated = true;
        break;
      }
      const delta = firstSpace - normalizedLength;
      if (delta !== currentDelta) {
        rawOffsetRuns.push(normalizedLength, firstSpace);
        currentDelta = delta;
      }
      chunks.push(' ');
      normalizedLength++;
      lastWasSpace = true;
    }
    if (!outputTruncated && !appendStretch(rawIndex, inspected.length)) outputTruncated = true;
  } else {
    for (const cluster of normalizationClusters(inspected)) {
      const normalizedCluster = normalizeNfc(cluster.text);
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
      let normalizedVisible = collapseWhitespaceAndSoftHyphen(normalizedCluster);
      if (lastWasSpace && normalizedVisible.startsWith(' ')) normalizedVisible = normalizedVisible.slice(1);
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

/** A text node's segment, with the node's text and position recorded so later DOM changes fail closed. */
function textSegment(
  node: Text,
  normalizedStart: number,
  normalizedLength: number,
  rawOffsetRuns: Uint32Array,
  rawClusterRuns: Uint32Array,
): TextQuoteSegment {
  return {
    node,
    normalizedStart,
    normalizedLength,
    rawOffsetRuns,
    rawClusterRuns,
    rawLength: node.data.length,
    rawText: node.data,
    parentNode: node.parentNode,
    previousSibling: node.previousSibling,
    nextSibling: node.nextSibling,
  };
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

/** Builds a scope by walking `root`'s text nodes in document order (skipping
 *  script/style/template/noscript), concatenating each node's normalized text. Callers pass their
 *  *content* element (e.g. markdown's `[part="content"]`) so toolbar chrome never enters the corpus. */
interface ElementScopeScan {
  scope: TextQuoteScope; segments: TextQuoteSegment[]; textChunks: string[];
  textInterval: Text[]; textValues: string[];
  textLength: number; textNodesVisited: number; traversalNodesVisited: number;
  workCodeUnits: number; lastWasSpace: boolean;
  segmentCount: number; intervalCount: number;
  normalization: { stableText: string; tail: string; sourceStart: number; expansions: number[]; expansionCount: number };
}

export function scopeFromElement(root: Element, limitOverrides?: Partial<TextQuoteLimits>, skipElement?: (element: Element) => boolean): TextQuoteScope {
  return scanElementScope(root, limitOverrides, skipElement).scope;
}

function scanElementScope(
  root: Element,
  limitOverrides?: Partial<TextQuoteLimits>,
  skipElement?: (element: Element) => boolean,
  prefix?: ElementScopeScan,
  start: Node | null = root.firstChild,
  stop: Node | null = null,
): ElementScopeScan {
  const limits = resolvedLimits(limitOverrides);
  const segments = prefix?.segments ?? [];
  const textChunks: string[] = [];
  const textInterval = prefix?.textInterval ?? [];
  const textValues = prefix?.textValues ?? [];
  if (prefix) { segments.length = prefix.segmentCount; textInterval.length = textValues.length = prefix.intervalCount; }
  let textLength = prefix?.textLength ?? 0;
  let textNodesVisited = prefix?.textNodesVisited ?? 0;
  let traversalNodesVisited = prefix?.traversalNodesVisited ?? 0;
  let workCodeUnits = prefix?.workCodeUnits ?? 0;
  let lastWasSpace = prefix?.lastWasSpace ?? false;
  let truncated = prefix?.scope.truncated ?? false;
  let node = start;
  if (segments.length) {
    const last = segments.at(-1)!;
    segments[segments.length - 1] = { ...last, nextSibling: last.node.nextSibling };
  }
  while (node && node !== stop && !truncated) {
    if (traversalNodesVisited >= limits.maxTraversalNodes) {
      truncated = true;
      break;
    }
    traversalNodesVisited++;
    const skipChildren = node.nodeType === Node.ELEMENT_NODE
      && (SKIP_TAGS.has((node as Element).tagName) || Boolean(skipElement?.(node as Element)));
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
    textInterval.push(textNode); textValues.push(textNode.data);
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
    segments.push(textSegment(textNode, textLength, segText.length, rawOffsetRuns, rawClusterRuns));
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
  // Only the final grapheme can change NFC when more text arrives. All earlier text and
  // offset entries are stable and remain shared until a retained DOM mutation resets the scan.
  const previous = prefix?.normalization;
  const expansions = previous?.expansions ?? [];
  expansions.length = previous?.expansionCount ?? 0;
  let stableText = previous?.stableText ?? '';
  let sourceStart = previous?.sourceStart ?? 0;
  const appended = (previous?.tail ?? '') + textChunks.join('');
  let tail = '';
  let pending: NormalizationCluster | undefined;
  const appendCluster = (cluster: NormalizationCluster): void => {
    const normalized = normalizeNfc(cluster.text);
    if (normalized !== cluster.text) expansions.push(sourceStart + cluster.rawStart, sourceStart + cluster.rawEnd,
      stableText.length, stableText.length + normalized.length);
    stableText += normalized;
  };
  if (normalizeNfc(appended) === appended) {
    let cut = appended.length;
    let following: string | undefined;
    while (cut > 0) {
      const character = lastCodePoint(appended.slice(0, cut))!;
      if (following !== undefined && !continuesPreviousGrapheme(character, following)) break;
      cut -= character.length; following = character;
    }
    stableText += appended.slice(0, cut);
    if (cut < appended.length) pending = { text: appended.slice(cut), rawStart: cut, rawEnd: appended.length };
  } else {
    for (const cluster of normalizationClusters(appended)) {
      if (pending) appendCluster(pending);
      pending = cluster;
    }
  }
  if (pending) tail = pending.text;
  const expansionCount = expansions.length;
  const nextSourceStart = sourceStart + (pending?.rawStart ?? 0);
  const finalText = stableText + normalizeNfc(tail);
  if (pending && normalizeNfc(tail) !== tail) expansions.push(nextSourceStart, sourceStart + pending.rawEnd,
    stableText.length, finalText.length);
  const scope: TextQuoteScope = { text: finalText, segments, truncated };
  if (expansions.length) scope.globalNormalization = { text: finalText, expansions };
  const normalization = { stableText, tail, sourceStart: nextSourceStart, expansions, expansionCount };
  if (scope.segments.length) scopeRoots.set(scope, { root, traversalLimit: limits.maxTraversalNodes,
    textInterval, textValues, valid: true, includesRootPrefix: true,
    includesRootSuffix: stop === null && !scope.truncated });
  return { scope, segments, textChunks, textInterval, textValues, textLength, textNodesVisited,
    traversalNodesVisited, workCodeUnits, lastWasSpace, segmentCount: segments.length, intervalCount: textInterval.length, normalization };
}

/** @internal Reuses normalized settled DOM prefixes; mutations inside that prefix reset the scan. */
export class IncrementalTextQuoteScope {
  private scan?: ElementScopeScan;
  private lastRoot?: ChildNode;
  private retainedRoots = new Set<Node>();
  private dirty = false;
  private generation = 0;
  private scopeIdentity = {};
  private mutationVersion = 0;
  private observer: MutationObserver;
  scannedNodes = 0;
  constructor(private readonly root: Element, private readonly limits?: Partial<TextQuoteLimits>) {
    const Observer = root.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
    this.observer = new Observer(records => this.observe(records));
    this.observer.observe(root, { childList: true, subtree: true, characterData: true });
  }
  private observe(records: readonly MutationRecord[]): void {
    if (records.length) this.mutationVersion++;
    for (const record of records) {
      if (record.target === this.root) {
        if ([...record.removedNodes].some(node => this.retainedRoots.has(node)) ||
          record.nextSibling && this.retainedRoots.has(record.nextSibling)) this.dirty = true;
      } else {
        let node: Node | null = record.target;
        while (node?.parentNode && node.parentNode !== this.root) node = node.parentNode;
        if (node && this.retainedRoots.has(node)) this.dirty = true;
      }
    }
  }
  /** The optional boundary keeps a mutable trailing preview out of the retained prefix; it is rescanned in the returned scope. */
  update(stop: ChildNode | null = null): TextQuoteScope {
    this.observe(this.observer.takeRecords());
    const generation = ++this.generation;
    if (this.lastRoot && this.lastRoot.parentNode !== this.root) this.dirty = true;
    const prefix = this.dirty ? undefined : this.scan;
    if (!prefix) this.scopeIdentity = {};
    const start = prefix && this.lastRoot ? this.lastRoot.nextSibling : this.root.firstChild;
    const next = scanElementScope(this.root, this.limits, undefined, prefix, start, stop);
    this.scannedNodes += next.traversalNodesVisited - (prefix?.traversalNodesVisited ?? 0);
    this.scan = next; this.dirty = false;
    if (!prefix) { this.retainedRoots.clear(); this.lastRoot = undefined; }
    for (let node = start as ChildNode | null; node && node !== stop; node = node.nextSibling) {
      this.retainedRoots.add(node); this.lastRoot = node;
    }
    while (this.lastRoot?.nodeType === Node.COMMENT_NODE) {
      this.retainedRoots.delete(this.lastRoot);
      this.lastRoot = this.lastRoot.previousSibling ?? undefined;
    }
    const complete = stop ? scanElementScope(this.root, this.limits, undefined, next, stop) : next;
    this.scannedNodes += complete.traversalNodesVisited - next.traversalNodesVisited;
    const mutationVersion = this.mutationVersion;
    incrementalScopeFreshness.set(complete.scope, () => {
      this.observe(this.observer.takeRecords());
      return generation === this.generation && mutationVersion === this.mutationVersion;
    });
    incrementalScopeChanges.set(complete.scope, { owner: this.scopeIdentity, stableEnd: prefix?.normalization.stableText.length ?? 0, settledEnd: next.normalization.stableText.length });
    return complete.scope;
  }
  disconnect(): void {
    this.generation++; this.observer.disconnect(); this.scan = undefined; this.retainedRoots.clear(); this.lastRoot = undefined;
  }
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

/** Builds a scope from ordered text-layer items joined in reading order. Normalizes each item's
 *  authoritative `text` and maps offsets into its explicit direct `node`, or into `element`'s first
 *  text child when `node` is omitted. `joinBefore=false` preserves contiguous nested text within
 *  one peer text run; otherwise a word-space is synthesized unless the boundary continues one
 *  Unicode grapheme. An item with no usable text node is skipped. */
export function scopeFromItems(
  items: { text: string; element: Element; node?: Text; joinBefore?: boolean }[],
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
    const located = item.node
      ? { node: item.node, inspected: 1, truncated: false }
      : firstTextNode(
          item.element,
          Math.max(0, limits.maxTraversalNodes - traversalNodesVisited),
        );
    traversalNodesVisited += located.inspected;
    if (located.truncated || traversalNodesVisited > limits.maxTraversalNodes) {
      truncated = true;
      break;
    }
    const node = located.node;
    if (!node) {
      if (item.text !== '') {
        truncated = true;
        break;
      }
      continue;
    }
    if (item.node && item.node.parentElement !== item.element) {
      truncated = true;
      break;
    }
    if (item.text !== node.data) {
      truncated = true;
      break;
    }
    const workRemaining = Math.max(0, limits.maxNormalizationWorkCodeUnits - workCodeUnits);
    if (workRemaining === 0) {
      truncated = true;
      break;
    }
    const previousCharacter = lastCodePoint(textChunks.at(-1) ?? '');
    const rawFirstCharacter = firstVisibleCodePoint(item.text);
    const reservesSyntheticJoin = item.joinBefore !== false
      && textLength > 0
      && !lastWasSpace
      && rawFirstCharacter !== ' '
      && !continuesPreviousGrapheme(previousCharacter, rawFirstCharacter);
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
        Math.max(0, limits.maxCorpusCodeUnits - textLength - (reservesSyntheticJoin ? 1 : 0)),
        Math.min(limits.maxNodeCodeUnits, workRemaining),
        lastWasSpace,
      );
    workCodeUnits += used;
    const firstCharacter = segText[Symbol.iterator]().next().value as string | undefined;
    const continuesPreviousCluster = continuesPreviousGrapheme(previousCharacter, firstCharacter);
    const needsSyntheticJoin = textLength > 0
      && item.joinBefore !== false
      && !lastWasSpace
      && !segText.startsWith(' ')
      && !continuesPreviousCluster;
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
    segments.push(textSegment(node, textLength, segText.length, rawOffsetRuns, rawClusterRuns));
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
  const scope = normalizeScopeGlobally({ text: textChunks.join(''), segments, truncated });
  const commonRoot = commonAncestorOfSegments(segments);
  if (commonRoot) return trackScopeRoot(scope, commonRoot);
  if (segments.length > 0) {
    scope.truncated = true;
    scopeRoots.set(scope, {
      root: segments[0]!.node,
      textInterval: [],
      textValues: [],
      valid: false,
      includesRootPrefix: false,
      includesRootSuffix: false,
      traversalLimit: TEXT_QUOTE_LIMITS.maxTraversalNodes,
    });
  }
  return scope;
}

function commonAncestorOfSegments(segments: readonly TextQuoteSegment[]): Node | null {
  const first = segments[0]?.node;
  const last = segments.at(-1)?.node;
  if (!first || !last) return null;
  const ancestors = new Set<Node>();
  let cursor: Node | null = first;
  let visited = 0;
  while (cursor && visited++ < TEXT_QUOTE_LIMITS.maxTraversalNodes) {
    ancestors.add(cursor);
    cursor = cursor.parentNode;
  }
  if (cursor) return null;
  cursor = last;
  visited = 0;
  while (cursor && !ancestors.has(cursor) && visited++ < TEXT_QUOTE_LIMITS.maxTraversalNodes) {
    cursor = cursor.parentNode;
  }
  return cursor && ancestors.has(cursor) ? cursor : null;
}

/** @internal A grapheme segmenter for `locale`, falling back to the default locale. */
export function segmenterFor(locale?: string): Intl.Segmenter {
  try {
    return getSegmenter(locale, { granularity: 'grapheme' });
  } catch (error) {
    if (error instanceof RangeError) {
      return getSegmenter(undefined, { granularity: 'grapheme' });
    }
    throw error;
  }
}

/** Index of the last of `count` ascending keys at or before `target` (strictly before it when
 *  `strict`), or -1 when none is. */
function lastIndexAtOrBefore(count: number, keyAt: (index: number) => number, target: number, strict = false): number {
  let lo = 0;
  let hi = count - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const key = keyAt(mid);
    if (strict ? key < target : key <= target) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Maps an offset across packed `[rawStart, rawEnd, foldedStart, foldedEnd]` expansions. `fromFolded`
 * maps a folded offset to raw (otherwise raw to folded); `end` maps an end boundary, which stays
 * inside an expansion up to and including its end, where a start boundary only stays before it.
 */
export function mapExpandedOffset(mapping: { readonly expansions: ArrayLike<number> }, offset: number, fromFolded: boolean, end: boolean): number {
  const { expansions } = mapping;
  const column = fromFolded ? 2 : 0;
  const found = lastIndexAtOrBefore(expansions.length >> 2, index => expansions[index * 4 + column]!, offset, end);
  if (found < 0) return offset;
  const at = found * 4;
  const rawEnd = expansions[at + 1]!;
  const foldedEnd = expansions[at + 3]!;
  const sideEnd = fromFolded ? foldedEnd : rawEnd;
  if (end ? offset <= sideEnd : offset < sideEnd) return expansions[at + (fromFolded ? 0 : 2) + (end ? 1 : 0)]!;
  return fromFolded ? offset - (foldedEnd - rawEnd) : offset + (foldedEnd - rawEnd);
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

function rawOffsetAt(segment: TextQuoteSegment, normalizedOffset: number): number {
  const runs = segment.rawOffsetRuns;
  const found = lastIndexAtOrBefore(runs.length >> 1, index => runs[index * 2]!, normalizedOffset);
  if (found < 0) return normalizedOffset;
  return runs[found * 2 + 1]! + normalizedOffset - runs[found * 2]!;
}

interface RawClusterRun {
  normalizedStart: number;
  normalizedEnd: number;
  rawStart: number;
  rawEnd: number;
}

/** The canonically changed grapheme run containing `offset`, read as a raw offset when `raw`,
 *  otherwise as a normalized one. */
function clusterAt(segment: TextQuoteSegment, offset: number, raw: boolean): RawClusterRun | null {
  const runs = segment.rawClusterRuns ?? new Uint32Array();
  const column = raw ? 2 : 0;
  const found = lastIndexAtOrBefore(runs.length >> 2, index => runs[index * 4 + column]!, offset);
  if (found < 0 || offset >= runs[found * 4 + column + 1]!) return null;
  const at = found * 4;
  return {
    normalizedStart: runs[at]!,
    normalizedEnd: runs[at + 1]!,
    rawStart: runs[at + 2]!,
    rawEnd: runs[at + 3]!,
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
  const cluster = clusterAt(segment, rawOffset, true);
  if (cluster) {
    if (rawOffset === cluster.rawStart) return cluster.normalizedStart;
    return endBoundary ? cluster.normalizedEnd : cluster.normalizedStart;
  }
  return normalizedOffsetAtOrAfterRaw(segment, rawOffset);
}

/** Binary-searches `scope.segments` (sorted by `normalizedStart`) for the segment containing
 *  `normalizedOffset`, then maps it to a DOM position through that segment's sparse offset runs. */
function segmentIndexAt(scope: TextQuoteScope, normalizedOffset: number): number {
  const { segments } = scope;
  return lastIndexAtOrBefore(segments.length, index => segments[index]!.normalizedStart, normalizedOffset);
}

function segmentIsFresh(segment: TextQuoteSegment): boolean {
  if (segment.rawLength !== undefined && segment.node.data.length !== segment.rawLength) return false;
  if (segment.rawText !== undefined && segment.node.data !== segment.rawText) return false;
  if (segment.parentNode !== undefined && segment.node.parentNode !== segment.parentNode) return false;
  if (segment.previousSibling !== undefined && segment.node.previousSibling !== segment.previousSibling) return false;
  if (segment.nextSibling !== undefined && segment.node.nextSibling !== segment.nextSibling) return false;
  return true;
}

function scopeStructureIsFresh(scope: TextQuoteScope): boolean {
  const incremental = incrementalScopeFreshness.get(scope);
  if (incremental) return incremental();
  const tracked = scopeRoots.get(scope);
  if (tracked && !tracked.valid) return false;
  for (const segment of scope.segments) {
    if (!segmentIsFresh(segment)) return false;
  }
  // Hand-built scopes have no root interval to validate, but their optional per-segment
  // provenance still has to be honoured. Generated scopes continue with the complete bounded
  // root/interval check below.
  if (!tracked) return true;
  const first = tracked.textInterval[0];
  const last = tracked.textInterval.at(-1);
  if (!first || !last || !tracked.root.contains(first) || !tracked.root.contains(last)) return false;
  let node: Node | null = tracked.includesRootPrefix
    ? nextNodeWithin(tracked.root, tracked.root, true)
    : first;
  let textIndex = 0;
  let traversed = 0;
  while (node && traversed++ < tracked.traversalLimit) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (
        node !== tracked.textInterval[textIndex]
        || (node as Text).data !== tracked.textValues[textIndex]
      ) return false;
      textIndex++;
      if (!tracked.includesRootSuffix && node === last) break;
    }
    const descend = !tracked.includesRootPrefix
      || node.nodeType !== Node.ELEMENT_NODE
      || !SKIP_TAGS.has((node as Element).tagName);
    node = nextNodeWithin(tracked.root, node, descend);
  }
  return (tracked.includesRootSuffix ? node === null : node === last)
    && textIndex === tracked.textInterval.length;
}

/** Maps between whole-scope NFC offsets and per-segment normalized offsets (identity when unmapped). */
function mapScopeOffset(scope: TextQuoteScope, offset: number, fromFolded: boolean, end: boolean): number {
  return scope.globalNormalization ? mapExpandedOffset(scope.globalNormalization, offset, fromFolded, end) : offset;
}

function locate(
  scope: TextQuoteScope,
  normalizedOffset: number,
  endCharacter: boolean,
): { node: Text; offset: number } | null {
  if (!Number.isInteger(normalizedOffset) || normalizedOffset < 0 || normalizedOffset >= scope.text.length) {
    return null;
  }
  const sourceOffset = endCharacter
    ? mapScopeOffset(scope, normalizedOffset + 1, true, true) - 1
    : mapScopeOffset(scope, normalizedOffset, true, false);
  const found = segmentIndexAt(scope, sourceOffset);
  if (found === -1) return null;
  const segment = scope.segments[found]!; // safe: found is an in-bounds index (set from mid, != -1)
  const local = sourceOffset - segment.normalizedStart;
  if (local < 0 || local >= segment.normalizedLength) return null;
  const cluster = clusterAt(segment, local, false);
  const offset = cluster
    ? endCharacter ? cluster.rawEnd - 1 : cluster.rawStart
    : rawOffsetAt(segment, local);
  const rawLength = segment.rawLength ?? segment.node.data.length;
  return offset >= 0 && offset < rawLength ? { node: segment.node, offset } : null;
}

export function rangeFromOffsets(
  scope: TextQuoteScope,
  start: number,
  end: number,
  validateScope = true,
): Range | null {
  if (
    !Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end <= start
    || end > scope.text.length
  ) return null;
  const sourceStart = mapScopeOffset(scope, start, true, false);
  const sourceEnd = mapScopeOffset(scope, end, true, true);
  const startSegment = segmentIndexAt(scope, sourceStart);
  const endSegment = segmentIndexAt(scope, sourceEnd - 1);
  if (startSegment < 0 || endSegment < startSegment) return null;
  if (endSegment - startSegment + 1 > TEXT_QUOTE_LIMITS.maxNodes) return null;
  if (validateScope && !scopeStructureIsFresh(scope)) return null;
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

/** Materializes one `TextQuoteMatch` into a live `Range`, or null if the scope no longer covers
 *  those offsets (the document changed since the match was found). */
export function rangeFromTextQuoteMatch(scope: TextQuoteScope, match: TextQuoteMatch): Range | null {
  if (!match || typeof match !== 'object') return null;
  try {
    return rangeFromOffsets(scope, match.start, match.end);
  } catch {
    return null;
  }
}

/** Materializes a bounded synchronous batch after validating the scope exactly once. Match
 * access happens before provenance validation, so a hostile getter that mutates the DOM makes the
 * entire batch fail closed. The returned array preserves the admitted input positions with nulls
 * for malformed/unmappable matches; inputs beyond the retained-match ceiling are not inspected. */
export function rangesFromTextQuoteMatches(
  scope: TextQuoteScope,
  matches: readonly (TextQuoteMatch | null | undefined)[],
): Array<Range | null> {
  let inputLength: number;
  try {
    inputLength = matches.length;
  } catch {
    return [];
  }
  if (!Number.isInteger(inputLength) || inputLength < 0) return [];
  const count = Math.min(inputLength, TEXT_QUOTE_LIMITS.maxMatches);
  const offsets = new Float64Array(count * 2);
  const present = new Uint8Array(count);
  for (let index = 0; index < count; index++) {
    try {
      const match = matches[index];
      if (!match || typeof match !== 'object') continue;
      offsets[index * 2] = match.start;
      offsets[index * 2 + 1] = match.end;
      present[index] = 1;
    } catch {
      // A malformed record fails only its own position. Provenance is checked after every record
      // has been read, so a getter-triggered DOM mutation still rejects every otherwise-valid one.
    }
  }
  const ranges = Array<Range | null>(count).fill(null);
  try {
    if (!scopeStructureIsFresh(scope)) return ranges;
    for (let index = 0; index < count; index++) {
      if (present[index] === 0) continue;
      ranges[index] = rangeFromOffsets(
        scope,
        offsets[index * 2]!,
        offsets[index * 2 + 1]!,
        false,
      );
    }
  } catch {
    // DOM peers can throw while materializing a Range. Fail the whole batch closed so callers do
    // not paint a prefix whose exactness depends on where the exception occurred.
    ranges.fill(null);
  }
  return ranges;
}

/** Resolves a DOM boundary point `(container, offset)` to a concrete `(Text node, offset)` pair.
 *  `container` is already a Text node for a Selection-derived Range, but a Range built via
 *  `selectNodeContents(element)` reports the element itself with `offset` as a child index, so that
 *  case is resolved from the already-bounded scope segments, never recursive DOM descent: a start
 *  resolves to the first text of the child at `offset`, an end (one past the last included child
 *  index) to the full length of the last text of the child immediately before it. */
function resolveBoundaryTextNode(
  container: Node,
  offset: number,
  scope: TextQuoteScope,
  end: boolean,
): { node: Text; offset: number } | null {
  if (container.nodeType === Node.TEXT_NODE) return { node: container as Text, offset };
  const child = container.childNodes[end ? offset - 1 : offset];
  if (!child) return null;
  let traversalRemaining = TEXT_QUOTE_LIMITS.maxTraversalNodes;
  const { segments } = scope;
  for (let step = 0; step < segments.length; step++) {
    const segment = segments[end ? segments.length - 1 - step : step]!;
    let cursor: Node | null = segment.node;
    while (cursor && traversalRemaining > 0) {
      traversalRemaining--;
      if (cursor === child) return { node: segment.node, offset: end ? segment.node.data.length : 0 };
      if (cursor === container) break;
      cursor = cursor.parentNode;
    }
    if (traversalRemaining === 0) return null;
  }
  return null;
}

/** Maps a range's start (or, with `end`, its exclusive end) boundary to a normalized scope offset. */
function findRangeBoundaryInScope(scope: TextQuoteScope, range: Range, end: boolean): number | null {
  const boundary = end
    ? resolveBoundaryTextNode(range.endContainer, range.endOffset, scope, true)
    : resolveBoundaryTextNode(range.startContainer, range.startOffset, scope, false);
  if (!boundary) return null;
  const segment = scope.segments.find((s) => s.node === boundary.node);
  if (!segment) return null;
  if (boundary.offset < 0 || boundary.offset > boundary.node.data.length) return null;
  const local = normalizedBoundaryAtRaw(segment, boundary.offset, end);
  return mapScopeOffset(scope, segment.normalizedStart + local, false, end);
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
export function buildQuoteAnchor(range: Range, scope: TextQuoteScope): LyraAnchor {
  const startOffset = findRangeBoundaryInScope(scope, range, false);
  const endOffset = findRangeBoundaryInScope(scope, range, true);
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
