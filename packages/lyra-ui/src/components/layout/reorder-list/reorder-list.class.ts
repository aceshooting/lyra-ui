import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import type { LyraReorderItem } from './reorder-item.class.js';
import {
  releaseReorderOwnerState,
  reorderIdentityChange,
  updateReorderOwnerState,
} from './reorder-owner.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './reorder-list.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_reorderItemMoved, LYRA_DEFAULT_reorderMoveCancelled, LYRA_DEFAULT_reorderMovePending } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraReorderDetail {
  readonly order: readonly string[];
  readonly fromIndex: number;
  readonly toIndex: number;
}

export interface LyraReorderListEventMap {
  'lr-reorder': CustomEvent<LyraEventDetailSnapshot<LyraReorderDetail>>;
}

type ReorderFocusTarget = {
  item: LyraReorderItem;
  direction: 'up' | 'down';
};

type ReorderReconciliation = {
  /** The moved item's stable identity -- reconciliation is keyed by `value`, never by element
   *  reference, since a controlled host's own re-render may recreate the element entirely. */
  value: string;
  direction: 'up' | 'down';
  toIndex: number;
  /** The exact value order a matching host re-render must settle into for this move to
   *  complete -- the same array previously emitted as the `lr-reorder` event's `order`. */
  expectedValues: readonly string[];
};

/**
 * `<lr-reorder-list>` — a generic vertical list of `<lr-reorder-item>` rows, reorderable via
 * per-row move-up/move-down buttons (always available) or Ctrl/Cmd+ArrowUp/ArrowDown from focus
 * anywhere inside a row — the same modifier convention `<lr-tree>`'s `reorderable` and
 * `<lr-dashboard-grid>`'s `cells-draggable` already establish.
 *
 * By default this list physically moves its own slotted `<lr-reorder-item>` light-DOM nodes
 * itself, unlike `<lr-tree>`'s `reorderable` mode (a *controlled* request — `data` is host-owned
 * and nothing moves until the host reassigns it): this list has no `data` array prop, its
 * children are plain author-authored slotted content with nothing to reconcile against, so DOM
 * order genuinely is the source of truth (the same principle `<lr-tree>` relies on for its own
 * children). Setting `controlled` opts into the `<lr-tree>`-style contract instead — see its own
 * doc comment. Every item must provide a unique, nonempty `value`; invalid or duplicate identities
 * stay visible but cannot move. The `lr-reorder` event tells the host the resulting stable-id
 * order, so it can persist it without hand-rolling its own splice/resort logic.
 *
 * An `lr-reorder` listener can call `preventDefault()` to hold a move open while its own async
 * work (e.g. a network call persisting the new order) is in flight -- the same
 * cancelable-event-plus-host-resolvable-pending-state pattern `<lr-confirm-bar>` and
 * `<lr-tool-approval-dialog>` already establish for their own approve/deny decisions.
 *
 * @customElement lr-reorder-list
 * @slot - `<lr-reorder-item>` elements.
 * @event lr-reorder - `detail: { order, fromIndex, toIndex }` — fired before a move is applied
 * (button click or Ctrl/Cmd+Arrow). `order` is every valid item's stable `value` in the order the
 * move WOULD produce; `fromIndex`/`toIndex` are the moved item's
 * 0-based position before/after. Cancelable: a listener calling `preventDefault()` holds the move
 * instead of applying it -- the affected `<lr-reorder-item>` exposes `:state(pending)`, every move
 * action becomes disabled, and no other move
 * can start anywhere in this list -- until the host calls `finalizePendingMove()` to apply it or
 * `revertPendingMove()` to discard it and restore the prior order. Uncanceled (the default), the
 * move applies synchronously in the same tick when `controlled` is unset, unchanged from every
 * release before this option existed; while `controlled` is set it instead waits for a matching
 * host re-render, per that property's own doc comment.
 * @csspart base - The list's root wrapper (`role="list"`).
 * @cssprop [--lr-reorder-list-gap=var(--lr-space-2xs)] - Gap between rows.
 * @status stable
 * @since 6.0.0
 */
