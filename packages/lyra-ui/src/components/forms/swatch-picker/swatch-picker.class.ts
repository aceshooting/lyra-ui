import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import { styles } from './swatch-picker.styles.js';

export interface SwatchOption {
  /** The option's value -- reported in `lr-change` and matched against `value`. */
  value: string;
  /** The swatch's fill color -- any CSS color string the consumer supplies. */
  color: string;
  /** The swatch's accessible name; also used as its native `title` tooltip. */
  label: string;
  /** Optional custom shape rendered in place of the plain filled circle -- e.g. a gem or other
   *  brand-specific glyph. A `currentColor`-based SVG (fill or stroke) picks up `color` automatically
   *  via the swatch's `color` CSS property, matching `<lr-segmented>`'s `SegmentedItem.icon` field. */
  icon?: unknown;
}

export interface LyraSwatchPickerEventMap {
  'lr-change': CustomEvent<{ value: string }>;
}

/**
 * `<lr-swatch-picker>` -- a single-select picker over a small, fixed set of color swatches with
 * the WAI-ARIA APG `radiogroup` contract built in: `role="radiogroup"`/`role="radio"`, roving
 * tabindex, automatic activation (click or arrow-key move both select immediately, like a native
 * radio group), cyclic Arrow/Home/End navigation. Distinct from `<lr-color-picker>`'s freeform
 * native color input -- this picks exactly one of N designer-chosen named colors, the shape apps
 * otherwise hand-roll as a row of round accent-color buttons.
 *
 * @customElement lr-swatch-picker
 * @event lr-change - Fired when the selected value changes via click or keyboard.
 *   `detail: { value }`.
 * @csspart base - The `role="radiogroup"` root.
 * @csspart swatch - A single `role="radio"` color swatch's interactive hit target; sized to the
 *   shared minimum tappable size (`--lr-icon-button-size`), independent of the smaller visible
 *   fill/icon rendered inside it. The selected one is `[part='swatch'][aria-checked='true']`.
 * @csspart swatch-fill - The compact filled circle rendered when the option has no custom `icon`.
 * @csspart swatch-icon - Optional custom shape supplied by the option's `icon` field; when present it
 *   replaces `swatch-fill` and the swatch renders unfilled/unbordered behind it.
 * @cssprop [--lr-swatch-picker-selected-color=var(--lr-color-brand)] - Ring color drawn around
 *   the selected swatch, themeable independently of the focus ring and every other ring color.
 * @cssprop [--lr-swatch-picker-selected-blur=0px] - Blur radius of that same ring. 0 by default
 *   (a crisp ring); set a real length (e.g. 0.4rem) for a soft glow instead.
 * @cssprop [--lr-swatch-picker-shine-duration=0s] - Duration of a rhythmic brighten-and-settle
 *   "shine" on the selected swatch. `0s` (the default) is a no-op -- today's static look for every
 *   existing consumer. Set a real duration (e.g. 1.6s) for a pulsing shine; disabled outright under
 *   `prefers-reduced-motion: reduce`. Independent of `--lr-swatch-picker-selected-blur` (a separate
 *   `filter: brightness()` animation, not `box-shadow`), so the two compose freely, and works
 *   identically for a plain color circle and an icon swatch alike.
 */
export class LyraSwatchPicker extends LyraElement<LyraSwatchPickerEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The selectable color swatches, in display order. */
  @property({ attribute: false }) options: SwatchOption[] = [];

  /** The currently selected option's `value`, or `null` when nothing is selected. */
  @property() value: string | null = null;

  /** Accessible name for the radiogroup, used when no visible label context
   *  exists around it (e.g. no wrapping `<label>` or adjacent heading). Set
   *  as `aria-label` on the `role="radiogroup"` element. A plain `aria-label`
   *  attribute on the host itself is honored as a fallback when this is left
   *  unset, matching `<lr-segmented>`. */
  @property() label = '';

  private select(option: SwatchOption): void {
    if (option.value === this.value) return;
    this.value = option.value;
    this.emit<{ value: string }>('lr-change', { value: option.value });
  }

  private focusSwatch(value: string): void {
    const button = this.renderRoot.querySelector(
      `[part="swatch"][data-value="${CSS.escape(value)}"]`,
    ) as HTMLElement | null;
    button?.focus();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.options;
    if (navigable.length === 0) return;
    const currentIndex = navigable.findIndex((o) => o.value === this.value);
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
    this.focusSwatch(target.value);
  };

  render(): TemplateResult {
    const ariaLabel = this.label || this.getAttribute('aria-label') || nothing;
    // WAI-ARIA APG radiogroup: exactly one radio is ever tabbable. That's normally the checked
    // swatch, but a fresh/cleared picker (value === null) has no checked swatch -- fall back to
    // the first swatch so the radiogroup stays keyboard-reachable.
    const selectedIndex = this.options.findIndex((option) => option.value === this.value);
    const tabbableIndex = selectedIndex !== -1 ? selectedIndex : 0;
    return html`
      <div part="base" role="radiogroup" aria-label=${ariaLabel} @keydown=${this.onKeyDown}>
        ${repeat(
          this.options,
          (option) => option.value,
          (option, index) => html`<button
            type="button"
            part="swatch"
            data-value=${option.value}
            role="radio"
            aria-checked=${option.value === this.value ? 'true' : 'false'}
            aria-label=${option.label}
            title=${option.label}
            tabindex=${index === tabbableIndex ? '0' : '-1'}
            style=${styleMap({ '--lr-swatch-color': option.color })}
            @click=${() => this.select(option)}
          >${
            option.icon
              ? html`<span part="swatch-icon" aria-hidden="true">${option.icon}</span>`
              : html`<span part="swatch-fill" aria-hidden="true"></span>`
          }</button>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-swatch-picker': LyraSwatchPicker;
  }
}
