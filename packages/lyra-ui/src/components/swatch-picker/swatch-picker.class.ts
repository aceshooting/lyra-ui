import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { isRtl } from '../../internal/rtl.js';
import { styles } from './swatch-picker.styles.js';

export interface SwatchOption {
  /** The option's value -- reported in `lyra-change` and matched against `value`. */
  value: string;
  /** The swatch's fill color -- any CSS color string the consumer supplies. */
  color: string;
  /** The swatch's accessible name; also used as its native `title` tooltip. */
  label: string;
}

export interface LyraSwatchPickerEventMap {
  'lyra-change': CustomEvent<{ value: string }>;
}

/**
 * `<lyra-swatch-picker>` -- a single-select picker over a small, fixed set of color swatches with
 * the WAI-ARIA APG `radiogroup` contract built in: `role="radiogroup"`/`role="radio"`, roving
 * tabindex, automatic activation (click or arrow-key move both select immediately, like a native
 * radio group), cyclic Arrow/Home/End navigation. Distinct from `<lyra-color-picker>`'s freeform
 * native color input -- this picks exactly one of N designer-chosen named colors, the shape apps
 * otherwise hand-roll as a row of round accent-color buttons.
 *
 * @customElement lyra-swatch-picker
 * @event lyra-change - Fired when the selected value changes via click or keyboard.
 *   `detail: { value }`.
 * @csspart base - The `role="radiogroup"` root.
 * @csspart swatch - A single `role="radio"` color swatch; the selected one is
 *   `[part='swatch'][aria-checked='true']`.
 * @cssprop [--lyra-swatch-picker-selected-color=var(--lyra-color-brand)] - Ring color drawn around
 *   the selected swatch, themeable independently of the focus ring and every other ring color.
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
   *  unset, matching `<lyra-segmented>`. */
  @property() label = '';

  private select(option: SwatchOption): void {
    if (option.value === this.value) return;
    this.value = option.value;
    this.emit<{ value: string }>('lyra-change', { value: option.value });
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
            style=${styleMap({ '--lyra-swatch-color': option.color })}
            @click=${() => this.select(option)}
          ></button>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-swatch-picker': LyraSwatchPicker;
  }
}
