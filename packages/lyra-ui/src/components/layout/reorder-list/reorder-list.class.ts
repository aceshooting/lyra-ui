import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import './reorder-item.js';
import type { LyraReorderItem } from './reorder-item.class.js';
// The registering barrel, not the bare *.class.js module -- this side effect is what makes
// <lr-live-region> an actually-defined tag by the time this list renders one, matching
// <lr-tree>'s identical import for the same reason.
import '../../utility/live-region/live-region.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './reorder-list.styles.js';

export interface ReorderDetail {
  order: string[];
  fromIndex: number;
  toIndex: number;
}

export interface LyraReorderListEventMap {
  'lr-reorder': CustomEvent<ReorderDetail>;
}

/**
 * `<lr-reorder-list>` — a generic vertical list of `<lr-reorder-item>` rows, reorderable via
 * per-row move-up/move-down buttons (always available) or Ctrl/Cmd+ArrowUp/ArrowDown from focus
 * anywhere inside a row — the same modifier convention `<lr-tree>`'s `reorderable` and
 * `<lr-dashboard-grid>`'s `cells-draggable` already establish.
 *
 * Unlike `<lr-tree>`'s `reorderable` mode (a *controlled* request — `data` is host-owned and
 * nothing moves until the host reassigns it), this list physically moves its own slotted
 * `<lr-reorder-item>` light-DOM nodes itself. That is a deliberate difference, not an
 * inconsistency: `<lr-tree>` re-derives its child elements from a `data` array prop on every
 * render, so a direct DOM move there would just be overwritten on the next render — it must stay
 * controlled. This list has no such data-array prop; its children are plain author-authored
 * slotted content with nothing to reconcile against, so DOM order genuinely is the source of
 * truth (the same principle `<lr-tree>` relies on for its own children). The `lr-reorder` event
 * still tells the host the resulting order, so it can persist it without hand-rolling its own
 * splice/resort logic.
 *
 * @customElement lr-reorder-list
 * @slot - `<lr-reorder-item>` elements.
 * @event lr-reorder - `detail: { order, fromIndex, toIndex }` — fired after every successful move
 * (button click or Ctrl/Cmd+Arrow). `order` is every current item's `value` (or its
 * DOM-position-index fallback) in the new top-to-bottom order; `fromIndex`/`toIndex` are the moved
 * item's 0-based position before/after.
 * @csspart base - The list's root wrapper (`role="list"`).
 * @cssprop [--lr-reorder-list-gap=var(--lr-space-2xs)] - Gap between rows.
 */
export class LyraReorderList extends LyraElement<LyraReorderListEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Accessible name for the list, set as `aria-label` on the internal `role="list"` element. A
   *  plain `aria-label` attribute on the host itself is honored as a fallback when this is left
   *  unset, matching `<lr-control-group>`. Native lists don't require an accessible name, so this
   *  has no forced fallback string when both are left unset. */
  @property() label = '';

  /** Disables every item's move-up/move-down buttons and the Ctrl/Cmd+Arrow shortcut, without
   *  removing any item from the DOM or mutating any item's own `disabled` attribute. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  private get itemElements(): LyraReorderItem[] {
    return [...this.querySelectorAll(tag('reorder-item'))] as LyraReorderItem[];
  }

  private syncBoundaryState(): void {
    const items = this.itemElements;
    items.forEach((item, i) => {
      item.atStart = i === 0;
      item.atEnd = i === items.length - 1;
      item.listDisabled = this.disabled;
    });
  }

  private onSlotChange = (): void => {
    this.syncBoundaryState();
  };

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('disabled')) this.syncBoundaryState();
  }

  private orderValues(items: LyraReorderItem[]): string[] {
    return items.map((item, i) => item.value ?? String(i));
  }

  private moveItem(item: LyraReorderItem, direction: 'up' | 'down'): void {
    if (this.disabled || item.disabled) return;
    const items = this.itemElements;
    const fromIndex = items.indexOf(item);
    if (fromIndex < 0) return;
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= items.length) return;

    const target = items[toIndex];
    if (direction === 'up') this.insertBefore(item, target);
    else this.insertBefore(item, target.nextElementSibling);

    this.syncBoundaryState();

    // Focus the same-direction button if it's still usable after the move; otherwise the move
    // just made this item a new boundary in that direction (it would get force-blurred the
    // instant Lit's next render sets it `disabled`), so fall back to the other button instead.
    const sameDirDisabled = direction === 'up' ? item.atStart : item.atEnd;
    const buttonPart = sameDirDisabled
      ? direction === 'up'
        ? 'move-down-button'
        : 'move-up-button'
      : direction === 'up'
        ? 'move-up-button'
        : 'move-down-button';
    (item.shadowRoot?.querySelector(`[part='${buttonPart}']`) as HTMLElement | null)?.focus();

    const newItems = this.itemElements;
    this.liveRegion?.announce(
      this.localize('reorderItemMoved', undefined, { index: toIndex + 1, total: newItems.length }),
      // A discrete, user-initiated action: never coalesce it behind the announcer's throttle
      // window the way streaming status text is -- matches <lr-tree>'s identical reorder announcement.
      { force: true },
    );
    this.emit<ReorderDetail>('lr-reorder', { order: this.orderValues(newItems), fromIndex, toIndex });
  }

  private onMoveRequest = (e: Event): void => {
    const item = (e.target as Element | null)?.closest?.(tag('reorder-item')) as LyraReorderItem | null;
    if (!item) return;
    const { direction } = (e as CustomEvent<{ direction: 'up' | 'down' }>).detail;
    this.moveItem(item, direction);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.disabled) return;
    if (!(e.ctrlKey || e.metaKey) || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const item = (e.target as Element | null)?.closest?.(tag('reorder-item')) as LyraReorderItem | null;
    if (!item) return;
    e.preventDefault();
    this.moveItem(item, e.key === 'ArrowDown' ? 'down' : 'up');
  };

  render(): TemplateResult {
    return html`
      <div
        part="base"
        role="list"
        aria-label=${this.label || this.getAttribute('aria-label') || nothing}
        @lr-move-request=${this.onMoveRequest}
        @keydown=${this.onKeyDown}
      >
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
      <lr-live-region></lr-live-region>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-reorder-list': LyraReorderList;
  }
}
