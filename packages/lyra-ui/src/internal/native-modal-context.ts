import { composedParentElement, deepActiveElementIn } from './active-element.js';

interface NativeModalContext {
  contentHost: HTMLElement;
  mountTarget: HTMLElement;
}

const contexts = new WeakMap<HTMLDialogElement, NativeModalContext>();

/** Associate a shadow-root modal carrier with the light-DOM host whose slots it renders. */
export function registerNativeModalContext(
  modal: HTMLDialogElement,
  contentHost: HTMLElement,
  mountTarget: HTMLElement = contentHost,
): () => void {
  const context = { contentHost, mountTarget };
  contexts.set(modal, context);
  return () => {
    if (contexts.get(modal) === context) contexts.delete(modal);
  };
}

/** Mount helper-owned content in a carrier's slotted light DOM whenever available. */
export function getNativeModalMountTarget(modal: HTMLDialogElement): HTMLElement {
  return contexts.get(modal)?.mountTarget ?? modal;
}

function modalAncestor(element: Element | null): HTMLDialogElement | null {
  for (let current = element; current; current = composedParentElement(current)) {
    if (current.localName !== 'dialog') continue;
    try {
      if (current.matches(':modal')) return current as HTMLDialogElement;
    } catch {
      return null;
    }
  }
  return null;
}

/** Avoid geometry reads (and forced layout) when no reachable root contains a native modal. */
function mayHaveNativeModal(doc: Document): boolean {
  const roots: Array<Document | ShadowRoot> = [doc];
  let budget = 4_096;
  while (roots.length > 0) {
    const root = roots.pop()!;
    try {
      if (root.querySelector('dialog:modal')) return true;
    } catch {
      return false;
    }
    for (const element of root.querySelectorAll('*')) {
      if (--budget < 0) return true;
      if (element.shadowRoot) roots.push(element.shadowRoot);
    }
  }
  return false;
}

/**
 * Find the platform's current modal through top-layer hit testing, with focus as a fallback.
 * DOM order cannot identify which sibling dialog was shown last, and temporarily suppressing
 * native autofocus can leave focus in an older modal. Native modal backdrops participate in
 * hit testing even outside their dialog's content rectangle.
 */
export function getActiveNativeModal(doc: Document | null | undefined): HTMLDialogElement | null {
  if (!doc) return null;
  const focused = modalAncestor(deepActiveElementIn(doc));
  if (typeof doc.elementFromPoint !== 'function') return focused;
  if (!focused && !mayHaveNativeModal(doc)) return null;
  const width = doc.documentElement.clientWidth;
  const height = doc.documentElement.clientHeight;
  const points: Array<[number, number]> = [
    [0, 0], [width / 2, height / 2], [Math.max(0, width - 1), Math.max(0, height - 1)],
  ];
  for (const [x, y] of points) {
    let hit = doc.elementFromPoint(x, y);
    const visited = new Set<Element>();
    while (hit?.shadowRoot && !visited.has(hit)) {
      visited.add(hit);
      const inner = hit.shadowRoot.elementFromPoint?.(x, y);
      if (!inner || inner === hit) break;
      hit = inner;
    }
    const modal = modalAncestor(hit);
    if (modal) return modal;
  }
  return focused;
}

/** Whether a source participates in this modal's composed content rather than native inertness. */
export function isInNativeModalContext(source: Element, modal: HTMLDialogElement): boolean {
  if (source === contexts.get(modal)?.contentHost) return true;
  for (let current: Element | null = source; current; current = composedParentElement(current)) {
    if (current === modal) return true;
  }
  return false;
}
