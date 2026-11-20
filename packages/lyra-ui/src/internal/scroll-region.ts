import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { normalizeLabel } from './accessible-name.js';

const OVERFLOW_TOLERANCE_PX = 1;

function overflows(el: HTMLElement): boolean {
  return el.scrollHeight - el.clientHeight > OVERFLOW_TOLERANCE_PX ||
    el.scrollWidth - el.clientWidth > OVERFLOW_TOLERANCE_PX;
}

/** Disposer returned by `makeScrollRegionFocusable()`; `refresh()` re-reads the content to observe
 *  and re-measures, for a host whose render replaced the body's children. */
export type ScrollRegionHandle = (() => void) & { refresh(): void };

/**
 * Makes a capped-height scroll body keyboard-scrollable only while it actually overflows: it gets
 * `tabindex="0"`, `role="region"` and an `aria-label` (when `name` is non-blank) while content
 * overflows, and none of them otherwise, so a short body adds no tab stop. Re-measures on resize
 * of the element, its children and the elements assigned to any child `<slot>` (re-read on
 * `slotchange`), so slotted content that grows inside a fixed-size body is seen too. Returns a
 * disposer that disconnects the observer and removes what was added. A pre-existing author
 * `tabindex`/`role`/`aria-label` is never overwritten. When the body stops overflowing while it
 * holds focus, its tab stop drops to `tabindex="-1"` so focus is not lost. `role: false` keeps the element's own role (a landmark
 * such as `<aside>`). Call it only while `el`
 * is connected: Lit also runs `updated()` on a detached host, so a host syncing from there checks
 * `isConnected` and re-syncs on reconnect (`ScrollRegionController` does both).
 */
export function makeScrollRegionFocusable(
  el: HTMLElement,
  name: string | undefined,
  options: { role?: boolean } = {},
): ScrollRegionHandle {
  const withRole = options.role !== false;
  const label = normalizeLabel(name);
  const added = new Set<string>();
  const add = (attribute: string, value: string): void => {
    if (!added.has(attribute) && el.hasAttribute(attribute)) return;
    el.setAttribute(attribute, value);
    added.add(attribute);
  };
  const clear = (keepFocus: boolean): void => {
    for (const attribute of added) {
      if (keepFocus && attribute === 'tabindex' && el.matches(':focus')) el.setAttribute(attribute, '-1');
      else {
        el.removeAttribute(attribute);
        added.delete(attribute);
      }
    }
  };
  const sync = (): void => {
    if (overflows(el)) {
      add('tabindex', '0');
      if (withRole) add('role', 'region');
      if (label) add('aria-label', label);
    } else clear(true);
  };
  const Observer = el.ownerDocument.defaultView?.ResizeObserver;
  let observer: ResizeObserver | undefined;
  let observed = new Set<Element>();
  const observeContent = (): void => {
    if (!observer) return;
    const next = new Set<Element>([el]);
    for (const child of Array.from(el.children)) {
      next.add(child);
      if (child instanceof HTMLSlotElement) for (const a of child.assignedElements({ flatten: true })) next.add(a);
    }
    for (const target of observed) if (!next.has(target)) observer.unobserve(target);
    for (const target of next) if (!observed.has(target)) observer.observe(target);
    observed = next;
  };
  const refresh = (): void => {
    observeContent();
    sync();
  };
  if (Observer) {
    const own = new Observer(() => {
      if (observer === own) sync();
    });
    observer = own;
  }
  el.addEventListener('slotchange', refresh);
  refresh();
  return Object.assign(() => {
    el.removeEventListener('slotchange', refresh);
    observer?.disconnect();
    observer = undefined;
    observed.clear();
    clear(false);
  }, { refresh });
}

/** One body a `ScrollRegionController` keeps keyboard-scrollable; `name` becomes its region label. */
export interface ScrollRegionTarget {
  el: HTMLElement;
  name?: string | undefined;
  /** `false` keeps the element's own role instead of adding `role="region"`. */
  role?: boolean;
}

/**
 * Lit wiring for `makeScrollRegionFocusable()`: re-resolves the bodies after every host update
 * (re-creating a region whose element or name changed and refreshing the rest), releases them all
 * on disconnect and re-attaches on reconnect. Nothing is attached while the host is detached.
 */
export class ScrollRegionController implements ReactiveController {
  private readonly regions = new Map<HTMLElement, { name: string | undefined; handle: ScrollRegionHandle }>();

  constructor(
    private readonly host: ReactiveControllerHost & HTMLElement & { readonly hasUpdated: boolean },
    private readonly resolve: () => readonly (ScrollRegionTarget | null | undefined)[],
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    if (this.host.hasUpdated) this.sync();
  }

  hostUpdated(): void {
    this.sync();
  }

  hostDisconnected(): void {
    this.release();
  }

  /** Re-resolves and re-measures now; for a body whose content changed outside a host update. */
  sync(): void {
    if (!this.host.isConnected) {
      this.release();
      return;
    }
    const live = new Set<HTMLElement>();
    for (const target of this.resolve()) {
      if (!target) continue;
      const { el, name } = target;
      live.add(el);
      const existing = this.regions.get(el);
      if (existing && existing.name === name) {
        existing.handle.refresh();
        continue;
      }
      existing?.handle();
      this.regions.set(el, { name, handle: makeScrollRegionFocusable(el, name, { role: target.role !== false }) });
    }
    for (const [el, region] of this.regions) {
      if (live.has(el)) continue;
      region.handle();
      this.regions.delete(el);
    }
  }

  private release(): void {
    for (const region of this.regions.values()) region.handle();
    this.regions.clear();
  }
}

/** Registers a `ScrollRegionController` on `host`; call it from the constructor. */
export function trackScrollRegions(
  host: ConstructorParameters<typeof ScrollRegionController>[0],
  resolve: () => readonly (ScrollRegionTarget | null | undefined)[],
): ScrollRegionController {
  return new ScrollRegionController(host, resolve);
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
