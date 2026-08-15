import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { styles } from './format.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { byteFormat, type LyraFormatBytesUnit, type LyraFormatDisplay } from './format-options.js';

export type { LyraFormatBytesUnit, LyraFormatDisplay } from './format-options.js';

const DEFAULT_UNIT_STEP = 1000;
const DEFAULT_DECIMALS = 1;

/**
 * `<lr-format-bytes>` — locale-aware byte-size formatting.
 *
 * @customElement lr-format-bytes
 * @slot - Fallback content when the value is not finite.
 * @status stable
 * @since 4.0.0
 */
export class LyraFormatBytes extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property({ type: Number }) value = 0;
  @property() unit: LyraFormatBytesUnit = 'byte';
  @property() display: LyraFormatDisplay = 'short';
  @property({ type: Number, attribute: 'unit-step' }) unitStep = DEFAULT_UNIT_STEP;
  @property({ type: Number }) decimals = DEFAULT_DECIMALS;

  override render(): TemplateResult {
    // NaN/Infinity (a malformed attribute, or a missing value assigned programmatically) must
    // never reach Intl.NumberFormat: a NaN index would look up units[NaN] === undefined, and
    // Intl.NumberFormat throws when style: 'unit' is paired with an undefined unit.
    let text = '';
    if (Number.isFinite(this.value)) {
      // Guaranteed finite by the check above; routed through the shared helper anyway so this
      // arithmetic can never see a non-finite value even if the guard above it changes shape.
      const value = finiteNumber(this.value, 0);
      const { amount, options } = byteFormat(
        value,
        this.unit,
        this.display,
        this.unitStep,
        this.decimals,
      );
      try {
        text = getNumberFormat(this.effectiveLocale || undefined, options).format(amount);
      } catch {
        // A malformed runtime locale is reachable from untyped JS/markup. The unit/options are
        // already normalized above, so retrying with the runtime locale keeps the value useful.
        text = getNumberFormat(undefined, options).format(amount);
      }
    }
    return html`${text || html`<slot></slot>`}`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-format-bytes': LyraFormatBytes; } }
