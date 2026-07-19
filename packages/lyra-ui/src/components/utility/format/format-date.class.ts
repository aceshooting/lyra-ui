import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './format.styles.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';

/**
 * `<lr-format-date>` — locale-aware `Intl.DateTimeFormat` output.
 * `timeZone` is forwarded to both granular and style-based formatting. An invalid zone falls back
 * to the browser's local time zone instead of making the component fail to render.
 *
 * @customElement lr-format-date
 * @slot - Fallback content for an invalid date.
 */
export class LyraFormatDate extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property() date: string | number | Date = '';
  @property() year: Intl.DateTimeFormatOptions['year'] = 'numeric';
  @property() month: Intl.DateTimeFormatOptions['month'] = 'long';
  @property() day: Intl.DateTimeFormatOptions['day'] = 'numeric';
  @property({ attribute: 'date-style' }) dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
  @property({ attribute: 'time-style' }) timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
  /** IANA time-zone name forwarded to `Intl.DateTimeFormat` (attribute `time-zone`). */
  @property({ attribute: 'time-zone' }) timeZone?: Intl.DateTimeFormatOptions['timeZone'];
  render(): TemplateResult {
    const value = this.date instanceof Date ? this.date : new Date(this.date);
    const options: Intl.DateTimeFormatOptions = this.dateStyle || this.timeStyle
      ? { dateStyle: this.dateStyle, timeStyle: this.timeStyle }
      : { year: this.year, month: this.month, day: this.day };
    options.timeZone = this.timeZone;
    let text = '';
    if (!Number.isNaN(value.getTime())) {
      try {
        text = getDateTimeFormat(this.effectiveLocale || undefined, options).format(value);
      } catch (error) {
        if (!(error instanceof RangeError) || !this.timeZone) throw error;
        const localOptions = { ...options };
        delete localOptions.timeZone;
        text = getDateTimeFormat(this.effectiveLocale || undefined, localOptions).format(value);
      }
    }
    return html`${text || html`<slot></slot>`}`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-format-date': LyraFormatDate; } }
