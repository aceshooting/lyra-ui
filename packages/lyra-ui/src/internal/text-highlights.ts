import type { LyraHighlight, LyraHighlightTone } from './document-anchors.js';
import { prioritizedHighlightCandidates } from './anchor-target.js';
import { rangesFromTextQuoteMatches, TEXT_QUOTE_LIMITS, TEXT_QUOTE_PAINT_LIMIT, type TextQuoteMatch } from './text-quote.js';
import type { TextQuoteIndex } from './text-quote-index.js';
import { TEXT_SELECTION_RECT_LIMIT } from './text-selection.js';
import { HIGHLIGHT_TONES } from './highlight-collection.js';
import { finiteDuration } from './numbers.js';

/** Every tone, in paint order. A repaint sets each one, so a tone a pass leaves out is cleared. */
export { HIGHLIGHT_TONES };
const DEFAULT_FLASH_MS = 1800; // mirrors --lr-transition-ambient's default duration (see tokens.styles.ts)
/** The fallback mutates the DOM once per retained Range, so it shares the viewer search paint cap. */
const FALLBACK_RANGE_LIMIT = 200;
const FALLBACK_MARK_LIMIT = 200;

export interface TextMarkPaintBudget {
  traversalNodes: number;
  codeUnits: number;
  marks: number;
}

/** Minimal shape of the CSS Custom Highlight API's `Highlight` this module needs -- declared locally
 *  (not as a global augmentation) since this toolchain's DOM lib typings don't yet include it. */
interface CustomHighlightLike {
  priority: number;
  add(range: Range): void;
  delete(range: Range): boolean;
}
interface HighlightRegistryLike {
  set(name: string, highlight: CustomHighlightLike): void;
}

interface HighlightRealm {
  ctor: new () => CustomHighlightLike;
  registry: HighlightRegistryLike;
}

interface HighlightDocumentState extends HighlightRealm {
  highlightObjects: Map<string, CustomHighlightLike>;
  ownersByName: Map<string, Map<object, Set<Range>>>;
}

const documentStates = new WeakMap<Document, HighlightDocumentState>();
const failedDocumentRealms = new WeakMap<Document, HighlightRealm>();

function defaultDocument(): Document | null {
  return typeof document === 'undefined' ? null : document;
}

function highlightRealm(doc: Document | null): HighlightRealm | null {
  const view = doc?.defaultView;
  if (!view) return null;
  const globals = view as unknown as {
    Highlight?: new () => CustomHighlightLike;
    CSS?: { highlights?: HighlightRegistryLike };
  };
  const ctor = globals.Highlight;
  const registry = globals.CSS?.highlights;
  return typeof ctor === 'function' && registry && typeof registry.set === 'function'
    ? { ctor, registry }
    : null;
}

function matchesRealm(left: HighlightRealm | undefined, right: HighlightRealm): boolean {
  return left?.ctor === right.ctor && left.registry === right.registry;
}

/** Whether the CSS Custom Highlight API (`Highlight` + `CSS.highlights`) is available in `doc`.
 * Passing a document is owner-realm exact; omitting it retains the ambient convenience check used
 * by existing callers and returns `false` during SSR. */
export function supportsCustomHighlights(doc: Document | null = defaultDocument()): boolean {
  const realm = highlightRealm(doc);
  return realm !== null && (!doc || !matchesRealm(failedDocumentRealms.get(doc), realm));
}

function highlightName(tone: LyraHighlightTone): string {
  return `lr-highlight-${tone}`;
}

/** Creates and registers every document-global `Highlight` object this module owns
 *  (`lr-highlight-accent|success|warning|danger|neutral`, `lr-highlight-active`,
 *  `lr-highlight-flash`) once per owner document, lazily inside the first
 *  `acquireHighlightHandle()` call -- never at module evaluation, so importing an adopting
 *  viewer's class module stays SSR/node-safe. */
