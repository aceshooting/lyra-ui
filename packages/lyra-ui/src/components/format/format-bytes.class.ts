import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './format.styles.js';

/**
 * `<lyra-format-bytes>` — locale-aware byte-size formatting.
 *
 * @customElement lyra-format-bytes
 */
export class LyraFormatBytes extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property({ type: Number }) value = 0;
  @property() locale = '';
  @property({ type: Number, attribute: 'unit-step' }) unitStep = 1024;
  @property({ type: Number }) decimals = 1;
  render(): TemplateResult {
    const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'] as const;
    const safeStep = this.unitStep > 1 ? this.unitStep : 1024;
    const index = this.value === 0 ? 0 : Math.min(units.length - 1, Math.floor(Math.log(Math.abs(this.value)) / Math.log(safeStep)));
    const amount = this.value / safeStep ** index;
    const text = new Intl.NumberFormat(this.locale || undefined, { style: 'unit', unit: units[index], unitDisplay: 'short', maximumFractionDigits: this.decimals }).format(amount);
    return html`${text}`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-format-bytes': LyraFormatBytes; } }
