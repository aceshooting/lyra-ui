import type { LyraHighlightTone } from '../components/viewers/document-viewer/anchors.js';
import { TEXT_QUOTE_LIMITS } from './text-quote.js';

const TONE_NAMES: LyraHighlightTone[] = ['accent', 'success', 'warning', 'danger', 'neutral'];
const DEFAULT_FLASH_MS = 1800; // mirrors --lr-transition-ambient's default duration (see tokens.styles.ts)
/** The fallback mutates the DOM once per retained Range, so it shares the viewer search paint cap. */
const FALLBACK_RANGE_LIMIT = 200;

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
    ...TONE_NAMES.map((tone): [string, number] => [highlightName(tone), 0]),
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

function nextNodeWithin(node: Node, root: Node): Node | null {
  if (node.firstChild) return node.firstChild;
  let cursor: Node | null = node;
  while (cursor && cursor !== root) {
    if (cursor.nextSibling) return cursor.nextSibling;
    cursor = cursor.parentNode;
  }
  return null;
}

/** Wraps the text covered by `range` in one or more `<mark>` elements. `name` is the highlight's
 *  identity (`lr-highlight-accent|success|...`, `lr-highlight-active`, or `lr-highlight-flash`)
 *  and is written to `data-lr-highlight-name` -- the fallback-path equivalent of the CSS Custom
 *  Highlight API path's separately-registered `Highlight` objects, letting a stylesheet distinguish
 *  an active/flash mark from a genuine `setRanges`-painted one even when they share the same `tone`.
 *  `data-lr-highlight-tone` is kept alongside it so tone-based selection still works. */
function wrapRangeInMarks(range: Range, name: string, tone: LyraHighlightTone, doc: Document): HTMLElement[] {
  const ancestor = range.commonAncestorContainer;
  const view = doc.defaultView;
  const textNodeType = view?.Node.TEXT_NODE ?? 3;
  const covered: Text[] = [];
  let traversed = 0;
  let inspectedCodeUnits = 0;
  let node: Node | null = ancestor;
  while (node && traversed < TEXT_QUOTE_LIMITS.maxTraversalNodes) {
    traversed++;
    if (node.nodeType === textNodeType) {
      const textNode = node as Text;
      if (inspectedCodeUnits + textNode.data.length > TEXT_QUOTE_LIMITS.maxCorpusCodeUnits) break;
      inspectedCodeUnits += textNode.data.length;
      try {
        if (textNode.data.length > 0 && range.intersectsNode(textNode)) covered.push(textNode);
      } catch {
        // A stale host Range is simply unpaintable; keep the fallback fail-closed.
      }
    }
    node = nextNodeWithin(node, ancestor);
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
  const view = doc.defaultView;

  function clear(name: string): void {
    for (const mark of marksByName.get(name) ?? []) unwrapMark(mark);
    marksByName.set(name, []);
  }

  function paint(name: string, tone: LyraHighlightTone, ranges: Range[]): void {
    clear(name);
    const marks: HTMLElement[] = [];
    const count = Math.min(ranges.length, FALLBACK_RANGE_LIMIT);
    for (let index = 0; index < count; index++) {
      marks.push(...wrapRangeInMarks(ranges[index]!, name, tone, doc));
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
      }, durationMs);
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
      }, durationMs);
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

/** Acquires a paint handle for one owner. Transparently uses the CSS Custom Highlight API when
 *  available, falling back to `<mark>`-wrapping otherwise. Painting callers do not need to branch;
 *  a component may still query its exact owner document to decorate fallback marks with its own
 *  public parts. */
export function acquireHighlightHandle(
  owner: object,
  doc: Document | null = defaultDocument(),
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
  return acquireFallbackHandle(owner, doc);
}