export class LyraReorderList extends LyraElement<LyraReorderListEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    reorderItemMoved: LYRA_DEFAULT_reorderItemMoved,
    reorderMoveCancelled: LYRA_DEFAULT_reorderMoveCancelled,
    reorderMovePending: LYRA_DEFAULT_reorderMovePending,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-reorder',
  ]);

  /** Accessible-name fallback for the internal `role="list"` element when the host has no
   *  `aria-label`, matching `<lr-control-group>`. Native lists don't require an accessible name,
   *  so this has no forced fallback string when both are left unset. */
  @property() label = '';

  /** Disables every item's move-up/move-down buttons and the Ctrl/Cmd+Arrow shortcut, without
   *  removing any item from the DOM or mutating any item's own `disabled` attribute. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Opt-in controlled mode. Unset (the default), an uncanceled `lr-reorder` (or a
   *  `finalizePendingMove()` call) moves this list's own slotted `<lr-reorder-item>` light-DOM
   *  nodes itself, exactly as before this property existed. Set, this list stops moving anything
   *  itself -- the host is expected to reorder its OWN backing data and re-render the slotted
   *  items in the new order, the same controlled request `<lr-tree>`'s `reorderable` already
   *  establishes for its `data`-driven children. This list still has no `data` array prop (its
   *  children stay plain slotted content), so the reconciliation is keyed by each item's stable
   *  `value` rather than by element reference: once a later slot/attribute mutation settles into
   *  exactly the value order this list emitted as the triggering event's `order`, the move is
   *  complete -- boundary state, focus restore, and the `reorderItemMoved` announcement then fire
   *  against whichever element instance now holds that `value` (the host's re-render may have
   *  recreated it). Every move action stays disabled and `:state(busy)`/`aria-busy="true"` apply
   *  list-wide for the whole wait, matching a `preventDefault()`-held move. A host re-render that
   *  never reaches that exact order leaves the move pending indefinitely; one that drops the
   *  moved `value` entirely (removes or renames that row) cancels it silently, with no
   *  announcement -- the host already knows, since it made that edit itself. */
  @property({ type: Boolean, reflect: true }) controlled = false;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  /** Latest post-move focus target. A generation guard keeps a superseded async restore inert. */
  private pendingFocusTarget: ReorderFocusTarget | null = null;

  private focusRestoreGeneration = 0;
  private itemObserver?: MutationObserver;
  private stateItems = new Set<LyraReorderItem>();
  private moveToken = 0;

  /** Set while an `lr-reorder` listener has called `preventDefault()`, holding a move until the
   *  host calls `finalizePendingMove()` or `revertPendingMove()`. `moveItem()` refuses to start
   *  any further move while this is set -- at most one move is ever held at a time. */
  private pendingMove: {
    token: number;
    phase: 'dispatching' | 'held';
    resolution: 'finalize' | 'revert' | null;
    item: LyraReorderItem;
    target: LyraReorderItem;
    direction: 'up' | 'down';
    fromIndex: number;
    toIndex: number;
    members: LyraReorderItem[];
    values: string[];
    expectedValues: readonly string[];
  } | null = null;

  /** Set while `controlled` is on and a move awaits a matching host re-render. Like `pendingMove`,
   *  at most one is ever outstanding: `moveItem()` refuses to start another while this is set. */
  private pendingReconciliation: ReorderReconciliation | null = null;

  private get directItemElements(): LyraReorderItem[] {
    const itemTag = tag('reorder-item');
    return [...this.children].filter(
      (element): element is LyraReorderItem => element.localName === itemTag
    );
  }

  private get itemElements(): LyraReorderItem[] {
    const seen = new Set<string>();
    return this.directItemElements.filter((item) => {
      const value = item.value;
      if (typeof value !== 'string' || value.trim() === '' || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  private syncBoundaryState(): void {
    const directItems = this.directItemElements;
    const items = this.itemElements;
    const validItems = new Set(items);
    const heldMove = this.pendingMove?.phase === 'held';
    const reconciliation = this.pendingReconciliation;
    const busy = heldMove || reconciliation !== null;
    const nextStateItems = new Set(directItems);
    for (const item of this.stateItems) {
      if (!nextStateItems.has(item)) releaseReorderOwnerState(item, this);
    }
    directItems.forEach((item) => {
      const i = items.indexOf(item);
      updateReorderOwnerState(item, this, {
        atStart: i === 0,
        atEnd: i >= 0 && i === items.length - 1,
        listDisabled: this.disabled,
        pending:
          (heldMove && this.pendingMove?.item === item) ||
          (reconciliation !== null && item.value === reconciliation.value),
        busy,
        validIdentity: validItems.has(item),
      });
    });
    this.stateItems = nextStateItems;
    this.requestUpdate();
  }

  private onSlotChange = (): void => {
    if (this.pendingMove && this.pendingMove.phase === 'held' && !this.pendingMembershipIsCurrent())
      this.revertPendingMove();
    if (this.pendingReconciliation) this.tryCompleteControlledReconciliation();
    this.syncBoundaryState();
  };

  /** Checks whether the current light-DOM order now matches a controlled move's expected value
   *  order, completing it (boundary sync + focus restore + announcement, via `finishMove()`)
   *  against whichever element now holds the moved `value`. Drops the reconciliation silently,
   *  with no announcement, once that `value` is no longer present at all -- the host that removed
   *  or renamed the row already knows it did so. Otherwise leaves it pending for a later
   *  mutation. */
  private tryCompleteControlledReconciliation(): void {
    const reconciliation = this.pendingReconciliation;
    if (!reconciliation) return;
    const items = this.itemElements;
    const currentValues = items.map((entry) => entry.value);
    const matches =
      currentValues.length === reconciliation.expectedValues.length &&
      currentValues.every((value, index) => value === reconciliation.expectedValues[index]);
    if (!matches) {
      if (!currentValues.includes(reconciliation.value)) this.pendingReconciliation = null;
      return;
    }
    const movedItem = items[reconciliation.toIndex];
    this.pendingReconciliation = null;
    if (movedItem) this.finishMove(movedItem, reconciliation.direction, reconciliation.toIndex);
  }

  /** @internal Reconciles only a directly owned item's live identity edit. */
  [reorderIdentityChange](item: LyraReorderItem): void {
    if (item.parentElement === this) this.onSlotChange();
  }

  private refreshItemObserver(): void {
    this.itemObserver?.disconnect();
    const Observer = this.ownerDocument.defaultView?.MutationObserver;
    if (!Observer || !this.isConnected) return;
    this.itemObserver = new Observer(() => this.onSlotChange());
    this.itemObserver.observe(this, {
      attributes: true,
      childList: true,
      attributeFilter: ['disabled', 'value'],
    });
  }

  private pendingMembershipIsCurrent(): boolean {
    if (!this.pendingMove) return false;
    const current = this.itemElements;
    return (
      !this.disabled &&
      !this.pendingMove.item.disabled &&
      !this.pendingMove.target.disabled &&
      current.length === this.pendingMove.members.length &&
      current.every(
        (item, index) =>
          item === this.pendingMove!.members[index] &&
          item.value === this.pendingMove!.values[index],
      ) &&
      current[this.pendingMove.toIndex] === this.pendingMove.target
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.refreshItemObserver();
    this.syncBoundaryState();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('disabled')) this.syncBoundaryState();
    // Flipping `controlled` mid-wait would otherwise strand a reconciliation that the new mode's
    // own commit path can never complete (uncontrolled moves never populate it, controlled moves
    // populate a fresh one of their own): drop it rather than leave the list permanently busy.
    if (changed.has('controlled') && this.pendingReconciliation) {
      this.pendingReconciliation = null;
      this.syncBoundaryState();
    }
  }

  override disconnectedCallback(): void {
    this.itemObserver?.disconnect();
    this.itemObserver = undefined;
    this.pendingFocusTarget = null;
    this.focusRestoreGeneration += 1;
    this.pendingMove = null;
    this.pendingReconciliation = null;
    this.moveToken += 1;
    for (const item of this.stateItems) releaseReorderOwnerState(item, this);
    this.stateItems.clear();
    super.disconnectedCallback();
  }

  private orderValues(items: LyraReorderItem[]): readonly string[] {
    return Object.freeze(items.map((item) => item.value));
  }

  private scheduleFocusRestore(): void {
    this.scheduleAfterUpdate(() => {
      const focusTarget = this.pendingFocusTarget;
      if (!focusTarget) return;
      void this.restoreFocusAfterItemUpdate(
        focusTarget,
        this.focusRestoreGeneration
      );
    }, 'reorder-focus');
  }

  private async restoreFocusAfterItemUpdate(
    focusTarget: ReorderFocusTarget,
    generation: number
  ): Promise<void> {
    await focusTarget.item.updateComplete;
    if (
      !this.isConnected ||
      generation !== this.focusRestoreGeneration ||
      this.pendingFocusTarget !== focusTarget
    )
      return;
    this.pendingFocusTarget = null;
    focusTarget.item.focusMoveButton(focusTarget.direction);
  }

  /** Physically moves `item` (already known to belong at `toIndex`) and hands off to
   *  `finishMove()` for the boundary-recompute / focus-restore / announce steps every completed
   *  move shares, whether it just moved the DOM itself (this method) or is instead reconciling a
   *  `controlled` host's own re-render (`tryCompleteControlledReconciliation()`). */
  private applyMove(
    item: LyraReorderItem,
    direction: 'up' | 'down',
    _fromIndex: number,
    toIndex: number
  ): void {
    const items = this.itemElements;
    // safe: callers validate toIndex ∈ [0, items.length - 1] before applyMove (see move handler)
    const target = items[toIndex]!;
    if (direction === 'up') this.insertBefore(item, target);
    else this.insertBefore(item, target.nextElementSibling);
    this.finishMove(item, direction, toIndex);
  }

  /** Shared tail of a completed move, physical or `controlled`-reconciled: recomputes boundary
   *  state, schedules focus restore onto `item` (already at `toIndex`), and announces it. */
  private finishMove(item: LyraReorderItem, direction: 'up' | 'down', toIndex: number): void {
    this.syncBoundaryState();

    // Focus the same-direction button if it's still usable after the move; otherwise the move
    // just made this item a new boundary in that direction (it would get force-blurred the
    // instant Lit's next render sets it `disabled`), so fall back to the other button instead.
    const sameDirDisabled = direction === 'up' ? item.atStart : item.atEnd;
    const focusDirection: 'up' | 'down' = sameDirDisabled
      ? direction === 'up'
        ? 'down'
        : 'up'
      : direction;
    this.pendingFocusTarget = { item, direction: focusDirection };
    this.focusRestoreGeneration += 1;
    this.scheduleFocusRestore();

    const newItems = this.itemElements;
    const number = getNumberFormat(this.effectiveLocale);
    this.liveRegion?.announce(
      this.localize('reorderItemMoved', undefined, {
        index: number.format(toIndex + 1),
        total: number.format(newItems.length),
      }),
      // A discrete, user-initiated action: never coalesce it behind the announcer's throttle
      // window the way streaming status text is -- matches <lr-tree>'s identical reorder announcement.
      { force: true }
    );
  }

  /** Commits an accepted move: physically applies it, or -- while `controlled` -- starts waiting
   *  for the host's own matching re-render instead. Shared by the immediate (uncanceled) path, a
   *  synchronous in-dispatch `finalize` resolution, and a later `finalizePendingMove()` call. */
  private commitMove(
    item: LyraReorderItem,
    direction: 'up' | 'down',
    fromIndex: number,
    toIndex: number,
    expectedValues: readonly string[]
  ): void {
    if (this.controlled) {
      this.pendingReconciliation = {
        value: item.value,
        direction,
        toIndex,
        expectedValues,
      };
      this.syncBoundaryState();
    } else {
      this.applyMove(item, direction, fromIndex, toIndex);
    }
  }

  private moveItem(item: LyraReorderItem, direction: 'up' | 'down'): void {
    if (this.disabled || item.disabled || this.pendingMove || this.pendingReconciliation) return;
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
    const expectedValues = this.orderValues(reordered);

    const transaction = {
      token: ++this.moveToken,
      phase: 'dispatching' as const,
      resolution: null,
      item,
      target: items[toIndex]!,
      direction,
      fromIndex,
      toIndex,
      members: [...items],
      values: items.map((member) => member.value),
      expectedValues,
    };
    this.pendingMove = transaction;

    const event = this.emit(
      'lr-reorder',
      Object.freeze({ order: expectedValues, fromIndex, toIndex }),
      { cancelable: true }
    );
    if (this.pendingMove !== transaction || transaction.token !== this.moveToken) return;
    if (!this.pendingMembershipIsCurrent()) {
      this.pendingMove = null;
      this.syncBoundaryState();
      return;
    }

    if (event.defaultPrevented) {
      if (transaction.resolution === 'revert') {
        this.pendingMove = null;
        this.syncBoundaryState();
        return;
      }
      if (transaction.resolution === 'finalize') {
        this.pendingMove = null;
        this.syncBoundaryState();
        this.commitMove(item, direction, fromIndex, toIndex, expectedValues);
        return;
      }
      this.pendingMove = { ...transaction, phase: 'held' };
      this.syncBoundaryState();
      this.liveRegion?.announce(this.localize('reorderMovePending'), { force: true });
      return;
    }

    this.pendingMove = null;
    this.syncBoundaryState();
    this.commitMove(item, direction, fromIndex, toIndex, expectedValues);
  }

  /** Applies a move an `lr-reorder` listener held via `preventDefault()`, once the host's own
   *  async work (e.g. persisting the new order) has succeeded. While `controlled`, this starts
   *  waiting for the host's own matching re-render rather than moving anything itself -- see that
   *  property's own doc comment. No-op if nothing is pending. */
  finalizePendingMove(): void {
    if (!this.pendingMove) return;
    if (this.pendingMove.phase === 'dispatching') {
      this.pendingMove.resolution = 'finalize';
      return;
    }
    if (!this.pendingMembershipIsCurrent()) {
      this.revertPendingMove();
      return;
    }
    const { item, direction, fromIndex, toIndex, expectedValues } = this.pendingMove;
    this.pendingMove = null;
    this.syncBoundaryState();
    this.commitMove(item, direction, fromIndex, toIndex, expectedValues);
  }

  /** Discards a move an `lr-reorder` listener held via `preventDefault()`, leaving the list at its
   *  prior order -- e.g. once the host's own async work (e.g. persisting the new order) fails, or
   *  a host that is deferring the decision to a flow of its own (a confirmation dialog, say) and
   *  will communicate the outcome itself. Pass `{ silent: true }` to suppress the built-in
   *  `reorderMoveCancelled` announcement for that second case; the default announces exactly as
   *  before. No-op if nothing is pending. */
  revertPendingMove(options?: { silent?: boolean }): void {
    if (!this.pendingMove) return;
    if (this.pendingMove.phase === 'dispatching') {
      this.pendingMove.resolution = 'revert';
      return;
    }
    const wasHeld = this.pendingMove.phase === 'held';
    this.pendingMove = null;
    this.syncBoundaryState();
    if (wasHeld && !(options?.silent ?? false)) {
      this.liveRegion?.announce(this.localize('reorderMoveCancelled'), { force: true });
    }
  }

  private onMoveRequest = (e: Event): void => {
    const item = (e.target as Element | null)?.closest?.(
      tag('reorder-item')
    ) as LyraReorderItem | null;
    if (!item || item.parentElement !== this) return;
    const { direction } = (e as CustomEvent<{ direction: 'up' | 'down' }>)
      .detail;
    e.stopPropagation();
    this.moveItem(item, direction);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (
      !(e.ctrlKey || e.metaKey) ||
      e.altKey ||
      e.shiftKey ||
      (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')
    )
      return;
    const path = e.composedPath();
    const item = path.find(
      (target): target is LyraReorderItem =>
        target instanceof Element &&
        target.localName === tag('reorder-item') &&
        target.parentElement === this,
    );
    if (!item) return;
    const itemIndex = path.indexOf(item);
    const originatedInNestedControl = path.slice(0, itemIndex).some((target) => {
      if (!(target instanceof Element)) return false;
      // Anything the item RENDERED ITSELF is the row's own chrome, never consumer content:
      // consumer content arrives through a slot, so its root node is the document, never the
      // item's shadow root. The predicate used to exempt only a native <button> in that root,
      // which broke the moment the move controls became composed <lr-icon-button>s -- the native
      // button's root became the icon button's shadow root, and the icon-button host itself
      // matched the "custom element" arm below, so every Ctrl/Cmd+Arrow press from a move button
      // was discarded as though it had come from a consumer's own control.
      if (target.getRootNode() === item.shadowRoot) return false;
      const name = target.localName;
      return (
        name === 'a' ||
        name === 'button' ||
        name === 'input' ||
        name === 'select' ||
        name === 'textarea' ||
        target.hasAttribute('contenteditable') ||
        (name.includes('-') && target !== item)
      );
    });
    if (originatedInNestedControl) return;
    const items = this.itemElements;
    const fromIndex = items.indexOf(item);
    const toIndex = e.key === 'ArrowDown' ? fromIndex + 1 : fromIndex - 1;
    if (
      this.disabled ||
      this.pendingMove ||
      this.pendingReconciliation ||
      item.disabled ||
      fromIndex < 0 ||
      toIndex < 0 ||
      toIndex >= items.length
    ) return;
    e.preventDefault();
    this.moveItem(item, e.key === 'ArrowDown' ? 'down' : 'up');
  };

  override render(): TemplateResult {
    return html`
      <div
        part="base"
        role="list"
        aria-label=${hostAriaLabel(this) ?? (this.label || nothing)}
        aria-busy=${this.pendingMove?.phase === 'held' || this.pendingReconciliation ? 'true' : 'false'}
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
