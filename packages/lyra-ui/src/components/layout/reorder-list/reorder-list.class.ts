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
 * An `lr-reorder` listener can call `preventDefault()` to hold a move open while its own async
 * work (e.g. a network call persisting the new order) is in flight -- the same
 * cancelable-event-plus-host-resolvable-pending-state pattern `<lr-confirm-bar>` and
 * `<lr-tool-approval-dialog>` already establish for their own approve/deny decisions.
 *
 * @customElement lr-reorder-list
 * @slot - `<lr-reorder-item>` elements.
 * @event lr-reorder - `detail: { order, fromIndex, toIndex }` — fired before a move is applied
 * (button click or Ctrl/Cmd+Arrow). `order` is every item's `value` (or its DOM-position-index
 * fallback) in the order the move WOULD produce; `fromIndex`/`toIndex` are the moved item's
 * 0-based position before/after. Cancelable: a listener calling `preventDefault()` holds the move
 * instead of applying it -- the affected `<lr-reorder-item>` reflects `pending`, and no other move
 * can start anywhere in this list -- until the host calls `finalizePendingMove()` to apply it or
 * `revertPendingMove()` to discard it and restore the prior order. Uncanceled (the default), the
 * move applies synchronously in the same tick, unchanged from every release before this option
 * existed.
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

  /** Set by `moveItem()` to the button that should receive focus once the moved item's own
   *  deferred re-render has actually cleared its `disabled` attribute; consumed by
   *  `getUpdateComplete()` below. A plain, synchronously-overwritten bookkeeping VALUE, not a
   *  started async chain -- the same shape as `<lr-tree>`'s `pendingFocusId`. This matters:
   *  overwriting a value is free, but overwriting a field that held an *already-started* promise
   *  (an earlier draft of this fix did exactly that) leaves the earlier promise chain still
   *  running, uncancelled, racing to `.focus()` a now-stale target after the real one already won.
   *  Deferring ALL of the actual async work to `getUpdateComplete()` -- started exactly once, only
   *  when it actually runs -- means a second `moveItem()` call before that point has nothing
   *  in-flight to race against; it just overwrites this field. */
  private pendingFocusTarget: { item: LyraReorderItem; buttonPart: 'move-up-button' | 'move-down-button' } | null =
    null;

  /** Set while an `lr-reorder` listener has called `preventDefault()`, holding a move until the
   *  host calls `finalizePendingMove()` or `revertPendingMove()`. `moveItem()` refuses to start
   *  any further move while this is set -- at most one move is ever held at a time. */
  private pendingMove: { item: LyraReorderItem; direction: 'up' | 'down'; fromIndex: number; toIndex: number } | null =
    null;

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

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.pendingMove) {
      this.pendingMove.item.pending = false;
      this.pendingMove = null;
    }
  }

  private orderValues(items: LyraReorderItem[]): string[] {
    return items.map((item, i) => item.value ?? String(i));
  }

  // `syncBoundaryState()` sets `atStart`/`atEnd`/`listDisabled` as plain Lit `@property`
  // assignments -- the JS field updates synchronously, but the shadow-DOM re-render (and with
  // it, the button's `disabled` HTML attribute) is deferred to a microtask. Focusing a button
  // that Lit hasn't re-rendered yet risks focusing one still marked `disabled` in the live DOM
  // (a silent no-op), immediately followed by Lit disabling the *actually* newly-boundary button
  // out from under the real focus -- which the HTML spec force-blurs to `document.body`.
  //
  // The actual async work (awaiting the moved item's own `updateComplete`, then `.focus()`) lives
  // ONLY in `getUpdateComplete()` below, run lazily and exactly once per update cycle -- it is
  // never started eagerly from `applyMove()`. That's deliberate: an eagerly-started promise chain
  // per move would keep running independently even after a later move overwrites
  // `pendingFocusTarget`, uncancelled and orphaned, free to `.focus()` a stale target the moment
  // its own `await item.updateComplete` resolves -- which can lose the race against a *second*
  // move's own restoration and steal focus back onto the wrong item (a fast double-click or
  // Ctrl/Cmd+Arrow key-repeat outrunning a render tick reliably triggers exactly this). Storing
  // only the plain target VALUE here and deferring all the work to `getUpdateComplete()` is what
  // `<lr-tree>`'s `pendingFocusId` actually does -- no work starts until `getUpdateComplete()`
  // itself runs, so a later `applyMove()` call before that point has no competing chain to race
  // against, just a field to overwrite. Lit's own scheduler calls `getUpdateComplete()` as part of
  // resolving `updateComplete` on every update cycle regardless of whether any external caller
  // ever reads that promise, which is what makes this correct in real (non-test) usage too.
  protected async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    if (this.pendingFocusTarget) {
      const { item, buttonPart } = this.pendingFocusTarget;
      this.pendingFocusTarget = null;
      await item.updateComplete;
      (item.shadowRoot?.querySelector(`[part='${buttonPart}']`) as HTMLElement | null)?.focus();
    }
    return result;
  }

  /** Physically moves `item` (already known to belong at `toIndex`) and runs the same
   *  boundary-recompute / focus-restore / announce steps for both the immediate (uncanceled) path
   *  and a later `finalizePendingMove()` call. */
  private applyMove(item: LyraReorderItem, direction: 'up' | 'down', fromIndex: number, toIndex: number): void {
    const items = this.itemElements;
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
    this.pendingFocusTarget = { item, buttonPart };

    const newItems = this.itemElements;
    this.liveRegion?.announce(
      this.localize('reorderItemMoved', undefined, { index: toIndex + 1, total: newItems.length }),
      // A discrete, user-initiated action: never coalesce it behind the announcer's throttle
      // window the way streaming status text is -- matches <lr-tree>'s identical reorder announcement.
      { force: true },
    );
  }

  private moveItem(item: LyraReorderItem, direction: 'up' | 'down'): void {
    if (this.disabled || item.disabled || this.pendingMove) return;
    const items = this.itemElements;
    const fromIndex = items.indexOf(item);
    if (fromIndex < 0) return;
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= items.length) return;

    // Compute the order the move WOULD produce, without touching the DOM yet -- the event fires
    // before the move so a listener can still veto it.
    const reordered = items.slice();
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, item);

    const event = this.emit<ReorderDetail>(
      'lr-reorder',
      { order: this.orderValues(reordered), fromIndex, toIndex },
      { cancelable: true },
    );
    if (event.defaultPrevented) {
      this.pendingMove = { item, direction, fromIndex, toIndex };
      item.pending = true;
      return;
    }

    this.applyMove(item, direction, fromIndex, toIndex);
  }

  /** Applies a move an `lr-reorder` listener held via `preventDefault()`, once the host's own
   *  async work (e.g. persisting the new order) has succeeded. No-op if nothing is pending. */
  finalizePendingMove(): void {
    if (!this.pendingMove) return;
    const { item, direction, fromIndex, toIndex } = this.pendingMove;
    this.pendingMove = null;
    item.pending = false;
    this.applyMove(item, direction, fromIndex, toIndex);
  }

  /** Discards a move an `lr-reorder` listener held via `preventDefault()`, leaving the list at its
   *  prior order -- e.g. once the host's own async work (e.g. persisting the new order) fails.
   *  No-op if nothing is pending. */
  revertPendingMove(): void {
    if (!this.pendingMove) return;
    const { item } = this.pendingMove;
    this.pendingMove = null;
    item.pending = false;
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
