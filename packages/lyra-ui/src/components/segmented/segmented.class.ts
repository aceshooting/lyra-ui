import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { isRtl } from '../../internal/rtl.js';
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

export interface LyraSegmentedEventMap {
  'lyra-change': CustomEvent<{ value: string }>;
}

/**
 * `<lyra-segmented>` — a single-select button row with the WAI-ARIA APG `radiogroup` contract
 * built in: `role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation (click or
 * arrow-key move both select immediately, like a native radio group), cyclic Arrow/Home/End
 * navigation among non-disabled items. First-party invention --
 * "choose exactly one of N labeled options, rendered as a button row" is ubiquitous
 * settings/filter-panel UI.
 *
 * @customElement lyra-segmented
 * @event lyra-change - Fired when the selected value changes via click or keyboard.
 *   `detail: { value }`.
 * @csspart base - The `role="radiogroup"` root.
 * @csspart segment - A single `role="radio"` button.
 * @csspart segment-icon - Optional leading visual supplied by the item's `icon` field; content
 *   may have a natural aspect ratio and is not restricted to a square icon.
 * @csspart segment-label - The segment's label text.
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
   *  unset, matching `<lyra-slider>`. */
  @property() label = '';

  private select(item: SegmentedItem): void {
    if (item.disabled || item.value === this.value) return;
    this.value = item.value;
    this.emit<{ value: string }>('lyra-change', { value: item.value });
  }

  private focusItem(value: string): void {
    const button = this.renderRoot.querySelector(`[part="segment"][data-value="${value}"]`) as HTMLElement | null;
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
    return html`
      <div part="base" role="radiogroup" aria-label=${ariaLabel} @keydown=${this.onKeyDown}>
        ${repeat(
          this.items,
          (item) => item.value,
          (item) => html`<button
            type="button"
            part="segment"
            data-value=${item.value}
            role="radio"
            aria-checked=${item.value === this.value ? 'true' : 'false'}
            aria-disabled=${item.disabled ? 'true' : 'false'}
            tabindex=${item.value === this.value ? '0' : '-1'}
            @click=${() => this.select(item)}
          >${item.icon ? html`<span part="segment-icon" aria-hidden="true">${item.icon}</span>` : nothing}<span part="segment-label">${item.label}</span></button>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-segmented': LyraSegmented;
  }
}
