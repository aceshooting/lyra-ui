import { composedParentElement, deepActiveElementIn } from './active-element.js';
import { tag } from './prefix.js';

/** Marks a shared announcement sink; `announcer.ts` publishes it as `ANNOUNCEMENT_SINK_ATTRIBUTE`. */
export const SHARED_LIVE_REGION_ATTRIBUTE = `data-${tag('live-region')}`;

/**
 * Whether `element` is one of the library's page-level helper regions: a shared announcement sink
 * or a toast stack. They mount at the end of `<body>`, or inside an active native modal (see
 * {@link getNativeModalMountTarget}), so a library modal must leave them exposed exactly as a native
 * modal leaves the regions mounted inside it. Each producer is gated at its own source instead: a
 * source behind the modal is inert, so it is not accessibility-visible and announces nothing.
 */
export function isPageHelperRegion(element: Element): boolean {
  return element.localName === tag('toast') || element.hasAttribute(SHARED_LIVE_REGION_ATTRIBUTE);
}

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
  // A carrier registers right before `showModal()` and releases right before `close()`.
  forgetNativeModalProbe(modal.ownerDocument);
  return () => {
    if (contexts.get(modal) === context) contexts.delete(modal);
    forgetNativeModalProbe(modal.ownerDocument);
  };
}

interface NativeModalProbe {
  readonly modal: HTMLDialogElement | null;
}

/**
 * One probe per document per task. Every connecting sink owner, every announcement and every
 * keyboard routing decision asks the same question, and a list render connects many owners inside
 * one microtask; answering each with a document walk and three hit tests forced a layout per call.
 */
const probes = new WeakMap<Document, NativeModalProbe>();
const focusWatchedDocuments = new WeakSet<Document>();

function forgetNativeModalProbe(doc: Document | null | undefined): void {
  if (doc) probes.delete(doc);
}

function forgetProbeOnFocusChange(doc: Document): void {
  if (focusWatchedDocuments.has(doc)) return;
  focusWatchedDocuments.add(doc);
  const forget = (): void => {
    probes.delete(doc);
  };
  // `showModal()` and `close()` move focus synchronously, so a focus change is the earliest signal
  // that the active modal may have changed within the same task.
  doc.addEventListener('focusin', forget, true);
  doc.addEventListener('focusout', forget, true);
}

function isNativeModal(dialog: HTMLDialogElement): boolean {
  try {
    return dialog.isConnected && dialog.matches(':modal');
  } catch {
    return false;
  }
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
 *
 * The answer is reused until the current task's microtasks run, or until focus moves or a
 * library carrier opens or closes in the meantime; a remembered modal is rechecked on every read.
 */
export function getActiveNativeModal(doc: Document | null | undefined): HTMLDialogElement | null {
  if (!doc) return null;
  const remembered = probes.get(doc);
  if (remembered && (remembered.modal === null || isNativeModal(remembered.modal))) return remembered.modal;
  const probe: NativeModalProbe = { modal: probeActiveNativeModal(doc) };
  probes.set(doc, probe);
  forgetProbeOnFocusChange(doc);
  // A promise job, not the owner window's `queueMicrotask`: it runs at the same checkpoint whatever
  // the document's realm, and code that instruments that window's microtask queue never holds it.
  void Promise.resolve().then(() => {
    if (probes.get(doc) === probe) probes.delete(doc);
  });
  return probe.modal;
}

function probeActiveNativeModal(doc: Document): HTMLDialogElement | null {
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
