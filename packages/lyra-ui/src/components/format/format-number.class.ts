import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './format.styles.js';

/**
 * `<lyra-format-number>` — locale-aware `Intl.NumberFormat` output.
 *
 * @customElement lyra-format-number
 * @slot - Fallback content when the value is not finite.
 */
export class LyraFormatNumber extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property({ type: Number }) value = 0;
  @property() currency = '';
  @property() notation: 'standard' | 'compact' | 'scientific' | 'engineering' = 'standard';
  @property({ attribute: 'minimum-fraction-digits', type: Number }) minimumFractionDigits?: number;
  @property({ attribute: 'maximum-fraction-digits', type: Number }) maximumFractionDigits?: number;
  render(): TemplateResult {
    const options: Intl.NumberFormatOptions = { notation: this.notation };
    if (this.currency) { options.style = 'currency'; options.currency = this.currency; }
    if (this.minimumFractionDigits !== undefined) options.minimumFractionDigits = this.minimumFractionDigits;
    if (this.maximumFractionDigits !== undefined) options.maximumFractionDigits = this.maximumFractionDigits;
    const text = Number.isFinite(this.value) ? new Intl.NumberFormat(this.effectiveLocale || undefined, options).format(this.value) : '';
    return html`${text || html`<slot></slot>`}`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-format-number': LyraFormatNumber; } }
