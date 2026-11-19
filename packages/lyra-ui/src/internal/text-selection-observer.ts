/**
 * Selection-end observation shared by document viewers, code blocks and the terminal: one
 * document-level event stream per document, content-root listeners, containment across shadow
 * boundaries and de-duplication of an unchanged range. A leaf below the anchor-target mixins, so a
 * selection-only consumer pulls neither the element base nor the text-quote resolver.
 */
import type { TextSelectRect } from '../components/viewers/document-viewer/anchors.js';
import { boundedSelectionRects, boundedSelectionText } from './text-selection.js';

type ComposedSelection = Selection & {
  getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[];
};

interface SelectionDispatcher {
  subscribers: Set<() => void>;
  roots: Map<Element, () => void>;
  shadows: Map<ShadowRoot, number>;
  shadowList?: ShadowRoot[];
  cleanup(): void;
}
const selectionDispatchers = new WeakMap<Document, SelectionDispatcher>();
const EMPTY_RECTS: readonly TextSelectRect[] = Object.freeze([]);

function isCollapsedBoundary(range: StaticRange): boolean {
  return range.startContainer === range.endContainer && range.startOffset === range.endOffset;
}

function rangeFrom(document: Document, composed: StaticRange): Range {
  const range = document.createRange();
  range.setStart(composed.startContainer, composed.startOffset);
  range.setEnd(composed.endContainer, composed.endOffset);
  return range;
}

/** The node a dispatcher routes from; a selection the engine refuses to describe routes nowhere. */
function selectedAncestor(document: Document, selection: ComposedSelection | null | undefined, shadows: readonly ShadowRoot[]): Node | null {
  try {
    if (selection?.getComposedRanges && shadows.length) {
      const composed = selection.getComposedRanges({ shadowRoots: [...shadows] })[0];
      return composed && !isCollapsedBoundary(composed) ? rangeFrom(document, composed).commonAncestorContainer : null;
    }
    return selection && selection.rangeCount && !selection.isCollapsed ? selection.getRangeAt(0).commonAncestorContainer : null;
  } catch {
    return null;
  }
}

/** One document event stream and animation frame, released with the last selection root. */
function subscribeSelectionEnd(document: Document, root: Element, shadows: readonly ShadowRoot[], notify: () => void): () => void {
  let dispatcher = selectionDispatchers.get(document);
  if (!dispatcher) {
    const subscribers = new Set<() => void>();
    const view = document.defaultView;
    let selecting = false;
    let frame: number | undefined;
    let previous = new Set<() => void>();
    const roots = new Map<Element, () => void>();
    const shadowCounts = new Map<ShadowRoot, number>();
    const state: SelectionDispatcher = { subscribers, roots, shadows: shadowCounts, cleanup() {
      document.removeEventListener('selectionchange', change);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
      if (frame !== undefined) view?.cancelAnimationFrame(frame);
    } };
    const route =(node: Node | null, into: Set<() => void>): void => {
      while (node) {
        const callback = roots.get(node as Element);
        if (callback) into.add(callback);
        node = node.nodeType === 11 && 'host' in node ? (node as ShadowRoot).host : node.parentNode;
      }
    };
    const deliver = (): void => {
      const current = new Set<() => void>();
      const selection = view?.getSelection() as ComposedSelection | null | undefined;
      const shadowList = (state.shadowList ??= [...shadowCounts.keys()]);
      route(selectedAncestor(document, selection, shadowList), current);
      if (!selection?.getComposedRanges && current.size === 0) {
        // Older engines expose shadow selections only through each ShadowRoot. Keep that
        // compatibility fallback while composed-range engines route directly to the active root.
        for (const shadow of shadowCounts.keys()) {
          const local = (shadow as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.();
          route(selectedAncestor(document, local, []), current);
        }
      }
      const pending = new Set([...previous, ...current]); previous = current;
      for (const callback of pending) if (subscribers.has(callback)) callback();
    };
    const change = (): void => {
      if (selecting) return;
      if (!view) { deliver(); return; }
      if (frame !== undefined) return;
      frame = view.requestAnimationFrame(() => { frame = undefined; deliver(); });
    };
    const down = (event: PointerEvent): void => {
      if (event.isPrimary && event.button === 0) {
        selecting = true;
        if (frame !== undefined) { view?.cancelAnimationFrame(frame); frame = undefined; }
      }
    };
    const release = (): void => {
      if (!selecting) return;
      selecting = false;
      deliver();
    };
    document.addEventListener('selectionchange', change);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
    selectionDispatchers.set(document, state);
    dispatcher = state;
  }
  dispatcher.subscribers.add(notify);
  dispatcher.roots.set(root, notify);
  for (const shadow of shadows) dispatcher.shadows.set(shadow, (dispatcher.shadows.get(shadow) ?? 0) + 1);
  dispatcher.shadowList = undefined;
  const owned = dispatcher;
  return () => {
    if (!owned.subscribers.delete(notify)) return;
    owned.roots.delete(root);
    for (const shadow of shadows) {
      const remaining = (owned.shadows.get(shadow) ?? 1) - 1;
      if (remaining === 0) owned.shadows.delete(shadow); else owned.shadows.set(shadow, remaining);
    }
    owned.shadowList = undefined;
    if (owned.subscribers.size === 0 && selectionDispatchers.get(document) === owned) {
      selectionDispatchers.delete(document);
      owned.cleanup();
    }
  };
}

function legacySelectionRange(shadowRoots: readonly ShadowRoot[], globalSelection: Selection | null): Range | null {
  const shadowSelection = (shadowRoots.at(-1) as { getSelection?: () => Selection | null } | undefined)?.getSelection?.();
  const selection = shadowSelection ?? globalSelection;
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  return selection.getRangeAt(0);
}

function selectionRange(root: Element, shadowRoots: readonly ShadowRoot[], legacyFallback: boolean): Range | null {
  const document = root.ownerDocument;
  const globalSelection = (document.defaultView?.getSelection() ?? null) as ComposedSelection | null;
  if (globalSelection?.getComposedRanges && shadowRoots.length > 0) {
    const [composed] = globalSelection.getComposedRanges({ shadowRoots: [...shadowRoots] });
    if (composed && !isCollapsedBoundary(composed)) return rangeFrom(document, composed);
    if (!legacyFallback) return null;
  }
  return legacySelectionRange(shadowRoots, globalSelection);
}

function containsAcrossShadowBoundaries(ancestor: Node, node: Node): boolean {
  let current: Node | null = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.nodeType === 11 && 'host' in current
      ? (current as ShadowRoot).host
      : current.parentNode;
  }
  return false;
}

