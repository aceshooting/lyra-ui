import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { finiteInteger, finiteNumber } from '../../internal/numbers.js';
import { styles } from './format.styles.js';
import { getNumberFormat } from '../../internal/intl-cache.js';

/** `Intl.NumberFormat`'s own accepted range for `minimumFractionDigits`/`maximumFractionDigits` —
 *  a non-finite value, or one outside `[0, 100]`, makes its constructor throw a `RangeError`,
 *  which would otherwise crash the whole render from a single bad attribute. Passing both bounds
 *  with `minimum > maximum` throws too, even when each is individually in range. */
const MAX_FRACTION_DIGITS = 100;

/**
 * `<lyra-format-number>` — locale-aware `Intl.NumberFormat` output.
 *
 * @customElement lyra-format-number
 * @slot - Fallback content when the value is not finite.
 */
export class LyraFormatNumber extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property({ type: Number }) value = 0;
  @property() currency = '';
  @property() notation: 'standard' | 'compact' | 'scientific' | 'engineering' = 'standard';
  @property({ attribute: 'minimum-fraction-digits', type: Number }) minimumFractionDigits?: number;
  @property({ attribute: 'maximum-fraction-digits', type: Number }) maximumFractionDigits?: number;

  /** `minimumFractionDigits`/`maximumFractionDigits`, each normalized to a finite integer clamped
   *  to `Intl.NumberFormat`'s own accepted `[0, 100]` range, and — when both are set — reordered
   *  (rather than left to throw) if clamping left `minimum > maximum`. Left `undefined` when the
   *  source property itself is `undefined`, so an author who sets neither still gets
   *  `Intl.NumberFormat`'s own notation-driven defaults instead of an arbitrary forced pair. */
  private get fractionDigits(): { minimumFractionDigits?: number; maximumFractionDigits?: number } {
    let minimumFractionDigits =
      this.minimumFractionDigits === undefined
        ? undefined
        : finiteInteger(this.minimumFractionDigits, 0, 0, MAX_FRACTION_DIGITS);
    let maximumFractionDigits =
      this.maximumFractionDigits === undefined
        ? undefined
        : finiteInteger(this.maximumFractionDigits, MAX_FRACTION_DIGITS, 0, MAX_FRACTION_DIGITS);
    if (minimumFractionDigits !== undefined && maximumFractionDigits !== undefined && minimumFractionDigits > maximumFractionDigits) {
      [minimumFractionDigits, maximumFractionDigits] = [maximumFractionDigits, minimumFractionDigits];
    }
    return { minimumFractionDigits, maximumFractionDigits };
  }

  render(): TemplateResult {
    const options: Intl.NumberFormatOptions = { notation: this.notation };
    if (this.currency) { options.style = 'currency'; options.currency = this.currency; }
    const { minimumFractionDigits, maximumFractionDigits } = this.fractionDigits;
    if (minimumFractionDigits !== undefined) options.minimumFractionDigits = minimumFractionDigits;
    if (maximumFractionDigits !== undefined) options.maximumFractionDigits = maximumFractionDigits;
    // Guaranteed finite by the check below; routed through the shared helper anyway so this call
    // can never see a non-finite value even if the guard changes shape.
    const text = Number.isFinite(this.value)
      ? getNumberFormat(this.effectiveLocale || undefined, options).format(finiteNumber(this.value, 0))
      : '';
    return html`${text || html`<slot></slot>`}`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-format-number': LyraFormatNumber; } }
