import type { LyraHighlightTone } from '../components/document-viewer/anchors.js';

const TONE_NAMES: LyraHighlightTone[] = ['accent', 'success', 'warning', 'danger', 'neutral'];
const DEFAULT_FLASH_MS = 1800; // mirrors --lr-transition-ambient's default duration (see tokens.styles.ts)

/** Minimal shape of the CSS Custom Highlight API's `Highlight` this module needs -- declared locally
 *  (not as a global augmentation) since this toolchain's DOM lib typings don't yet include it; every
 *  access goes through `globalThis` casts so the module degrades safely wherever the API is missing. */
interface CustomHighlightLike {
  priority: number;
  add(range: Range): void;
  delete(range: Range): boolean;
}
interface HighlightRegistryLike {
  set(name: string, highlight: CustomHighlightLike): void;
}

function getHighlightCtor(): (new () => CustomHighlightLike) | undefined {
  return (globalThis as unknown as { Highlight?: new () => CustomHighlightLike }).Highlight;
}

function getHighlightRegistry(): HighlightRegistryLike | undefined {
  return (globalThis as unknown as { CSS?: { highlights?: HighlightRegistryLike } }).CSS?.highlights;
}

/** Whether the CSS Custom Highlight API (`Highlight` + `CSS.highlights`) is available. */
export function supportsCustomHighlights(): boolean {
  return getHighlightCtor() !== undefined && getHighlightRegistry() !== undefined;
}

function highlightName(tone: LyraHighlightTone): string {
  return `lr-highlight-${tone}`;
}

let registered = false;
const highlightObjects = new Map<string, CustomHighlightLike>();
const ownersByName = new Map<string, Map<object, Set<Range>>>();

/** Creates and registers every document-global `Highlight` object this module owns
 *  (`lr-highlight-accent|success|warning|danger|neutral`, `lr-highlight-active`,
 *  `lr-highlight-flash`) exactly once, lazily inside the first `acquireHighlightHandle()` call --
 *  never at module evaluation, so importing an adopting viewer's class module stays SSR/node-safe. */
function ensureRegistered(): void {
  if (registered || !supportsCustomHighlights()) return;
  registered = true;
  const Ctor = getHighlightCtor()!;
  const registry = getHighlightRegistry()!;
  const entries: [string, number][] = [
    ...TONE_NAMES.map((tone): [string, number] => [highlightName(tone), 0]),
    ['lr-highlight-active', 1],
    ['lr-highlight-flash', 2],
  ];
  for (const [name, priority] of entries) {
    const highlight = new Ctor();
    highlight.priority = priority;
    highlightObjects.set(name, highlight);
    ownersByName.set(name, new Map());
    registry.set(name, highlight);
  }
}

function replaceCssOwned(name: string, owner: object, ranges: Range[]): void {
  const highlight = highlightObjects.get(name);
  const owners = ownersByName.get(name);
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
   *  `--lr-transition-ambient`'s default), then clears it automatically. */
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

/** Wraps the text covered by `range` in one or more `<mark>` elements. `name` is the highlight's
 *  identity (`lr-highlight-accent|success|...`, `lr-highlight-active`, or `lr-highlight-flash`)
 *  and is written to `data-lr-highlight-name` -- the fallback-path equivalent of the CSS Custom
 *  Highlight API path's separately-registered `Highlight` objects, letting a stylesheet distinguish
 *  an active/flash mark from a genuine `setRanges`-painted one even when they share the same `tone`.
 *  `data-lr-highlight-tone` is kept alongside it so tone-based selection still works. */
function wrapRangeInMarks(range: Range, name: string, tone: LyraHighlightTone, doc: Document): HTMLElement[] {
  const ancestor = range.commonAncestorContainer;
  const walkRoot = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode! : ancestor;
  const walker = doc.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT);
  const covered: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (range.intersectsNode(node) && (node as Text).data.length > 0) covered.push(node as Text);
  }
  const marks: HTMLElement[] = [];
  for (const textNode of covered) {
    const inRange = splitTextNodeAtRange(range, textNode);
    if (!inRange.data) continue;
    const mark = doc.createElement('mark');
    mark.setAttribute('data-lr-highlight-tone', tone);
    mark.setAttribute('data-lr-highlight-name', name);
    mark.setAttribute('role', 'mark');
    inRange.parentNode?.insertBefore(mark, inRange);
    mark.appendChild(inRange);
    marks.push(mark);
  }
  return marks;
}

function unwrapMark(mark: HTMLElement): void {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
  parent.normalize(); // merges the restored text back with untouched sibling text nodes
}

function acquireFallbackHandle(_owner: object, doc: Document): HighlightHandle {
  const marksByName = new Map<string, HTMLElement[]>();

  function clear(name: string): void {
    for (const mark of marksByName.get(name) ?? []) unwrapMark(mark);
    marksByName.set(name, []);
  }

  function paint(name: string, tone: LyraHighlightTone, ranges: Range[]): void {
    clear(name);
    const marks: HTMLElement[] = [];
    for (const range of ranges) marks.push(...wrapRangeInMarks(range, name, tone, doc));
    marksByName.set(name, marks);
  }

  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    setRanges(tone, ranges) {
      paint(highlightName(tone), tone, ranges);
    },
    setActive(range) {
      paint('lr-highlight-active', 'accent', range ? [range] : []);
    },
    flash(range, durationMs = DEFAULT_FLASH_MS) {
      clearTimeout(flashTimer);
      paint('lr-highlight-flash', 'accent', [range]);
      flashTimer = setTimeout(() => clear('lr-highlight-flash'), durationMs);
    },
    release() {
      clearTimeout(flashTimer);
      for (const name of marksByName.keys()) clear(name);
    },
  };
}

function acquireCssHandle(owner: object): HighlightHandle {
  ensureRegistered();
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  return {
    setRanges(tone, ranges) {
      replaceCssOwned(highlightName(tone), owner, ranges);
    },
    setActive(range) {
      replaceCssOwned('lr-highlight-active', owner, range ? [range] : []);
    },
    flash(range, durationMs = DEFAULT_FLASH_MS) {
      clearTimeout(flashTimer);
      replaceCssOwned('lr-highlight-flash', owner, [range]);
      flashTimer = setTimeout(() => replaceCssOwned('lr-highlight-flash', owner, []), durationMs);
    },
    release() {
      clearTimeout(flashTimer);
      for (const name of highlightObjects.keys()) replaceCssOwned(name, owner, []);
    },
  };
}

/** Acquires a paint handle for one owner. Transparently uses the CSS Custom Highlight API when
 *  available, falling back to `<mark>`-wrapping otherwise -- callers never branch on
 *  `supportsCustomHighlights()` themselves, only this module does. */
export function acquireHighlightHandle(owner: object, doc: Document = document): HighlightHandle {
  return supportsCustomHighlights() ? acquireCssHandle(owner) : acquireFallbackHandle(owner, doc);
}