function stateForDocument(doc: Document, realm: HighlightRealm): HighlightDocumentState {
  const existing = documentStates.get(doc);
  if (existing?.ctor === realm.ctor && existing.registry === realm.registry) return existing;
  const state: HighlightDocumentState = {
    ...realm,
    highlightObjects: new Map(),
    ownersByName: new Map(),
  };
  const entries: [string, number][] = [
    ...HIGHLIGHT_TONES.map((tone): [string, number] => [highlightName(tone), 0]),
    ['lr-highlight-active', 1],
    ['lr-highlight-flash', 2],
  ];
  for (const [name, priority] of entries) {
    const highlight = new realm.ctor();
    highlight.priority = priority;
    state.highlightObjects.set(name, highlight);
    state.ownersByName.set(name, new Map());
    realm.registry.set(name, highlight);
  }
  documentStates.set(doc, state);
  return state;
}

function replaceCssOwned(
  state: HighlightDocumentState,
  name: string,
  owner: object,
  ranges: Range[],
): void {
  const highlight = state.highlightObjects.get(name);
  const owners = state.ownersByName.get(name);
  if (!highlight || !owners) return;
  const previous = owners.get(owner);
  if (previous) for (const r of previous) highlight.delete(r);
  const next = new Set(ranges);
  for (const r of next) highlight.add(r);
  if (next.size > 0) owners.set(owner, next);
  else owners.delete(owner);
}

/** A paint handle for one owner (typically `this` of an adopting viewer). */
export interface HighlightHandle {
  /** Replaces this owner's painted ranges for one tone; a previous call for the same tone is
   *  dropped first, so `setRanges(tone, [])` clears that tone for this owner. */
  setRanges(tone: LyraHighlightTone, ranges: Range[]): void;
  /** Marks (or clears, with `null`) this owner's single active-state range. */
  setActive(range: Range | null): void;
  /** Applies a one-shot emphasis flash to `range` for `durationMs` (default 1800, matching
   *  `--lr-transition-ambient`'s default), then clears it automatically. `durationMs` is routed
   *  through `finiteDuration()`: a non-finite value (`NaN`/`Infinity`, e.g. from an untyped
   *  caller) falls back to the 1800ms default rather than firing immediately or never, and a
   *  negative value clamps to 0 -- the clear still runs on a fresh async timer, never inline. */
  flash(range: Range, durationMs?: number): void;
  /** Removes every range this owner painted, across every tone/active/flash state. */
  release(): void;
}

// -- fallback (no Custom Highlight API): <mark> wrap/unwrap, hypothesis-style ------------------

function splitTextNodeAtRange(range: Range, textNode: Text): Text {
  const start = textNode === range.startContainer ? range.startOffset : 0;
  const end = textNode === range.endContainer ? range.endOffset : textNode.data.length;
  let target = textNode;
  if (end < target.data.length) target.splitText(end); // trailing remainder becomes a new sibling
  if (start > 0) target = target.splitText(start); // returns the in-range remainder
  return target;
}

function nextNodeWithin(node: Node, root: Node): Node | null {
  if (node.firstChild) return node.firstChild;
  let cursor: Node | null = node;
  while (cursor && cursor !== root) {
    if (cursor.nextSibling) return cursor.nextSibling;
    cursor = cursor.parentNode;
  }
  return null;
}

