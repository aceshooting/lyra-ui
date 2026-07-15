import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './format.styles.js';

/**
 * `<lyra-format-date>` — locale-aware `Intl.DateTimeFormat` output.
 *
 * @customElement lyra-format-date
 * @slot - Fallback content for an invalid date.
 */
export class LyraFormatDate extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property() date: string | number | Date = '';
  @property() locale = '';
  @property() year: Intl.DateTimeFormatOptions['year'] = 'numeric';
  @property() month: Intl.DateTimeFormatOptions['month'] = 'long';
  @property() day: Intl.DateTimeFormatOptions['day'] = 'numeric';
  @property({ attribute: 'date-style' }) dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
  @property({ attribute: 'time-style' }) timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
  render(): TemplateResult {
    const value = this.date instanceof Date ? this.date : new Date(this.date);
    const options: Intl.DateTimeFormatOptions = { year: this.year, month: this.month, day: this.day };
    if (this.dateStyle) options.dateStyle = this.dateStyle;
    if (this.timeStyle) options.timeStyle = this.timeStyle;
    const text = Number.isNaN(value.getTime()) ? '' : new Intl.DateTimeFormat(this.locale || undefined, options).format(value);
    return html`${text || html`<slot></slot>`}`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-format-date': LyraFormatDate; } }
