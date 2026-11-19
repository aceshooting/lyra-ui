import { composedParentElement, isAccessibilityVisible } from './accessibility-visibility.js';
import { OwnedIntersectionObserver, OwnedMutationObserver, readIntersecting } from './owned-observer.js';

/**
 * Attributes whose change on an element or a composed ancestor can hide, inert or reveal it
 * without changing geometry, so no intersection report follows.
 */
export const ENGINE_FENCE_ATTRIBUTES: readonly string[] = Object.freeze(['aria-hidden', 'inert', 'hidden', 'style', 'class', 'open']);

/** Composed ancestors observed above the starting element. */
const FENCE_DEPTH = 256;

/**
 * Observes the fence attributes on `start` and its first 256 composed ancestors (assigned slots
 * and shadow hosts included), in `start`'s owner window. Returns the disposer; no callback runs
 * after it, or while `start` is disconnected.
 */
export function observeAncestorFences(start: Element, onChange: () => void): () => void {
  const observer = new OwnedMutationObserver(start, () => onChange());
  const init: MutationObserverInit = { attributes: true, attributeFilter: [...ENGINE_FENCE_ATTRIBUTES] };
  for (let element: Element | null = start, depth = 0; element && depth <= FENCE_DEPTH; depth++) {
    observer.observe(element, init);
    element = composedParentElement(element);
  }
  return () => observer.clear();
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
  let intersecting = false;
  let releaseFences: (() => void) | undefined;
  const intersection = new OwnedIntersectionObserver(host, (entries) => {
    intersecting = readIntersecting(entries, surface) ?? intersecting;
    admit();
  });
  const release = (): void => {
    settled = true;
    intersection.clear();
    releaseFences?.();
  };
  const exposed = (): boolean => options.isExposed?.() ?? isAccessibilityVisible(host);
  const admit = (): void => {
    if (settled || !intersecting || !options.isReady() || !exposed()) return;
    release();
    options.onAdmit();
  };
  intersection.observe(surface);
  intersecting = host.isConnected && !intersection.active;
  releaseFences = observeAncestorFences(host, admit);
  admit();
  return release;
}
