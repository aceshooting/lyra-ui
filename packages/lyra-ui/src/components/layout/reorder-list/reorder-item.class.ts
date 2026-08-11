import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon } from '../../../internal/icons.js';
import { styles } from './reorder-item.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_moveDown, LYRA_DEFAULT_moveUp } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraReorderItemEventMap {
  'lr-move-request': CustomEvent<{ direction: 'up' | 'down' }>;
}

/**
 * `<lr-reorder-item>` — one row inside `<lr-reorder-list>`. Renders arbitrary slotted content plus
 * move-up/move-down buttons. This item alone doesn't know whether it's first or last in the list,
 * so its boundary-disabled state (`atStart`/`atEnd`), list-level cascade (`listDisabled`), and
 * held-move state (`pending`) are all pushed down by the parent `<lr-reorder-list>` — normally
 * set internally, not by consumers.
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

  /** Stable identifier included in the parent list's emitted `lr-reorder` order array. Falls back
   *  to this item's live DOM-position index (stringified) when unset — a consumer that cares about
   *  stable identity across moves should set this explicitly, since the fallback string changes as
   *  the item's position changes. */
  @property() value?: string;

  /** Disables this row's own move-up/move-down buttons without removing it or its slotted content
   *  from the DOM. Does not gate the default slot's own content. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Whether this is the first item in the parent list — disables the move-up button. Pushed down
   *  by `<lr-reorder-list>` after every slot change or move; normally set internally. */
  @property({ type: Boolean, attribute: false }) atStart = false;

  /** Whether this is the last item in the parent list — disables the move-down button. Pushed down
   *  by `<lr-reorder-list>` after every slot change or move; normally set internally. */
  @property({ type: Boolean, attribute: false }) atEnd = false;

  /** Cascades the parent list's own `disabled` without mutating this item's own `disabled`
   *  attribute — clearing the list-level flag later restores this item to whatever its own
   *  `disabled` was already set to, the same cascade-without-mutation contract a native
   *  `<fieldset disabled>` has. Pushed down by `<lr-reorder-list>`; normally set internally. */
  @property({ type: Boolean, attribute: false }) listDisabled = false;

  /** Whether this item's move is currently held pending host resolution, after an `lr-reorder`
   *  listener on the parent `<lr-reorder-list>` called `preventDefault()`. Purely informational —
   *  it does not itself disable this item's move buttons (the list already refuses to start any
   *  further move while one is pending, so a second click here is already a no-op); style it via
   *  `lr-reorder-item[pending]` if desired. Pushed down by `<lr-reorder-list>`; normally set
   *  internally, not by consumers. */
  @property({ type: Boolean, reflect: true }) pending = false;

  private get moveUpDisabled(): boolean {
    return this.disabled || this.listDisabled || this.atStart;
  }

  private get moveDownDisabled(): boolean {
    return this.disabled || this.listDisabled || this.atEnd;
  }

  private onMoveUpClick = (): void => {
    if (this.moveUpDisabled) return;
    this.emit('lr-move-request', { direction: 'up' });
  };

  private onMoveDownClick = (): void => {
    if (this.moveDownDisabled) return;
    this.emit('lr-move-request', { direction: 'down' });
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.setAttribute('role', 'listitem');
  }

  override render(): TemplateResult {
    return html`
      <div part="base">
        <button
          part="move-up-button"
          type="button"
          aria-label=${this.localize('moveUp')}
          ?disabled=${this.moveUpDisabled}
          @click=${this.onMoveUpClick}
        >
          ${chevronIcon()}
        </button>
        <button
          part="move-down-button"
          type="button"
          aria-label=${this.localize('moveDown')}
          ?disabled=${this.moveDownDisabled}
          @click=${this.onMoveDownClick}
        >
          ${chevronIcon()}
        </button>
        <span part="content"><slot></slot></span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-reorder-item': LyraReorderItem;
  }
}