/** Wrap a complete bounded text range and let the caller decorate each mark. */
export function wrapTextRangeInMarks(
  range: Range,
  doc: Document,
  budget: TextMarkPaintBudget,
  decorate: (mark: HTMLElement) => void,
): HTMLElement[] {
  if (budget.marks <= 0) return [];
  const ancestor = range.commonAncestorContainer;
  const view = doc.defaultView;
  const textNodeType = view?.Node.TEXT_NODE ?? 3;
  const covered: Text[] = [];
  let node: Node | null = ancestor;
  while (node && budget.traversalNodes > 0 && budget.codeUnits > 0) {
    budget.traversalNodes--;
    if (node.nodeType === textNodeType) {
      const textNode = node as Text;
      if (textNode.data.length > budget.codeUnits) {
        budget.codeUnits = 0;
        break;
      }
      budget.codeUnits -= textNode.data.length;
      try {
        if (textNode.data.length > 0 && range.intersectsNode(textNode)) {
          covered.push(textNode);
          if (covered.length > budget.marks) return [];
        }
      } catch {
        // A stale host Range is wholly unpaintable; never wrap a prefix collected before failure.
        return [];
      }
    }
    node = nextNodeWithin(node, ancestor);
  }
  // Never turn a citation into a shorter, incorrect one when the aggregate walk could not prove
  // that it reached the Range's complete common ancestor.
  if (node) return [];
  const marks: HTMLElement[] = [];
  for (const textNode of covered) {
    const inRange = splitTextNodeAtRange(range, textNode);
    if (!inRange.data) continue;
    const mark = doc.createElement('mark');
    decorate(mark);
    inRange.parentNode?.insertBefore(mark, inRange);
    mark.appendChild(inRange);
    marks.push(mark);
    budget.marks--;
    if (budget.marks <= 0) break;
  }
  return marks;
}

export function unwrapTextMark(mark: HTMLElement): void {
  const parent = mark.parentNode;
  if (!parent) return;
  const before = mark.previousSibling;
  const firstMoved = mark.firstChild;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  const after = mark.nextSibling;
  parent.removeChild(mark);
  let cursor = before?.nodeType === Node.TEXT_NODE ? before : firstMoved ?? after;
  let localSteps = 0;
  while (cursor && cursor.parentNode === parent && localSteps++ < 4) {
    if (cursor.nodeType !== Node.TEXT_NODE) break;
    const text = cursor as Text;
    if (text.data === '') {
      const next = text.nextSibling;
      text.remove();
      cursor = next;
      continue;
    }
    const next = text.nextSibling;
    if (next?.nodeType !== Node.TEXT_NODE) break;
    text.appendData((next as Text).data);
    next.remove();
  }
}

function acquireFallbackHandle(doc: Document, part: string | undefined): HighlightHandle {
  const marksByName = new Map<string, HTMLElement[]>();
  const view = doc.defaultView;

  function clear(name: string): void {
    for (const mark of marksByName.get(name) ?? []) unwrapTextMark(mark);
    marksByName.set(name, []);
  }

  function paint(name: string, tone: LyraHighlightTone, ranges: Range[]): void {
    clear(name);
    const marks: HTMLElement[] = [];
    const budget: TextMarkPaintBudget = {
      traversalNodes: TEXT_QUOTE_LIMITS.maxTraversalNodes,
      codeUnits: TEXT_QUOTE_LIMITS.maxCorpusCodeUnits,
      marks: FALLBACK_MARK_LIMIT,
    };
    const count = Math.min(ranges.length, FALLBACK_RANGE_LIMIT);
    for (let index = 0; index < count && budget.traversalNodes > 0 && budget.codeUnits > 0 && budget.marks > 0; index++) {
      marks.push(...wrapTextRangeInMarks(ranges[index]!, doc, budget, (mark) => {
        mark.setAttribute('data-lr-highlight-tone', tone);
        mark.setAttribute('data-lr-highlight-name', name);
        mark.setAttribute('role', 'mark');
        if (part) mark.setAttribute('part', part);
      }));
    }
    marksByName.set(name, marks);
  }

  let flashTimer: number | undefined;
  let flashGeneration = 0;

  function cancelFlashTimer(): void {
    flashGeneration += 1;
    if (flashTimer !== undefined) view?.clearTimeout(flashTimer);
    flashTimer = undefined;
  }

  return {
    setRanges(tone, ranges) {
      paint(highlightName(tone), tone, ranges);
    },
    setActive(range) {
      paint('lr-highlight-active', 'accent', range ? [range] : []);
    },
    flash(range, durationMs = DEFAULT_FLASH_MS) {
      cancelFlashTimer();
      paint('lr-highlight-flash', 'accent', [range]);
      if (!view) return;
      const generation = flashGeneration;
      let handle = 0;
      handle = view.setTimeout(() => {
        if (generation !== flashGeneration || flashTimer !== handle) return;
        flashTimer = undefined;
        clear('lr-highlight-flash');
      }, finiteDuration(durationMs, DEFAULT_FLASH_MS));
      flashTimer = handle;
    },
    release() {
      cancelFlashTimer();
      for (const name of marksByName.keys()) clear(name);
    },
  };
}

