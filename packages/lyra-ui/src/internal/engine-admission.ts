import { composedParentElement, isAccessibilityVisible } from './accessibility-visibility.js';
import { subscribeInheritedAttributes } from './inherited-attribute-hub.js';

/**
 * Attributes whose change on an element or a composed ancestor can hide, inert or reveal it
 * without changing geometry, so no intersection report follows.
 */
export const ENGINE_FENCE_ATTRIBUTES: readonly string[] = /* @__PURE__ */ Object.freeze(['aria-hidden', 'inert', 'hidden', 'style', 'class', 'open']);

/** Composed ancestors observed above the starting element. */
const FENCE_DEPTH = 256;

/**
 * Reports a change to one of the {@link ENGINE_FENCE_ATTRIBUTES} on `start` or its first 256
 * composed ancestors (assigned slots and shadow hosts included), in `start`'s owner window. Each
 * root along the chain is watched through the shared per-root observer, so many engines add one
 * subscription per root rather than one observer per ancestor. Returns the disposer; no callback
 * runs after it, or while `start` is disconnected.
 */
export function observeAncestorFences(start: Element, onChange: () => void): () => void {
  const view = start.ownerDocument.defaultView;
  if (!view?.MutationObserver) return () => {};
  let active = true;
  const chain = new Set<Element>();
  const roots = new Set<Node>();
  for (let element: Element | null = start, depth = 0; element && depth <= FENCE_DEPTH; depth++) {
    chain.add(element);
    roots.add(element.getRootNode());
    element = composedParentElement(element);
  }
  let queued = false;
  const changed = (records: MutationRecord[]): void => {
    if (queued || !records.some((record) => chain.has(record.target as Element))) return;
    // Several roots can report one change in the same turn; coalesce them into one callback.
    queued = true;
    queueMicrotask(() => { queued = false; if (active && start.isConnected) onChange(); });
  };
  const releases = [...roots].map((root) =>
    subscribeInheritedAttributes(root, view.MutationObserver, { attributes: ENGINE_FENCE_ATTRIBUTES, changed }));
  return () => {
    if (!active) return;
    active = false;
    for (const release of releases) release?.();
  };
}

export interface EngineAdmissionOptions {
  /** Checked before every admission attempt; `false` keeps waiting for the next report. */
  isReady(): boolean;
  /** Runs once, after every observer is released. It can run before `observeAdmission` returns. */
  onAdmit(): void;
  /** Whether the host is exposed to the user. Defaults to `isAccessibilityVisible(host)`. */
  isExposed?(): boolean;
}

/**
 * Waits until `surface` intersects the viewport and `host` is exposed (not hidden, inert or
 * aria-hidden through any composed ancestor), then calls `onAdmit` once. A fence lifted from an
 * ancestor changes no geometry, so the fences are observed too, only while admission is pending.
 * A window without `IntersectionObserver` never withholds admission. Returns the disposer; a report
 * queued before disposal is ignored.
 */
export function observeAdmission(host: Element, surface: Element, options: EngineAdmissionOptions): () => void {
  let settled = false;
  let intersection: IntersectionObserver | undefined;
  let releaseFences: (() => void) | undefined;
  const view = host.ownerDocument.defaultView;
  const release = (): void => {
    settled = true;
    intersection?.disconnect();
    releaseFences?.();
  };
  const exposed = (): boolean => options.isExposed?.() ?? isAccessibilityVisible(host);
  let intersecting = false;
  const admit = (): void => {
    if (settled || !intersecting || !host.isConnected || !options.isReady() || !exposed()) return;
    release();
    options.onAdmit();
  };
  if (host.isConnected && view?.IntersectionObserver) {
    intersection = new view.IntersectionObserver((entries) => {
      if (settled || !host.isConnected) return;
      // Entries for one target arrive in time order; the last one is current.
      for (const entry of entries) {
        if (entry?.target === surface && typeof entry.isIntersecting === 'boolean') intersecting = entry.isIntersecting;
      }
      admit();
    });
    intersection.observe(surface);
  }
  intersecting = host.isConnected && !intersection;
  releaseFences = observeAncestorFences(host, admit);
  admit();
  return release;
}
