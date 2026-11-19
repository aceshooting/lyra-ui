import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { composedParentElement } from './active-element.js';
import { isRovingTargetAvailable, resolveListMove } from './list-navigation.js';

/** What a host hands {@linkcode RovingListController}. */
export interface RovingListOptions {
  /** The stops in DOM order; read again after every host update. */
  items(): readonly HTMLElement[];
  /** Widget-specific exclusion on top of disabled, hidden, inert and `aria-hidden` stops. */
  isAvailable?(item: HTMLElement): boolean;
  /** Wrap past the ends instead of stopping at the nearest available edge (default `false`). */
  wrap?: boolean;
}

/** Whether `item` can take focus at all, ignoring `aria-disabled` and widget exclusions. */
function canTakeFocus(item: HTMLElement): boolean {
  if ('disabled' in item && Boolean(item.disabled)) return false;
  if (item.getAttribute('aria-hidden') === 'true') return false;
  for (let node: Element | null = item; node; node = composedParentElement(node)) {
    if (node.hasAttribute('hidden') || node.hasAttribute('inert')) return false;
  }
  return true;
}

/**
 * One tab stop for a vertical list of focusable rows: ArrowUp/ArrowDown/Home/End move between
 * available stops, focus entering a stop makes it current, and after every update the current
 * stop is rehomed to its nearest available neighbour when it left the list or became unavailable.
 * When no stop is available, the first one that can still take focus keeps the list reachable.
 */
export class RovingListController implements ReactiveController {
  private current?: HTMLElement;
  private currentIndex = 0;

  constructor(
    private readonly host: ReactiveControllerHost & HTMLElement,
    private readonly options: RovingListOptions,
  ) {
    host.addController(this);
  }

  /** The stop holding `tabindex="0"` after the last sync. */
  get active(): HTMLElement | undefined {
    return this.current;
  }

  hostConnected(): void {
    this.host.addEventListener('focusin', this.onFocusIn);
  }

  hostDisconnected(): void {
    this.host.removeEventListener('focusin', this.onFocusIn);
  }

  hostUpdated(): void {
    this.sync();
  }

  /** Re-reads the stops and writes `tabindex` so exactly the current stop is in the tab order. */
  sync(): void {
    const items = this.options.items();
    const index = this.current ? items.indexOf(this.current) : -1;
    if (index >= 0 && this.isAvailable(items[index]!)) this.currentIndex = index;
    else this.current = this.rehome(items);
    for (const item of items) {
      const value = item === this.current ? 0 : -1;
      if (item.tabIndex !== value || !item.hasAttribute('tabindex')) item.tabIndex = value;
    }
  }

  /** Bind on the list (`@keydown=${roving.onKeyDown}`); keys from controls nested in a stop pass through. */
  readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const items = this.options.items();
    const index = items.indexOf(event.composedPath()[0] as HTMLElement);
    if (index < 0) return;
    const wrap = this.options.wrap === true;
    const next = resolveListMove(event, {
      count: items.length,
      current: index,
      orientation: 'vertical',
      wrap,
      clamp: !wrap,
      isAvailable: candidate => this.isAvailable(items[candidate]!),
    });
    if (next === null) return;
    event.preventDefault();
    this.current = items[next];
    this.currentIndex = next;
    this.sync();
    items[next]!.focus();
  };

  private readonly onFocusIn = (event: FocusEvent): void => {
    const items = this.options.items();
    const target = event.composedPath()[0];
    const index = items.indexOf(target as HTMLElement);
    if (index < 0 || this.current === items[index]) return;
    this.current = items[index];
    this.currentIndex = index;
    this.sync();
  };

  private isAvailable(item: HTMLElement): boolean {
    return isRovingTargetAvailable(item) && (this.options.isAvailable?.(item) ?? true);
  }

  /** Nearest available stop at or after the former position, then before it, then any focusable one. */
  private rehome(items: readonly HTMLElement[]): HTMLElement | undefined {
    const start = Math.min(this.currentIndex, items.length - 1);
    for (let index = Math.max(start, 0); index < items.length; index += 1) {
      if (this.isAvailable(items[index]!)) return this.remember(items, index);
    }
    for (let index = start - 1; index >= 0; index -= 1) {
      if (this.isAvailable(items[index]!)) return this.remember(items, index);
    }
    const fallback = items.findIndex(canTakeFocus);
    return fallback < 0 ? undefined : this.remember(items, fallback);
  }

  private remember(items: readonly HTMLElement[], index: number): HTMLElement {
    this.currentIndex = index;
    return items[index]!;
  }
}
