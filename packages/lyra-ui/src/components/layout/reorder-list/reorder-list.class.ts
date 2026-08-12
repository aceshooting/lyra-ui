import { html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { property, query } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { tag } from "../../../internal/prefix.js";
import { hostAriaLabel } from "../../../internal/a11y.js";
import type { LyraReorderItem } from "./reorder-item.class.js";
import type { LyraLiveRegion } from "../../utility/live-region/live-region.class.js";
import { getNumberFormat } from "../../../internal/intl-cache.js";
import { styles } from "./reorder-list.styles.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_reorderItemMoved } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface ReorderDetail {
  order: string[];
  fromIndex: number;
  toIndex: number;
}

export interface LyraReorderListEventMap {
  "lr-reorder": CustomEvent<ReorderDetail>;
}

type ReorderFocusTarget = {
  item: LyraReorderItem;
  buttonPart: "move-up-button" | "move-down-button";
};

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
 * @status stable
 * @since 6.0.0
 */
export class LyraReorderList extends LyraElement<LyraReorderListEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    reorderItemMoved: LYRA_DEFAULT_reorderItemMoved,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Accessible-name fallback for the internal `role="list"` element when the host has no
   *  `aria-label`, matching `<lr-control-group>`. Native lists don't require an accessible name,
   *  so this has no forced fallback string when both are left unset. */
  @property() label = "";

  /** Disables every item's move-up/move-down buttons and the Ctrl/Cmd+Arrow shortcut, without
   *  removing any item from the DOM or mutating any item's own `disabled` attribute. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  @query("lr-live-region") private liveRegion?: LyraLiveRegion;

  /** Latest post-move focus target. A generation guard keeps a superseded async restore inert. */
  private pendingFocusTarget: ReorderFocusTarget | null = null;

  private focusRestoreGeneration = 0;

  /** Set while an `lr-reorder` listener has called `preventDefault()`, holding a move until the
   *  host calls `finalizePendingMove()` or `revertPendingMove()`. `moveItem()` refuses to start
   *  any further move while this is set -- at most one move is ever held at a time. */
  private pendingMove: {
    item: LyraReorderItem;
    direction: "up" | "down";
    fromIndex: number;
    toIndex: number;
    members: LyraReorderItem[];
  } | null = null;

  private get itemElements(): LyraReorderItem[] {
    const itemTag = tag("reorder-item");
    return [...this.children].filter(
      (element): element is LyraReorderItem => element.localName === itemTag
    );
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
    if (this.pendingMove && !this.pendingMembershipIsCurrent())
      this.revertPendingMove();
    this.syncBoundaryState();
  };

  private pendingMembershipIsCurrent(): boolean {
    if (!this.pendingMove) return false;
    const current = this.itemElements;
    return (
      current.length === this.pendingMove.members.length &&
      current.every((item, index) => item === this.pendingMove!.members[index])
    );
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has("disabled")) this.syncBoundaryState();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.pendingFocusTarget = null;
    this.focusRestoreGeneration += 1;
    if (this.pendingMove) {
      this.pendingMove.item.pending = false;
      this.pendingMove = null;
    }
  }

  private orderValues(items: LyraReorderItem[]): string[] {
    return items.map((item, i) => item.value ?? String(i));
  }

  private scheduleFocusRestore(): void {
    this.scheduleAfterUpdate(() => {
      const focusTarget = this.pendingFocusTarget;
      if (!focusTarget) return;
      void this.restoreFocusAfterItemUpdate(
        focusTarget,
        this.focusRestoreGeneration
      );
    }, "reorder-focus");
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
    const button = focusTarget.item.shadowRoot?.querySelector(
      `[part='${focusTarget.buttonPart}']`
    ) as HTMLButtonElement | null;
    if (!button?.disabled) button?.focus();
  }

  /** Physically moves `item` (already known to belong at `toIndex`) and runs the same
   *  boundary-recompute / focus-restore / announce steps for both the immediate (uncanceled) path
   *  and a later `finalizePendingMove()` call. */
  private applyMove(
    item: LyraReorderItem,
    direction: "up" | "down",
    _fromIndex: number,
    toIndex: number
  ): void {
    const items = this.itemElements;
    // safe: callers validate toIndex ∈ [0, items.length - 1] before applyMove (see move handler)
    const target = items[toIndex]!;
    if (direction === "up") this.insertBefore(item, target);
    else this.insertBefore(item, target.nextElementSibling);

    this.syncBoundaryState();

    // Focus the same-direction button if it's still usable after the move; otherwise the move
    // just made this item a new boundary in that direction (it would get force-blurred the
    // instant Lit's next render sets it `disabled`), so fall back to the other button instead.
    const sameDirDisabled = direction === "up" ? item.atStart : item.atEnd;
    const buttonPart = sameDirDisabled
      ? direction === "up"
        ? "move-down-button"
        : "move-up-button"
      : direction === "up"
      ? "move-up-button"
      : "move-down-button";
    this.pendingFocusTarget = { item, buttonPart };
    this.focusRestoreGeneration += 1;
    this.scheduleFocusRestore();

    const newItems = this.itemElements;
    const number = getNumberFormat(this.effectiveLocale);
    this.liveRegion?.announce(
      this.localize("reorderItemMoved", undefined, {
        index: number.format(toIndex + 1),
        total: number.format(newItems.length),
      }),
      // A discrete, user-initiated action: never coalesce it behind the announcer's throttle
      // window the way streaming status text is -- matches <lr-tree>'s identical reorder announcement.
      { force: true }
    );
  }

  private moveItem(item: LyraReorderItem, direction: "up" | "down"): void {
    if (this.disabled || item.disabled || this.pendingMove) return;
    const items = this.itemElements;
    const fromIndex = items.indexOf(item);
    if (fromIndex < 0) return;
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= items.length) return;

    // Compute the order the move WOULD produce, without touching the DOM yet -- the event fires
    // before the move so a listener can still veto it.
    const reordered = items.slice();
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, item);

    const event = this.emit(
      "lr-reorder",
      { order: this.orderValues(reordered), fromIndex, toIndex },
      { cancelable: true }
    );
    if (event.defaultPrevented) {
      this.pendingMove = {
        item,
        direction,
        fromIndex,
        toIndex,
        members: [...items],
      };
      item.pending = true;
      return;
    }

    this.applyMove(item, direction, fromIndex, toIndex);
  }

  /** Applies a move an `lr-reorder` listener held via `preventDefault()`, once the host's own
   *  async work (e.g. persisting the new order) has succeeded. No-op if nothing is pending. */
  finalizePendingMove(): void {
    if (!this.pendingMove) return;
    if (!this.pendingMembershipIsCurrent()) {
      this.revertPendingMove();
      return;
    }
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
    const item = (e.target as Element | null)?.closest?.(
      tag("reorder-item")
    ) as LyraReorderItem | null;
    if (!item || item.parentElement !== this) return;
    const { direction } = (e as CustomEvent<{ direction: "up" | "down" }>)
      .detail;
    e.stopPropagation();
    this.moveItem(item, direction);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.disabled) return;
    if (
      !(e.ctrlKey || e.metaKey) ||
      (e.key !== "ArrowUp" && e.key !== "ArrowDown")
    )
      return;
    const item = (e.target as Element | null)?.closest?.(
      tag("reorder-item")
    ) as LyraReorderItem | null;
    if (!item) return;
    e.preventDefault();
    this.moveItem(item, e.key === "ArrowDown" ? "down" : "up");
  };

  override render(): TemplateResult {
    return html`
      <div
        part="base"
        role="list"
        aria-label=${hostAriaLabel(this) ?? (this.label || nothing)}
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
    "lr-reorder-list": LyraReorderList;
  }
}
