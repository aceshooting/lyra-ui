import { bdi } from '../../../internal/bidi.js';
import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteInteger, finiteNumber } from '../../../internal/numbers.js';
import { styles } from './format.styles.js';
import { formatNumber } from '../../../utilities/format.js';
import {
  numberFormatOptions,
  type LyraFormatCurrencyDisplay,
  type LyraFormatNumberNotation,
  type LyraFormatNumberType,
} from './format-options.js';
import { blankNumberConverter } from '../../../internal/converters.js';

export type { LyraFormatCurrencyDisplay, LyraFormatNumberNotation, LyraFormatNumberType } from './format-options.js';

const INTEGER_DIGIT_BOUNDS = { minimum: 1, maximum: 21 } as const;
const FRACTION_DIGIT_BOUNDS = { minimum: 0, maximum: 100 } as const;
const SIGNIFICANT_DIGIT_BOUNDS = { minimum: 1, maximum: 21 } as const;
const optionalPrecision = blankNumberConverter(undefined);

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
  /** Number to format. A non-finite value renders the default slot instead. */
  @property({ converter: blankNumberConverter(0) }) value = 0;
  /** Formatting style: `'decimal'` (default), `'currency'` or `'percent'`. */
  @property() type: LyraFormatNumberType = 'decimal';
  /** ISO currency code. Removed or blank attributes format with the existing USD fallback. */
  @property() currency = 'USD';
  /** How the currency is shown when `type="currency"` (attribute `currency-display`): `'symbol'` (default), `'narrowSymbol'`, `'code'` or `'name'`. */
  @property({ attribute: 'currency-display' }) currencyDisplay: LyraFormatCurrencyDisplay = 'symbol';
  /** Web Awesome grouping alias. When both grouping aliases are false, `Intl` keeps the locale's
   * default grouping policy rather than being forced on. */
  @property({ type: Boolean, attribute: 'without-grouping' }) withoutGrouping = false;
  /** Shoelace grouping alias; equivalent to `withoutGrouping`. */
  @property({ type: Boolean, attribute: 'no-grouping' }) noGrouping = false;
  /** Number notation: `'standard'` (default), `'scientific'`, `'engineering'` or `'compact'`. */
  @property() notation: LyraFormatNumberNotation = 'standard';
  /** Minimum integer digits (attribute `minimum-integer-digits`), clamped to 1-21; unset leaves the `Intl` default. */
  @property({ attribute: 'minimum-integer-digits', type: Number, converter: optionalPrecision }) minimumIntegerDigits?: number;
  /** Minimum fraction digits (attribute `minimum-fraction-digits`), clamped to 0-100; unset leaves the `Intl` default. Swapped with the maximum when larger. */
  @property({ attribute: 'minimum-fraction-digits', type: Number, converter: optionalPrecision }) minimumFractionDigits?: number;
  /** Maximum fraction digits (attribute `maximum-fraction-digits`), clamped to 0-100; unset leaves the `Intl` default. Swapped with the minimum when smaller. */
  @property({ attribute: 'maximum-fraction-digits', type: Number, converter: optionalPrecision }) maximumFractionDigits?: number;
  /** Minimum significant digits (attribute `minimum-significant-digits`), clamped to 1-21; unset leaves the `Intl` default. Swapped with the maximum when larger. */
  @property({ attribute: 'minimum-significant-digits', type: Number, converter: optionalPrecision }) minimumSignificantDigits?: number;
  /** Maximum significant digits (attribute `maximum-significant-digits`), clamped to 1-21; unset leaves the `Intl` default. Swapped with the minimum when smaller. */
  @property({ attribute: 'maximum-significant-digits', type: Number, converter: optionalPrecision }) maximumSignificantDigits?: number;

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
        text = formatNumber(value, this.effectiveLocale || undefined, options);
      } catch {
        // Invalid locale/currency/option values are untyped-JS reachable despite the public
        // TypeScript surface. Discard the invalid options without also discarding a valid
        // effective locale; only a malformed locale itself needs the runtime-locale fallback.
        try {
          text = formatNumber(value, this.effectiveLocale || undefined, { style: 'decimal' });
        } catch {
          text = formatNumber(value, undefined, { style: 'decimal' });
        }
      }
    }
    return text ? bdi(text) : html`<slot></slot>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-format-number': LyraFormatNumber; } }
