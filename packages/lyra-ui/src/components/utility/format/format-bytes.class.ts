import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteInteger, finiteNumber, finiteRange } from '../../../internal/numbers.js';
import { styles } from './format.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'] as const;
const DEFAULT_UNIT_STEP = 1024;
const DEFAULT_DECIMALS = 1;
/** `Intl.NumberFormat`'s own `maximumFractionDigits` accepts `[0, 100]` (and throws a `RangeError`
 *  outside it, or for a non-finite value) — a byte-size readout never meaningfully needs more
 *  than a handful of decimal places, so cap well below that native ceiling. */
const MAX_DECIMALS = 10;

/**
 * `<lr-format-bytes>` — locale-aware byte-size formatting.
 *
 * @customElement lr-format-bytes
 * @slot - Fallback content when the value is not finite.
 */
export class LyraFormatBytes extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property({ type: Number }) value = 0;
  @property({ type: Number, attribute: 'unit-step' }) unitStep = DEFAULT_UNIT_STEP;
  @property({ type: Number }) decimals = DEFAULT_DECIMALS;

  /** `unitStep`, normalized to a finite number `> 1` (a step of exactly `1` — or non-finite, or
   *  `<= 1` — would divide by `Math.log(1) === 0` below) — falls back to the property's own
   *  default of `1024`. */
  private get safeUnitStep(): number {
    const step = finiteRange(this.unitStep, DEFAULT_UNIT_STEP, 1);
    return step > 1 ? step : DEFAULT_UNIT_STEP;
  }

  /** `decimals`, normalized to a finite integer clamped to `[0, MAX_DECIMALS]` — an unguarded
   *  `decimals` reaching `Intl.NumberFormat`'s `maximumFractionDigits` (e.g. a negative or
   *  absurdly large attribute) would otherwise throw a `RangeError` and crash the render. */
  private get safeDecimals(): number {
    return finiteInteger(this.decimals, DEFAULT_DECIMALS, 0, MAX_DECIMALS);
  }

  override render(): TemplateResult {
    // NaN/Infinity (a malformed attribute, or a missing value assigned programmatically) must
    // never reach Intl.NumberFormat: a NaN index would look up units[NaN] === undefined, and
    // Intl.NumberFormat throws when style: 'unit' is paired with an undefined unit.
    let text = '';
    if (Number.isFinite(this.value)) {
      // Guaranteed finite by the check above; routed through the shared helper anyway so this
      // arithmetic can never see a non-finite value even if the guard above it changes shape.
      const value = finiteNumber(this.value, 0);
      const step = this.safeUnitStep;
      const index = value === 0 ? 0 : Math.min(UNITS.length - 1, Math.floor(Math.log(Math.abs(value)) / Math.log(step)));
      const amount = value / step ** index;
      text = getNumberFormat(this.effectiveLocale || undefined, {
        style: 'unit',
        unit: UNITS[index],
        unitDisplay: 'short',
        maximumFractionDigits: this.safeDecimals,
      }).format(amount);
    }
    return html`${text || html`<slot></slot>`}`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-format-bytes': LyraFormatBytes; } }
