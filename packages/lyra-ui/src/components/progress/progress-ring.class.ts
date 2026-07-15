import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { ringStyles } from './progress.styles.js';

/**
 * `<lyra-progress-ring>` — a circular determinate or indeterminate progress indicator.
 *
 * @customElement lyra-progress-ring
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
  private get percent(): number { return Math.max(0, Math.min(100, this.max > 0 ? this.value / this.max * 100 : 0)); }
  render(): TemplateResult {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - this.percent / 100);
    const label = this.accessibleLabel || this.localize('progress');
    return html`<div part="base" role="progressbar" aria-label=${label}
      aria-valuemin="0" aria-valuemax=${this.max} aria-valuenow=${this.indeterminate ? null : this.value}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle part="track" cx="50" cy="50" r=${radius} stroke-width="10"></circle>
        <circle part="indicator" cx="50" cy="50" r=${radius} stroke-width="10"
          stroke-dasharray=${circumference} stroke-dashoffset=${this.indeterminate ? circumference * 0.65 : offset}></circle>
      </svg>
      <span part="label"><slot>${this.indeterminate ? '' : `${Math.round(this.percent)}%`}</slot></span>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-progress-ring': LyraProgressRing; } }
