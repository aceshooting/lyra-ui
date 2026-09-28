import { prefersReducedMotion } from './motion.js';
import { flattenedThemeParent } from './theme-observation.js';

type Subscription = {
  element: Element;
  ancestors: Set<Element>;
  roots: Set<Node>;
  refresh: () => void;
};
type RootWatch = { subscribers: Set<Subscription>; observer: MutationObserver; onSlotChange: () => void };
type MediaWatch = { subscribers: Set<Subscription>; query: MediaQueryList; changed: () => void };
const rootWatches = new WeakMap<Node, RootWatch>();
const mediaWatches = new WeakMap<Window, MediaWatch>();

function addRoot(root: Node, subscription: Subscription): void {
  let watch = rootWatches.get(root);
  if (!watch) {
    const view = subscription.element.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    if (!view?.MutationObserver) return;
    const subscribers = new Set<Subscription>();
    const onSlotChange = (): void => { for (const item of [...subscribers]) item.refresh(); };
    const observer = new view.MutationObserver(records => {
      for (const item of [...subscribers]) {
        if (records.some(record => {
          if (record.type === 'attributes') {
            return item.ancestors.has(record.target as Element) ||
              (record.attributeName === 'name' && (record.target as Element).localName === 'slot');
          }
          // Ordinary rendering elsewhere in the document does not change this inheritance path.
          return [...record.addedNodes, ...record.removedNodes].some(node =>
            [...item.ancestors].some(ancestor => node === ancestor || node.contains(ancestor)));
        })) {
          item.refresh();
        }
      }
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-lr-motion', 'slot', 'name'] });
    root.addEventListener('slotchange', onSlotChange, true);
    watch = { subscribers, observer, onSlotChange };
    rootWatches.set(root, watch);
  }
  watch.subscribers.add(subscription);
}

function removeRoot(root: Node, subscription: Subscription): void {
  const watch = rootWatches.get(root);
  if (!watch) return;
  watch.subscribers.delete(subscription);
  if (watch.subscribers.size) return;
  watch.observer.disconnect();
  root.removeEventListener('slotchange', watch.onSlotChange, true);
  rootWatches.delete(root);
}

function addMedia(view: Window, subscription: Subscription): void {
  let watch = mediaWatches.get(view);
  if (!watch) {
    const query = view.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const subscribers = new Set<Subscription>();
    const changed = (): void => { for (const item of [...subscribers]) item.refresh(); };
    if (query.addEventListener) query.addEventListener('change', changed);
    else query.addListener?.(changed);
    watch = { subscribers, query, changed };
    mediaWatches.set(view, watch);
  }
  watch.subscribers.add(subscription);
}

function removeMedia(view: Window, subscription: Subscription): void {
  const watch = mediaWatches.get(view);
  if (!watch) return;
  watch.subscribers.delete(subscription);
  if (watch.subscribers.size) return;
  if (watch.query.removeEventListener) watch.query.removeEventListener('change', watch.changed);
  else watch.query.removeListener?.(watch.changed);
  mediaWatches.delete(view);
}

/** Watches an already-connected motion producer. One observer per shared root and one media
 * listener per window serve all subscribers; the last release disconnects them. No initial
 * callback is sent. One-shot motion queries do not import or allocate this observation layer. */
export function observeReducedMotion(element: Element, changed: (reduced: boolean) => void): () => void {
  if (!element.ownerDocument?.defaultView || typeof element.getRootNode !== 'function') return () => {};
  let stopped = false;
  let value = prefersReducedMotion(element);
  let view: Window | null = null;
  const subscription: Subscription = { element, ancestors: new Set(), roots: new Set(), refresh };
  function refresh(): void {
    if (stopped) return;
    const ancestors = new Set<Element>();
    const roots = new Set<Node>();
    for (let current: Element | null = element; current; current = flattenedThemeParent(current)) {
      ancestors.add(current);
      roots.add(current.getRootNode());
      // A currently unassigned light child may acquire a slot when its parent next renders.
      if (current !== element && current.shadowRoot) roots.add(current.shadowRoot);
    }
    subscription.ancestors = ancestors;
    for (const root of subscription.roots) if (!roots.has(root)) removeRoot(root, subscription);
    for (const root of roots) if (!subscription.roots.has(root)) addRoot(root, subscription);
    subscription.roots = roots;
    const nextView = element.ownerDocument.defaultView;
    if (view !== nextView) {
      if (view) removeMedia(view, subscription);
      view = nextView;
      if (view) addMedia(view, subscription);
    }
    const next = prefersReducedMotion(element);
    if (next !== value) {
      value = next;
      changed(next);
    }
  }
  refresh();
  return () => {
    if (stopped) return;
    stopped = true;
    for (const root of subscription.roots) removeRoot(root, subscription);
    subscription.roots.clear();
    subscription.ancestors.clear();
    if (view) removeMedia(view, subscription);
    view = null;
  };
}