function acquireCssHandle(
  owner: object,
  state: HighlightDocumentState,
  view: Window,
): HighlightHandle {
  let flashTimer: number | undefined;
  let flashGeneration = 0;

  function cancelFlashTimer(): void {
    flashGeneration += 1;
    if (flashTimer !== undefined) view.clearTimeout(flashTimer);
    flashTimer = undefined;
  }

  return {
    setRanges(tone, ranges) {
      replaceCssOwned(state, highlightName(tone), owner, ranges);
    },
    setActive(range) {
      replaceCssOwned(state, 'lr-highlight-active', owner, range ? [range] : []);
    },
    flash(range, durationMs = DEFAULT_FLASH_MS) {
      cancelFlashTimer();
      replaceCssOwned(state, 'lr-highlight-flash', owner, [range]);
      const generation = flashGeneration;
      let handle = 0;
      handle = view.setTimeout(() => {
        if (generation !== flashGeneration || flashTimer !== handle) return;
        flashTimer = undefined;
        replaceCssOwned(state, 'lr-highlight-flash', owner, []);
      }, finiteDuration(durationMs, DEFAULT_FLASH_MS));
      flashTimer = handle;
    },
    release() {
      cancelFlashTimer();
      for (const name of state.highlightObjects.keys()) replaceCssOwned(state, name, owner, []);
    },
  };
}

function inertHighlightHandle(): HighlightHandle {
  return {
    setRanges: () => undefined,
    setActive: () => undefined,
    flash: () => undefined,
    release: () => undefined,
  };
}

export interface HighlightHandleOptions {
  /** A public part name every `<mark>` the fallback paints carries (the API path creates no element). */
  readonly part?: string;
}

/** Acquires a paint handle for one owner. Transparently uses the CSS Custom Highlight API when
 *  available, falling back to `<mark>`-wrapping otherwise. Painting callers do not need to branch;
 *  `options.part` exposes the fallback marks as the component's own public part. */
export function acquireHighlightHandle(
  owner: object,
  doc: Document | null = defaultDocument(),
  options: HighlightHandleOptions = {},
): HighlightHandle {
  if (!doc) return inertHighlightHandle();
  const realm = highlightRealm(doc);
  if (realm && doc.defaultView && !matchesRealm(failedDocumentRealms.get(doc), realm)) {
    try {
      const handle = acquireCssHandle(owner, stateForDocument(doc, realm), doc.defaultView);
      failedDocumentRealms.delete(doc);
      return handle;
    } catch {
      failedDocumentRealms.set(doc, realm);
      // A partial/polyfilled registry can expose the right shape but still reject construction or
      // registration. Fall back to owned DOM marks rather than leaking unsurfaced ranges or using
      // another document's globals.
    }
  }
  return acquireFallbackHandle(doc, options.part);
}

// -- resolved text-quote highlights ------------------------------------------------------------

/** One text-quote highlight resolved against the rendered content. */
export interface ResolvedHighlightRange<T extends LyraHighlight = LyraHighlight> {
  readonly id: string;
  readonly highlight: T;
  readonly tone: LyraHighlightTone;
  readonly range: Range;
}

