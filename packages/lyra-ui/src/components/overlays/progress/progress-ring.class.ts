import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { ringStyles } from './progress.styles.js';

const DEFAULT_MAX = 100;

/**
 * `<lr-progress-ring>` — a circular determinate or indeterminate progress indicator.
 *
 * @customElement lr-progress-ring
 * @slot - Optional center label.
 * @csspart base - The progress wrapper.
 * @csspart track - The SVG track.
 * @csspart indicator - The SVG indicator.
 * @csspart label - The center label.
 */
export class LyraProgressRing extends LyraElement {
  static styles = [LyraElement.styles, ringStyles];
  @property({ type: Number }) value = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Boolean, reflect: true }) indeterminate = false;
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

  render(): TemplateResult {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - this.percent / 100);
    const label = this.accessibleLabel || this.localize('progress');
    return html`<div part="base" role="progressbar" aria-label=${label}
      aria-valuemin="0" aria-valuemax=${this.safeMax} aria-valuenow=${this.indeterminate ? null : this.safeValue}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle part="track" cx="50" cy="50" r=${radius} stroke-width="10"></circle>
        <circle part="indicator" cx="50" cy="50" r=${radius} stroke-width="10"
          stroke-dasharray=${circumference} stroke-dashoffset=${this.indeterminate ? circumference * 0.65 : offset}></circle>
      </svg>
      <span part="label"><slot>${this.indeterminate ? '' : `${Math.round(this.percent)}%`}</slot></span>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-progress-ring': LyraProgressRing; } }
