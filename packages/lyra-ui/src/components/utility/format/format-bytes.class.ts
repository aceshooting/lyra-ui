import { bdi } from '../../../internal/bidi.js';
import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { styles } from './format.styles.js';
import { byteFormat, formatByteAmount, type LyraFormatBytesUnit, type LyraFormatDisplay } from './format-options.js';

export type { LyraFormatBytesUnit, LyraFormatDisplay } from './format-options.js';

const DEFAULT_UNIT_STEP = 1000;
const DEFAULT_DECIMALS = 1;

/**
 * `<lr-format-bytes>` — locale-aware byte-size formatting.
 *
 * The short base rung uses the locale's narrow symbol when the short kilo rung abbreviates to it
 * (`20 B` beside `1.5 kB`), rather than Intl's short `20 byte`.
 *
 * @customElement lr-format-bytes
 * @slot - Fallback content when the value is not finite.
 * @status stable
 * @since 4.0.0
 */
export class LyraFormatBytes extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  /** Size to format, in `unit`s (bytes by default). A non-finite value renders the default slot instead. */
  @property({ type: Number }) value = 0;
  /** Unit family of `value`: `'byte'` (default) or `'bit'`. */
  @property() unit: LyraFormatBytesUnit = 'byte';
  /** Unit label style passed to `Intl.NumberFormat` as `unitDisplay`: `'short'` (default), `'long'` or `'narrow'`. */
  @property() display: LyraFormatDisplay = 'short';
  /** Size of each step in the unit ladder (attribute `unit-step`): `1000` (default) for decimal units, `1024` for binary steps. */
  @property({ type: Number, attribute: 'unit-step' }) unitStep = DEFAULT_UNIT_STEP;
  /** Maximum number of fraction digits shown, clamped to 0-10. Defaults to `1`. */
  @property({ type: Number }) decimals = DEFAULT_DECIMALS;

  override render(): TemplateResult {
    // NaN/Infinity (a malformed attribute or an invalid programmatic value) render the fallback.
    let text = '';
    if (Number.isFinite(this.value)) {
      // Guaranteed finite by the check above; routed through the shared helper anyway so this
      // arithmetic can never see a non-finite value even if the guard above it changes shape.
      const value = finiteNumber(this.value, 0);
      const result = byteFormat(
        value,
        this.unit,
        this.display,
        this.unitStep,
        this.decimals,
      );
      try {
        text = formatByteAmount(this.effectiveLocale || undefined, result.amount, result);
      } catch {
        // A malformed runtime locale is reachable from untyped JS/markup. The unit/options are
        // already normalized above, so retrying with the runtime locale keeps the value useful.
        text = formatByteAmount(undefined, result.amount, result);
      }
    }
    return text ? bdi(text) : html`<slot></slot>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-format-bytes': LyraFormatBytes; } }
