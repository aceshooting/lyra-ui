import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './progress.styles.js';

export type ProgressVariant = 'brand' | 'success' | 'warning' | 'danger';

/**
 * `<lyra-progress-bar>` — a determinate or indeterminate progress indicator.
 *
 * @customElement lyra-progress-bar
 * @slot label - Optional label content.
 * @csspart base - The progress wrapper.
 * @csspart track - The track.
 * @csspart indicator - The filled progress indicator.
 * @csspart label - The label row.
 */
export class LyraProgressBar extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property({ type: Number }) value = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Boolean, reflect: true }) indeterminate = false;
  @property({ reflect: true }) variant: ProgressVariant = 'brand';
  @property({ type: Boolean, attribute: 'show-value' }) showValue = false;
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  private get percent(): number { return Math.max(0, Math.min(100, this.max > 0 ? this.value / this.max * 100 : 0)); }
  render(): TemplateResult {
    const value = this.indeterminate ? nothing : String(Math.round(this.percent));
    const label = this.accessibleLabel || this.localize('progress');
    return html`<div part="base" role="progressbar" aria-label=${label}
      aria-valuemin="0" aria-valuemax=${this.max} aria-valuenow=${this.indeterminate ? nothing : this.value}>
      <div part="label" ?hidden=${!this.showValue}><slot name="label"></slot>${this.showValue && !this.indeterminate ? html`<span>${value}%</span>` : nothing}</div>
      <div part="track"><div part="indicator" style="inline-size:${this.indeterminate ? '40%' : `${this.percent}%`}"></div></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-progress-bar': LyraProgressBar; } }