/**
 * Resolves the `text-quote` highlights against `index` with one shared work budget, the active one
 * first and at most `TEXT_QUOTE_PAINT_LIMIT` of them. Resolution is by quote text, never by node
 * identity, so a quote the content does not contain yet resolves on a later pass; other anchor
 * kinds have no span of text and are skipped.
 */
export function resolveHighlightRanges<T extends LyraHighlight>(
  index: TextQuoteIndex,
  highlights: readonly T[],
  activeHighlightId: string | null,
): { readonly ranges: ResolvedHighlightRange<T>[]; readonly active: Range | null } {
  const budget = index.createWorkBudget();
  const accepted: T[] = [];
  const matches: TextQuoteMatch[] = [];
  for (const highlight of prioritizedHighlightCandidates(highlights, activeHighlightId)) {
    if (matches.length >= TEXT_QUOTE_PAINT_LIMIT) break;
    const anchor = highlight.anchor;
    const match = anchor.kind === 'text-quote' ? index.resolve(anchor, budget) : null;
    if (!match) continue;
    accepted.push(highlight);
    matches.push(match);
  }
  const materialized = rangesFromTextQuoteMatches(index.scope, matches);
  const ranges: ResolvedHighlightRange<T>[] = [];
  let active: Range | null = null;
  for (let position = 0; position < accepted.length; position++) {
    const range = materialized[position];
    if (!range) continue;
    const highlight = accepted[position]!;
    ranges.push({ id: highlight.id, highlight, tone: highlight.tone ?? 'accent', range });
    if (highlight.id === activeHighlightId) active = range;
  }
  return { ranges, active };
}

/** Paints `entries` grouped by tone (default `accent`), clearing every tone left empty, and sets
 *  the owner's active range. */
export function paintHighlightTones(
  handle: HighlightHandle,
  entries: Iterable<{ readonly tone?: LyraHighlightTone; readonly range: Range }>,
  active: Range | null,
): void {
  const byTone = new Map<LyraHighlightTone, Range[]>(HIGHLIGHT_TONES.map((tone) => [tone, []]));
  const accent = byTone.get('accent')!;
  for (const { tone, range } of entries) (byTone.get(tone ?? 'accent') ?? accent).push(range);
  for (const [tone, ranges] of byTone) handle.setRanges(tone, ranges);
  handle.setActive(active);
}

/** Resolves and paints the `text-quote` highlights in one pass, returning the ranges for
 *  `hitTestHighlightRanges()`. */
export function paintResolvedHighlights<T extends LyraHighlight>(options: {
  readonly handle: HighlightHandle;
  readonly index: TextQuoteIndex;
  readonly highlights: readonly T[];
  readonly activeHighlightId: string | null;
}): ResolvedHighlightRange<T>[] {
  const { ranges, active } = resolveHighlightRanges(options.index, options.highlights, options.activeHighlightId);
  paintHighlightTones(options.handle, ranges, active);
  return ranges;
}

/** Anything that reports client rectangles under an id, such as a `ResolvedHighlightRange`. */
export interface HitTestableRange {
  readonly id: string;
  readonly range: {
    getClientRects(): Iterable<{ readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }>;
  };
}

/**
 * The id of the topmost (last) range with a client rectangle containing the point, edges
 * included, after inspecting at most `TEXT_SELECTION_RECT_LIMIT` rectangles. The Custom Highlight
 * API paints without an element to listen on, so this serves both paint paths.
 */
export function hitTestHighlightRanges(ranges: readonly HitTestableRange[], x: number, y: number): string | null {
  let budget = TEXT_SELECTION_RECT_LIMIT;
  for (let position = ranges.length - 1; position >= 0; position--) {
    const entry = ranges[position]!;
    for (const box of entry.range.getClientRects()) {
      if (budget <= 0) return null;
      budget -= 1;
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return entry.id;
    }
  }
  return null;
}
