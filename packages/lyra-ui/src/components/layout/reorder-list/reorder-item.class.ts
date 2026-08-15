import { html, type PropertyValues, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { nextId } from "../../../internal/a11y.js";
import { composedAccessibilityTextResult } from "../../../internal/accessibility-visibility.js";
import { chevronIcon } from "../../../internal/icons.js";
import { setCustomState } from "../../../internal/custom-states.js";
import { styles } from "./reorder-item.styles.js";
import { reorderOwnerUpdate, type ReorderOwnerState } from "./reorder-owner.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_moveDown, LYRA_DEFAULT_moveUp } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraReorderItemEventMap {
  "lr-move-request": CustomEvent<{ direction: "up" | "down" }>;
}

function isReorderOwnerState(value: unknown): value is ReorderOwnerState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Record<keyof ReorderOwnerState, unknown>>;
  return (
    typeof candidate.atStart === "boolean" &&
    typeof candidate.atEnd === "boolean" &&
    typeof candidate.listDisabled === "boolean" &&
    typeof candidate.pending === "boolean" &&
    typeof candidate.busy === "boolean" &&
    typeof candidate.validIdentity === "boolean"
  );
}

/**
 * `<lr-reorder-item>` — one row inside `<lr-reorder-list>`. Renders arbitrary slotted content plus
 * move-up/move-down buttons. This item alone doesn't know whether it's first or last in the list,
 * so its readonly boundary-disabled state (`atStart`/`atEnd`), list-level cascade
 * (`listDisabled`), and held-move state (`pending`) are resolved by the owning
 * `<lr-reorder-list>`.
 *
 * @customElement lr-reorder-item
 * @slot - Arbitrary row content (a label, a mini-form, anything).
 * @event lr-move-request - `detail: { direction: 'up' | 'down' }` — a move button was activated
 * while not disabled. Bubbles (composed) to the owning `<lr-reorder-list>`, which performs the
 * actual move and boundary-state recomputation.
 * @csspart base - The row's root wrapper.
 * @csspart move-up-button - The move-up button.
 * @csspart move-down-button - The move-down button.
 * @csspart content - Wrapper around the default slot.
 * @cssstate at-start - This is the first valid item in its owning list.
 * @cssstate at-end - This is the last valid item in its owning list.
 * @cssstate list-disabled - The owning list is disabled.
 * @cssstate pending - This item's proposed move is held for host resolution.
 * @cssstate busy - Some move in the owning list is held for host resolution.
 * @cssstate invalid-identity - The required stable value is missing or duplicated in the list.
 * @cssprop [--lr-reorder-item-gap=var(--lr-space-xs)] - Gap between the move buttons and content.
 * Move-button state properties are resolved as inline fallbacks, so setting one on an item or any
 * ancestor themes only the requested hover or pressed state without replacing shared brand tokens.
 * @cssprop [--lr-reorder-item-move-button-hover-bg=var(--lr-color-brand-quiet)] - Background of a
 *   hovered move button.
 * @cssprop [--lr-reorder-item-move-button-hover-color=var(--lr-color-brand)] - Text color of a
 *   hovered move button.
 * @cssprop [--lr-reorder-item-move-button-active-bg=color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Background of a pressed move button.
 * @cssprop [--lr-reorder-item-move-button-active-color=var(--lr-color-brand)] - Text color of a
 *   pressed move button.
 * @status stable
 * @since 6.0.0
 */
