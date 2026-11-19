import { normalizeLabel } from './accessible-name.js';

const OVERFLOW_TOLERANCE_PX = 1;

function overflows(el: HTMLElement): boolean {
  return el.scrollHeight - el.clientHeight > OVERFLOW_TOLERANCE_PX ||
    el.scrollWidth - el.clientWidth > OVERFLOW_TOLERANCE_PX;
}

/**
 * Makes a capped-height scroll body keyboard-scrollable only while it actually overflows: it gets
 * `tabindex="0"`, `role="region"` and an `aria-label` (when `name` is non-blank) while content
 * overflows, and none of them otherwise, so a short body adds no tab stop. Re-measures on resize
 * of the element and its children. Returns a disposer that disconnects the observer and removes
 * what was added. A pre-existing author `tabindex`/`role`/`aria-label` is never overwritten.
 * Call it only while `el` is connected: Lit also runs `updated()` on a detached host, so a host
 * syncing from there checks `isConnected` and re-syncs on reconnect.
 */
export function makeScrollRegionFocusable(el: HTMLElement, name: string | undefined): () => void {
  const label = normalizeLabel(name);
  const added = new Set<string>();
  const add = (attribute: string, value: string): void => {
    if (el.hasAttribute(attribute)) return;
    el.setAttribute(attribute, value);
    added.add(attribute);
  };
  const clear = (): void => {
    for (const attribute of added) el.removeAttribute(attribute);
    added.clear();
  };
  const sync = (): void => {
    if (overflows(el)) {
      add('tabindex', '0');
      add('role', 'region');
      if (label) add('aria-label', label);
    } else clear();
  };
  const Observer = el.ownerDocument.defaultView?.ResizeObserver;
  let observer: ResizeObserver | undefined;
  if (Observer) {
    const own = new Observer(() => {
      if (observer === own) sync();
    });
    observer = own;
    own.observe(el);
    for (const child of Array.from(el.children)) own.observe(child);
  }
  sync();
  return () => {
    observer?.disconnect();
    observer = undefined;
    clear();
  };
}

function scrollParent(el: Element): HTMLElement | null {
  const view = el.ownerDocument.defaultView;
  let node: Element | null = el.parentElement ?? (el.getRootNode() as ShadowRoot).host ?? null;
  while (node) {
    if (node === el.ownerDocument.documentElement || node === el.ownerDocument.body) return null;
    const style = view?.getComputedStyle(node);
    const scrolls = (value?: string): boolean => value === 'auto' || value === 'scroll';
    if (node instanceof HTMLElement && style &&
        ((scrolls(style.overflowY) && node.scrollHeight > node.clientHeight) ||
         (scrolls(style.overflowX) && node.scrollWidth > node.clientWidth))) return node;
    node = node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null;
  }
  return null;
}

/**
 * Scrolls `el` into view inside its nearest scrolling ancestor only (composed, so it crosses
 * shadow roots), never the page or outer scrollers. A no-op when no ancestor scrolls.
 */
export function revealWithinScrollParent(
  el: Element,
  opts: { block?: 'nearest' | 'center'; inline?: 'nearest' } = {},
): void {
  const parent = scrollParent(el);
  if (!parent) return;
  const box = el.getBoundingClientRect();
  const port = parent.getBoundingClientRect();
  const block = opts.block ?? 'nearest';
  if (block === 'center') {
    parent.scrollTop += box.top - port.top - (parent.clientHeight - box.height) / 2;
  } else if (box.top < port.top) parent.scrollTop -= port.top - box.top;
  else if (box.bottom > port.bottom) parent.scrollTop += box.bottom - port.bottom;
  if (box.left < port.left) parent.scrollLeft -= port.left - box.left;
  else if (box.right > port.right) parent.scrollLeft += box.right - port.right;
}
