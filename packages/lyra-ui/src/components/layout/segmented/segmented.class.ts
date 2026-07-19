import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import { styles } from './segmented.styles.js';

export interface SegmentedItem {
  value: string;
  label: string;
  /** Optional leading visual rendered before the label. This is intentionally general content,
   *  not a square-icon-only field: SVG icons, flag glyphs, badges, and other natural-aspect-ratio
   *  Lit content are supported. */
  icon?: unknown;
  disabled?: boolean;
}

export type LyraSegmentedSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

export interface LyraSegmentedEventMap {
  'lr-change': CustomEvent<{ value: string }>;
}

/**
 * `<lr-segmented>` — a single-select button row with the WAI-ARIA APG `radiogroup` contract
 * built in: `role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation (click or
 * arrow-key move both select immediately, like a native radio group), cyclic Arrow/Home/End
 * navigation among non-disabled items. First-party invention --
 * "choose exactly one of N labeled options, rendered as a button row" is ubiquitous
 * settings/filter-panel UI. Supports the same `2xs`-`xl` compact-form-control `size` scale as
 * `<lr-select>`/`<lr-combobox>`/`<lr-input>`, so it can sit flush beside those controls in a
 * toolbar at a matching height.
 *
 * @customElement lr-segmented
 * @event lr-change - Fired when the selected value changes via click or keyboard.
 *   `detail: { value }`.
 * @csspart base - The `role="radiogroup"` root.
 * @csspart segment - A single `role="radio"` button.
 * @csspart segment-icon - Optional leading visual supplied by the item's `icon` field; content
 *   may have a natural aspect ratio and is not restricted to a square icon.
 * @csspart segment-label - The segment's label text.
 * @cssprop [--lr-scroll-fade-size=2rem] - Width of the static fade at each horizontal scroll edge.
 */
export class LyraSegmented extends LyraElement<LyraSegmentedEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The button row's items. */
  @property({ attribute: false }) items: SegmentedItem[] = [];

  /** The currently selected item's `value`. */
  @property() value = '';

  /** Accessible name for the radiogroup, used when no visible label context
   *  exists around it (e.g. no wrapping `<label>` or adjacent heading). Set
   *  as `aria-label` on the `role="radiogroup"` element. A plain `aria-label`
   *  attribute on the host itself is honored as a fallback when this is left
   *  unset, matching `<lr-slider>`. */
  @property() label = '';

  /** Visual size — same `2xs`-`xl` scale as `<lr-select>`/`<lr-combobox>` (`s` through `xl`)
   *  and `<lr-input>` (`2xs`). Reflects as the `size` attribute. The default `m` tier is
   *  identical to this component's pre-`size` rendering, so leaving it unset never changes
   *  output. */
  @property({ reflect: true }) size: LyraSegmentedSize = 'm';

  private select(item: SegmentedItem): void {
    if (item.disabled || item.value === this.value) return;
    this.value = item.value;
    this.emit<{ value: string }>('lr-change', { value: item.value });
  }

  private focusItem(value: string): void {
    const button = this.renderRoot.querySelector(
      `[part="segment"][data-value="${CSS.escape(value)}"]`,
    ) as HTMLElement | null;
    button?.focus();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.items.filter((i) => !i.disabled);
    if (navigable.length === 0) return;
    const currentIndex = navigable.findIndex((i) => i.value === this.value);
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';

    let targetIndex: number;
    switch (e.key) {
      case forwardKey:
        targetIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % navigable.length;
        break;
      case backwardKey:
        targetIndex = currentIndex < 0 ? navigable.length - 1 : (currentIndex - 1 + navigable.length) % navigable.length;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = navigable.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = navigable[targetIndex]!;
    this.select(target);
    this.focusItem(target.value);
  };

  render(): TemplateResult {
    const ariaLabel = this.label || this.getAttribute('aria-label') || nothing;
    // WAI-ARIA APG radiogroup: exactly one non-disabled radio is ever tabbable.
    // That's normally the checked item, but a fresh/cleared radiogroup has no
    // checked item at all -- falling back to `item.value === this.value` alone
    // would then match nothing and drop every button out of the tab order, so
    // fall back to the first non-disabled item when nothing is selected (or the
    // selected value doesn't match a current, non-disabled item).
    const selectedIndex = this.items.findIndex((item) => item.value === this.value && !item.disabled);
    const tabbableIndex = selectedIndex !== -1 ? selectedIndex : this.items.findIndex((item) => !item.disabled);
    return html`
      <div part="base" role="radiogroup" aria-label=${ariaLabel} @keydown=${this.onKeyDown}>
        ${repeat(
          this.items,
          (item) => item.value,
          (item, index) => html`<button
            type="button"
            part="segment"
            data-value=${item.value}
            role="radio"
            aria-checked=${item.value === this.value ? 'true' : 'false'}
            aria-disabled=${item.disabled ? 'true' : 'false'}
            tabindex=${index === tabbableIndex ? '0' : '-1'}
            @click=${() => this.select(item)}
          >${item.icon ? html`<span part="segment-icon" aria-hidden="true">${item.icon}</span>` : nothing}<span part="segment-label">${item.label}</span></button>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-segmented': LyraSegmented;
  }
}