export class LyraReorderItem extends LyraElement<LyraReorderItemEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    moveDown: LYRA_DEFAULT_moveDown,
    moveUp: LYRA_DEFAULT_moveUp,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private readonly reorderInternals = this.attachInternals();
  private readonly moveUpLabelId = nextId("reorder-move-up");
  private readonly moveDownLabelId = nextId("reorder-move-down");
  private readonly itemLabelId = nextId("reorder-item-label");
  private owner: object | null = null;
  private ownerState: ReorderOwnerState = {
    atStart: false,
    atEnd: false,
    listDisabled: false,
    pending: false,
    busy: false,
    validIdentity: false,
  };
  private contentObserver?: MutationObserver;

  /** Required unique, nonempty stable identifier included in the parent list's emitted
   * `lr-reorder` order array. An owning list excludes an item with a missing, whitespace-only, or
   * duplicate value from movement until its identity becomes valid. */
  @property() value = "";

  /** Explicit item identity used to correlate this row's repeated move actions. When absent, a
   * bounded accessible-text projection of the row content is used. */
  @property({ attribute: "accessible-label" }) accessibleLabel?: string;

  /** Disables this row's own move-up/move-down buttons without removing it or its slotted content
   *  from the DOM. Does not gate the default slot's own content. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Whether this is the first valid item in the owning list. Readonly. */
  get atStart(): boolean {
    return this.ownerState.atStart;
  }

  /** Whether this is the last valid item in the owning list. Readonly. */
  get atEnd(): boolean {
    return this.ownerState.atEnd;
  }

  /** Effective owning-list disabled state. Readonly; it never mutates this item's authored
   * `disabled` property. */
  get listDisabled(): boolean {
    return this.ownerState.listDisabled;
  }

  /** Whether this item's proposed move is held pending host resolution. Readonly and exposed as
   * the `:state(pending)` custom state. */
  get pending(): boolean {
    return this.ownerState.pending;
  }

  /** @internal Applies state from the reorder list that currently owns this item. */
  [reorderOwnerUpdate](owner: object, state?: unknown): void {
    if (!isReorderOwnerState(state)) {
      if (this.owner === owner) {
        this.owner = null;
        this.setOwnerState({
          atStart: false,
          atEnd: false,
          listDisabled: false,
          pending: false,
          busy: false,
          validIdentity: false,
        });
      }
      return;
    }
    this.owner = owner;
    this.setOwnerState(state);
  }

  private setOwnerState(state: ReorderOwnerState): void {
    const previous = this.ownerState;
    if (
      previous.atStart === state.atStart &&
      previous.atEnd === state.atEnd &&
      previous.listDisabled === state.listDisabled &&
      previous.pending === state.pending &&
      previous.busy === state.busy &&
      previous.validIdentity === state.validIdentity
    )
      return;
    this.ownerState = state;
    setCustomState(this.reorderInternals, "at-start", state.atStart);
    setCustomState(this.reorderInternals, "at-end", state.atEnd);
    setCustomState(this.reorderInternals, "list-disabled", state.listDisabled);
    setCustomState(this.reorderInternals, "pending", state.pending);
    setCustomState(this.reorderInternals, "busy", state.busy);
    setCustomState(
      this.reorderInternals,
      "invalid-identity",
      !state.validIdentity
    );
    this.requestUpdate();
  }

  private get moveUpDisabled(): boolean {
    const hasValidIdentity =
      this.owner === null
        ? this.value.trim().length > 0
        : this.ownerState.validIdentity;
    return (
      this.disabled ||
      this.listDisabled ||
      this.ownerState.busy ||
      !hasValidIdentity ||
      this.atStart
    );
  }

  private get moveDownDisabled(): boolean {
    const hasValidIdentity =
      this.owner === null
        ? this.value.trim().length > 0
        : this.ownerState.validIdentity;
    return (
      this.disabled ||
      this.listDisabled ||
      this.ownerState.busy ||
      !hasValidIdentity ||
      this.atEnd
    );
  }

  private get resolvedItemLabel(): string {
    if (this.accessibleLabel !== undefined) return this.accessibleLabel;
    return composedAccessibilityTextResult(this.childNodes, {
      ancestorBoundary: this,
      maxCharacters: 256,
      maxDepth: 16,
      maxNodes: 128,
      requireRendered: false,
      skipRootAncestorValidation: true,
    }).text;
  }

  private refreshContentObserver(): void {
    this.contentObserver?.disconnect();
    const Observer = this.ownerDocument.defaultView?.MutationObserver;
    if (!Observer || !this.isConnected) return;
    this.contentObserver = new Observer(() => this.requestUpdate());
    this.contentObserver.observe(this, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
      attributeFilter: [
        "alt",
        "aria-label",
        "aria-labelledby",
        "hidden",
        "inert",
        "title",
      ],
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.refreshContentObserver();
  }

  override disconnectedCallback(): void {
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
    super.disconnectedCallback();
  }

  private onMoveUpClick = (): void => {
    if (this.moveUpDisabled) return;
    this.emit("lr-move-request", { direction: "up" });
  };

  private onMoveDownClick = (): void => {
    if (this.moveDownDisabled) return;
    this.emit("lr-move-request", { direction: "down" });
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.setAttribute("role", "listitem");
  }

  override render(): TemplateResult {
    const itemLabel = this.resolvedItemLabel;
    return html`
      <div part="base">
        <span id=${this.moveUpLabelId} hidden>${this.localize("moveUp")}</span>
        <span id=${this.moveDownLabelId} hidden
          >${this.localize("moveDown")}</span
        >
        <span id=${this.itemLabelId} hidden>${itemLabel}</span>
        <button
          part="move-up-button"
          type="button"
          aria-labelledby=${`${this.moveUpLabelId} ${this.itemLabelId}`}
          ?disabled=${this.moveUpDisabled}
          @click=${this.onMoveUpClick}
        >
          ${chevronIcon()}
        </button>
        <button
          part="move-down-button"
          type="button"
          aria-labelledby=${`${this.moveDownLabelId} ${this.itemLabelId}`}
          ?disabled=${this.moveDownDisabled}
          @click=${this.onMoveDownClick}
        >
          ${chevronIcon()}
        </button>
        <span part="content"
          ><slot @slotchange=${this.refreshContentObserver}></slot
        ></span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-reorder-item": LyraReorderItem;
  }
}
