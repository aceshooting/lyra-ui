import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './chip-group.styles.js';

export interface ChipGroupOverflowToggleDetail {
  expanded: boolean;
}

export interface LyraChipGroupEventMap {
  'lyra-overflow-toggle': CustomEvent<ChipGroupOverflowToggleDetail>;
}

/**
 * `<lyra-chip-group>` — a flex-wrap container for a set of `<lyra-chip>`
 * children (plain light-DOM composition — direct children are the chips,
 * the same shape `<lyra-split>`'s panels / `<lyra-source-list>`'s cards
 * take — no `.items` array prop).
 *
 * `max-visible` is entirely optional. When unset, every child is always
 * shown and this component does nothing beyond flex-wrap layout. When set
 * and the group has more chip children than that, the excess children are
 * hidden (via their own `hidden` property — CSS alone can't parameterize
 * `:nth-child` on a runtime prop, so this reaches into the light DOM the
 * same way `<lyra-split>` sets each panel's inline `flex`/`order`) and a
 * "+N" overflow-indicator pill takes their place. Clicking it is a toggle:
 * it reveals the rest (and relabels itself "Show less"); clicking again
 * re-collapses back to `max-visible`. `lyra-overflow-toggle` fires only from
 * that click — i.e. only when `max-visible` is actually causing an overflow
 * state — never as a side effect of `max-visible`/children changing on
 * their own.
 *
 * @customElement lyra-chip-group
 * @slot - `<lyra-chip>` elements (or any content, though the chip pairing is
 * the intended usage).
 * @event lyra-overflow-toggle - The overflow indicator was activated,
 * revealing or re-collapsing the excess children. `detail: { expanded }`.
 * @csspart base - The flex-wrap container (holds both the slot and the overflow indicator).
 * @csspart overflow-indicator - The "+N" / "Show less" toggle button. Only rendered while `max-visible` is actively causing an overflow.
 */
export class LyraChipGroup extends LyraElement<LyraChipGroupEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Maximum number of assigned children shown before the rest collapse behind a "+N"
   *  indicator. Flattened slot-forwarded children count the same as direct light-DOM children.
   *  Unset (the default) means no limit — every child is always shown. */
  @property({ type: Number, attribute: 'max-visible' }) maxVisible?: number;

  // Tracks the default slot's assigned-element count, the same
  // connectedCallback/willUpdate + slotchange convention `<lyra-split>`'s
  // `panelCount`/`<lyra-source-list>`'s `slottedCount` already establish.
  @state() private childCount = 0;

  /** Whether the excess (beyond `max-visible`) children are currently
   *  revealed. Meaningless (and never rendered) while there's no overflow. */
  @state() private expanded = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.childCount = this.children.length;
    }
    // max-visible/children can change out from under an already-expanded
    // group (e.g. the consumer raises max-visible past the current count) —
    // silently resync rather than leaving `expanded` stuck true with nothing
    // left for it to mean. This never fires the event: only an actual click
    // on the indicator does (see the class doc). Corrected here (not in
    // `updated()`) so it folds into the update already in progress instead
    // of scheduling a second one.
    if (this.expanded && !this.hasOverflow) this.expanded = false;
  }

  firstUpdated(): void {
    // Fallback reconciliation for slot-forwarding / engines that don't fire
    // `slotchange` for content present at parse time — same idiom as
    // `<lyra-source-list>`'s identical `firstUpdated`. This can't move to
    // `willUpdate` (the `<slot>` doesn't exist in the shadow DOM until after
    // the first render), so when it actually corrects `childCount` (the
    // slot-forwarding case, where `this.children.length` under-counts) it
    // unavoidably schedules a second update pass — `updated()` (below) always
    // runs right after this and already recomputes visibility from this same
    // corrected count, so there's nothing left for an explicit call here to
    // do.
    const slot = this.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    this.childCount = slot.assignedElements({ flatten: true }).length;
  }

  protected updated(): void {
    this.syncChildVisibility();
  }

  private get hasOverflow(): boolean {
    const max = this.maxVisible;
    return max != null && Number.isFinite(max) && max >= 0 && this.childCount > max;
  }

  private syncChildVisibility(): void {
    const max = this.maxVisible;
    const overflowing = this.hasOverflow;
    const slot = this.shadowRoot?.querySelector('slot');
    const assignedChildren = slot?.assignedElements({ flatten: true }) ?? Array.from(this.children);
    assignedChildren.forEach((child, i) => {
      (child as HTMLElement).hidden = overflowing && !this.expanded && i >= (max as number);
    });
  }

  private onSlotChange = (e: Event): void => {
    this.childCount = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length;
  };

  private onToggleOverflow = (): void => {
    this.expanded = !this.expanded;
    this.emit<ChipGroupOverflowToggleDetail>('lyra-overflow-toggle', { expanded: this.expanded });
  };

  render(): TemplateResult {
    const overflowing = this.hasOverflow;
    const hiddenCount = overflowing ? this.childCount - (this.maxVisible as number) : 0;

    return html`
      <div part="base">
        <slot @slotchange=${this.onSlotChange}></slot>
        ${overflowing
          ? html`<button
              part="overflow-indicator"
              type="button"
              aria-expanded=${this.expanded ? 'true' : 'false'}
              aria-label=${this.expanded ? this.localize('showLess') : this.localize('showMoreCount', undefined, { count: hiddenCount })}
              @click=${this.onToggleOverflow}
            >
              ${this.expanded
                ? this.localize('showLess')
                : this.localize('showMoreCollapsed', undefined, { count: hiddenCount })}
            </button>`
          : nothing}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-chip-group': LyraChipGroup;
  }
}
