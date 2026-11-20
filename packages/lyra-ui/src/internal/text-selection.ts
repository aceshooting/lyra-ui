/**
 * Bounded selection reading shared by text-quote anchors and selection observers: text and client
 * rects of a Range under fixed ceilings, without `Range#toString()` or an unbounded rect list. A
 * leaf below `text-quote.ts`, so a selection-only consumer does not pull the quote resolver.
 */
import type { TextSelectRect } from './document-anchors.js';

export const SOFT_HYPHEN = '­';
// ECMAScript's `\s` already covers every Unicode Space_Separator code point plus NBSP and
// ZWNBSP (see the WhiteSpace production in the spec), so it needs no custom character class.
export const WHITESPACE_CHAR_RE = /\s/u;

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
  // At least an exact and a folded entry for every quote of a full paint pass
  // (TEXT_QUOTE_PAINT_LIMIT), plus room for search queries, so repainting never re-scans.
  maxCacheEntries: 256,
});

/** NFC-normalizes, strips soft hyphens, collapses every whitespace run to one ASCII space, and
 *  trims. The single normalization used for a whole standalone string -- an anchor's `quote`/
 *  `prefix`/`suffix`, or a fully-selected Range's text. Building a scope's own per-node corpus uses
 *  a related, non-trimming variant internally (see `normalizeSegment`) so inter-node spacing survives. */
export function normalizeQuoteText(s: string): string {
  return normalizeNfc(collapseWhitespaceAndSoftHyphen(s).trim());
}

export function normalizeNfc(value: string): string {
  // A text node can end halfway through a surrogate pair. Some engines replace that half
  // during normalization, losing the code point before adjacent nodes can be joined.
  return /[\ud800-\udfff]/u.test(value)
    ? value.replace(/[^\ud800-\udfff]+/gu, text => text.normalize('NFC'))
    : value.normalize('NFC');
}

export function collapseWhitespaceAndSoftHyphen(s: string): string {
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

export function nextNodeWithin(root: Node, node: Node, descend: boolean): Node | null {
  if (descend && node.firstChild) return node.firstChild;
  let current: Node | null = node;
  while (current && current !== root) {
    if (current.nextSibling) return current.nextSibling;
    current = current.parentNode;
  }
  return null;
}

export function boundedRangeText(range: Range, maxCodeUnits: number): string {
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
): readonly TextSelectRect[] {
  const bounded = Number.isFinite(maxRects)
    ? Math.min(TEXT_SELECTION_RECT_LIMIT, Math.max(0, Math.floor(maxRects)))
    : TEXT_SELECTION_RECT_LIMIT;
  const output: TextSelectRect[] = [];
  for (const rect of range.getClientRects()) {
    if (output.length >= bounded) break;
    const finite = (value: number): number => Number.isFinite(value) ? value : 0;
    output.push(Object.freeze({
      x: finite(rect.x),
      y: finite(rect.y),
      width: finite(rect.width),
      height: finite(rect.height),
      top: finite(rect.top),
      right: finite(rect.right),
      bottom: finite(rect.bottom),
      left: finite(rect.left),
    }));
  }
  return Object.freeze(output);
}
