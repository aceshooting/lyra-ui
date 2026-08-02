import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './format.styles.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import {
  dateTimeFormatOptions,
  type FormatDateHour,
  type FormatDateMonth,
  type FormatDateNumeric,
  type FormatDateStyle,
  type FormatDateText,
  type FormatDateTimeZoneName,
} from './format-options.js';

export type {
  FormatDateHour,
  FormatDateMonth,
  FormatDateNumeric,
  FormatDateStyle,
  FormatDateText,
  FormatDateTimeZoneName,
} from './format-options.js';

/**
 * `<lr-format-date>` — locale-aware `Intl.DateTimeFormat` output.
 * `timeZone` is forwarded to both granular and style-based formatting. An invalid zone falls back
 * to the browser's local time zone instead of making the component fail to render.
 *
 * @customElement lr-format-date
 * @slot - Fallback content for an invalid date.
 * @status stable
 * @since 4.0.0
 */
export class LyraFormatDate extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property() date: string | number | Date = new Date();
  @property() weekday?: FormatDateText;
  @property() era?: FormatDateText;
  @property() year?: FormatDateNumeric;
  @property() month?: FormatDateMonth;
  @property() day?: FormatDateNumeric;
  @property() hour?: FormatDateNumeric;
  @property() minute?: FormatDateNumeric;
  @property() second?: FormatDateNumeric;
  @property({ attribute: 'time-zone-name' }) timeZoneName?: FormatDateTimeZoneName;
  @property({ attribute: 'date-style' }) dateStyle?: FormatDateStyle;
  @property({ attribute: 'time-style' }) timeStyle?: FormatDateStyle;
  /** IANA time-zone name forwarded to `Intl.DateTimeFormat` (attribute `time-zone`). */
  @property({ attribute: 'time-zone' }) timeZone?: Intl.DateTimeFormatOptions['timeZone'];
  @property({ attribute: 'hour-format' }) hourFormat: FormatDateHour = 'auto';

  override render(): TemplateResult {
    const source = this.date ?? new Date();
    const value = source instanceof Date ? source : new Date(source);
    const options = dateTimeFormatOptions(this);
    let text = '';
    if (!Number.isNaN(value.getTime())) {
      try {
        text = getDateTimeFormat(this.effectiveLocale || undefined, options).format(value);
      } catch {
        const localOptions = { ...options };
        delete localOptions.timeZone;
        try {
          text = getDateTimeFormat(this.effectiveLocale || undefined, localOptions).format(value);
        } catch {
          const safeOptions: Intl.DateTimeFormatOptions = {};
          try {
            // Invalid formatting options must not silently erase an otherwise-valid locale.
            text = getDateTimeFormat(this.effectiveLocale || undefined, safeOptions).format(value);
          } catch {
            // Only a malformed locale itself reaches this final runtime-locale fallback.
            text = getDateTimeFormat(undefined, safeOptions).format(value);
          }
        }
      }
    }
    return text
      ? html`<time datetime=${value.toISOString()}>${text}</time>`
      : html`<slot></slot>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-format-date': LyraFormatDate; } }