/** Shadow roots through which a selection inside `contentRoot` must be read for `host`. */
export function textSelectionShadowRoots(host: Element, contentRoot: Element): ShadowRoot[] {
  const ShadowRootCtor = contentRoot.ownerDocument.defaultView?.ShadowRoot;
  if (!ShadowRootCtor) return [];
  const roots = [host.shadowRoot, contentRoot.getRootNode()];
  return roots.filter((root, index): root is ShadowRoot =>
    root instanceof ShadowRootCtor && roots.indexOf(root) === index);
}

export interface TextSelectionObserverOptions {
  /** Also reports synchronously from the content root's `mouseup`, sharing the de-duplication. */
  readonly mouseup?: boolean;
  /** Replaces the composed, shadow and document query; a throw reads as no selection. */
  readonly readRange?: () => Range | null;
  /** Retries the shadow and document selection when the composed-range query yields no range. */
  readonly legacyFallback?: boolean;
}

/**
 * Calls `onSelect` once for each non-collapsed selection that ends inside `contentRoot` (after the
 * pointer that drags it is released, or after a keyboard/touch change settles). A selection
 * elsewhere on the page never reports, and an unchanged range is not reported twice. A selection
 * whose range cannot be read reports nothing, and unreadable geometry reports no rects. Returns the
 * function that removes every listener.
 */
export function observeTextSelection(
  host: Element,
  contentRoot: Element,
  onSelect: (range: Range, text: string, rects: readonly TextSelectRect[]) => void,
  shadowRoots: () => readonly ShadowRoot[] = () => textSelectionShadowRoots(host, contentRoot),
  options: TextSelectionObserverOptions = {},
): () => void {
  const { mouseup = false, readRange, legacyFallback = false } = options;
  let reported: readonly [Node, number, Node, number] | undefined;
  const read = (): Range | null => {
    try {
      // Resolved per event: the content root can be re-parented into another shadow tree (a
      // virtualized list re-rendering its rows) after binding, and a stale root list misses the range.
      return readRange ? readRange() : selectionRange(host, shadowRoots(), legacyFallback);
    } catch {
      return null;
    }
  };
  const onSelectionEnd = (): void => {
    const range = read();
    if (!range || !containsAcrossShadowBoundaries(contentRoot, range.commonAncestorContainer)) {
      reported = undefined;
      return;
    }
    if (
      reported &&
      reported[0] === range.startContainer && reported[1] === range.startOffset &&
      reported[2] === range.endContainer && reported[3] === range.endOffset
    ) return;
    const text = boundedSelectionText(range);
    if (!text) return;
    reported = [range.startContainer, range.startOffset, range.endContainer, range.endOffset];
    let rects = EMPTY_RECTS;
    try {
      rects = boundedSelectionRects(range);
    } catch {
      // Geometry is optional detail; the bounded text still reports.
    }
    onSelect(range, text, rects);
  };
  contentRoot.addEventListener('pointerup', onSelectionEnd);
  contentRoot.addEventListener('keyup', onSelectionEnd);
  if (mouseup) contentRoot.addEventListener('mouseup', onSelectionEnd);
  const unsubscribe = subscribeSelectionEnd(contentRoot.ownerDocument, contentRoot, shadowRoots(), onSelectionEnd);
  return () => {
    contentRoot.removeEventListener('pointerup', onSelectionEnd);
    contentRoot.removeEventListener('keyup', onSelectionEnd);
    if (mouseup) contentRoot.removeEventListener('mouseup', onSelectionEnd);
    unsubscribe();
  };
}
