import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './progress.styles.js';

export type ProgressVariant = 'brand' | 'success' | 'warning' | 'danger';

const DEFAULT_MAX = 100;

/**
 * `<lr-progress-bar>` — a determinate or indeterminate progress indicator.
 *
 * @customElement lr-progress-bar
 * @slot label - Optional label content.
 * @csspart base - The progress wrapper.
 * @csspart track - The track.
 * @csspart indicator - The filled progress indicator.
 * @csspart label - The label row.
 * @cssprop [--lr-progress-height=var(--lr-size-0-5rem)] - Block size of the progress track.
 * @cssprop [--lr-progress-duration=var(--lr-transition-ambient)] - Indeterminate sweep timing.
 */
export class LyraProgressBar extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property({ type: Number }) value = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Boolean, reflect: true }) indeterminate = false;
  @property({ reflect: true }) variant: ProgressVariant = 'brand';
  @property({ type: Boolean, attribute: 'show-value' }) showValue = false;
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';

  /** `max`, normalized to a finite number and guarded against `<= 0` — which would otherwise
   *  divide-by-zero in `percent` below — falling back to the property's own default of `100`. */
  private get safeMax(): number {
    const max = finiteRange(this.max, DEFAULT_MAX, 0);
    return max > 0 ? max : DEFAULT_MAX;
  }

  /** `value`, normalized to a finite number clamped to `[0, safeMax]`. */
  private get safeValue(): number {
    return finiteRange(this.value, 0, 0, this.safeMax);
  }

  private get percent(): number {
    return (this.safeValue / this.safeMax) * 100;
  }

  private get formattedPercent(): string {
    return getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(this.percent / 100);
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.accessibleLabel || this.localize('progress');
    return html`<div part="base" role="progressbar" aria-label=${label}
      aria-valuemin="0" aria-valuemax=${this.safeMax} aria-valuenow=${this.indeterminate ? nothing : this.safeValue}
      aria-valuetext=${this.indeterminate ? nothing : this.formattedPercent}>
      <div part="label" ?hidden=${!this.showValue}><slot name="label"></slot>${this.showValue && !this.indeterminate ? html`<span>${this.formattedPercent}</span>` : nothing}</div>
      <div part="track"><div part="indicator" style="inline-size:${this.indeterminate ? '40%' : `${this.percent}%`}"></div></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-progress-bar': LyraProgressBar; } }
