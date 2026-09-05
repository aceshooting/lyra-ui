import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteInteger, finiteNumber } from '../../../internal/numbers.js';
import { styles } from './format.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  numberFormatOptions,
  type LyraFormatCurrencyDisplay,
  type LyraFormatNumberNotation,
  type LyraFormatNumberType,
} from './format-options.js';

export type { LyraFormatCurrencyDisplay, LyraFormatNumberNotation, LyraFormatNumberType } from './format-options.js';

const INTEGER_DIGIT_BOUNDS = { minimum: 1, maximum: 21 } as const;
const FRACTION_DIGIT_BOUNDS = { minimum: 0, maximum: 100 } as const;
const SIGNIFICANT_DIGIT_BOUNDS = { minimum: 1, maximum: 21 } as const;

/**
 * `<lr-format-number>` — locale-aware `Intl.NumberFormat` output.
 *
 * @customElement lr-format-number
 * @slot - Fallback content when the value is not finite.
 * @status stable
 * @since 4.0.0
 */
export class LyraFormatNumber extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property({ type: Number }) value = 0;
  @property() type: LyraFormatNumberType = 'decimal';
  /** ISO currency code. Removed or blank attributes format with the existing USD fallback. */
  @property() currency = 'USD';
  @property({ attribute: 'currency-display' }) currencyDisplay: LyraFormatCurrencyDisplay = 'symbol';
  /** Web Awesome grouping alias. When both grouping aliases are false, `Intl` keeps the locale's
   * default grouping policy rather than being forced on. */
  @property({ type: Boolean, attribute: 'without-grouping' }) withoutGrouping = false;
  /** Shoelace grouping alias; equivalent to `withoutGrouping`. */
  @property({ type: Boolean, attribute: 'no-grouping' }) noGrouping = false;
  @property() notation: LyraFormatNumberNotation = 'standard';
  @property({ attribute: 'minimum-integer-digits', type: Number }) minimumIntegerDigits?: number;
  @property({ attribute: 'minimum-fraction-digits', type: Number }) minimumFractionDigits?: number;
  @property({ attribute: 'maximum-fraction-digits', type: Number }) maximumFractionDigits?: number;
  @property({ attribute: 'minimum-significant-digits', type: Number }) minimumSignificantDigits?: number;
  @property({ attribute: 'maximum-significant-digits', type: Number }) maximumSignificantDigits?: number;

  override render(): TemplateResult {
    const minimumIntegerDigits =
      this.minimumIntegerDigits === undefined
        ? undefined
        : finiteInteger(
            this.minimumIntegerDigits,
            INTEGER_DIGIT_BOUNDS.minimum,
            INTEGER_DIGIT_BOUNDS.minimum,
            INTEGER_DIGIT_BOUNDS.maximum,
          );
    let minimumFractionDigits =
      this.minimumFractionDigits === undefined
        ? undefined
        : finiteInteger(
            this.minimumFractionDigits,
            FRACTION_DIGIT_BOUNDS.minimum,
            FRACTION_DIGIT_BOUNDS.minimum,
            FRACTION_DIGIT_BOUNDS.maximum,
          );
    let maximumFractionDigits =
      this.maximumFractionDigits === undefined
        ? undefined
        : finiteInteger(
            this.maximumFractionDigits,
            FRACTION_DIGIT_BOUNDS.maximum,
            FRACTION_DIGIT_BOUNDS.minimum,
            FRACTION_DIGIT_BOUNDS.maximum,
          );
    let minimumSignificantDigits =
      this.minimumSignificantDigits === undefined
        ? undefined
        : finiteInteger(
            this.minimumSignificantDigits,
            SIGNIFICANT_DIGIT_BOUNDS.minimum,
            SIGNIFICANT_DIGIT_BOUNDS.minimum,
            SIGNIFICANT_DIGIT_BOUNDS.maximum,
          );
    let maximumSignificantDigits =
      this.maximumSignificantDigits === undefined
        ? undefined
        : finiteInteger(
            this.maximumSignificantDigits,
            SIGNIFICANT_DIGIT_BOUNDS.maximum,
            SIGNIFICANT_DIGIT_BOUNDS.minimum,
            SIGNIFICANT_DIGIT_BOUNDS.maximum,
          );
    if (
      minimumFractionDigits !== undefined &&
      maximumFractionDigits !== undefined &&
      minimumFractionDigits > maximumFractionDigits
    ) {
      [minimumFractionDigits, maximumFractionDigits] = [maximumFractionDigits, minimumFractionDigits];
    }
    if (
      minimumSignificantDigits !== undefined &&
      maximumSignificantDigits !== undefined &&
      minimumSignificantDigits > maximumSignificantDigits
    ) {
      [minimumSignificantDigits, maximumSignificantDigits] = [maximumSignificantDigits, minimumSignificantDigits];
    }
    const options = numberFormatOptions({
      type: this.type,
      notation: this.notation,
      currency: this.currency,
      currencyDisplay: this.currencyDisplay,
      withoutGrouping: this.withoutGrouping,
      noGrouping: this.noGrouping,
      minimumIntegerDigits,
      minimumFractionDigits,
      maximumFractionDigits,
      minimumSignificantDigits,
      maximumSignificantDigits,
    });
    // Guaranteed finite by the check below; routed through the shared helper anyway so this call
    // can never see a non-finite value even if the guard changes shape.
    let text = '';
    if (Number.isFinite(this.value)) {
      const value = finiteNumber(this.value, 0);
      try {
        text = getNumberFormat(this.effectiveLocale || undefined, options).format(value);
      } catch {
        // Invalid locale/currency/option values are untyped-JS reachable despite the public
        // TypeScript surface. Discard the invalid options without also discarding a valid
        // effective locale; only a malformed locale itself needs the runtime-locale fallback.
        try {
          text = getNumberFormat(this.effectiveLocale || undefined, { style: 'decimal' }).format(value);
        } catch {
          text = getNumberFormat(undefined, { style: 'decimal' }).format(value);
        }
      }
    }
    return html`${text || html`<slot></slot>`}`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-format-number': LyraFormatNumber; } }
