import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isDateObject } from '../../../internal/dom-guards.js';
import { styles } from './format.styles.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import {
  dateTimeFormatOptions,
  dateSourceConverter,
  type LyraFormatDateHour,
  type LyraFormatDateMonth,
  type LyraFormatDateNumeric,
  type LyraFormatDateStyle,
  type LyraFormatDateText,
  type LyraFormatDateTimeZoneName,
} from './format-options.js';

export type {
  LyraFormatDateHour,
  LyraFormatDateMonth,
  LyraFormatDateNumeric,
  LyraFormatDateStyle,
  LyraFormatDateText,
  LyraFormatDateTimeZoneName,
} from './format-options.js';

/** Resolves only primitive date sources or native Date internal slots. This intentionally avoids
 * `new Date(object)`, which invokes caller-controlled conversion hooks on arbitrary objects. */
function resolvedDate(value: unknown): Date | undefined {
  if (value === null || value === undefined) return new Date();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (!isDateObject(value)) return undefined;
  try {
    const epoch = Date.prototype.getTime.call(value);
    return Number.isFinite(epoch) ? new Date(epoch) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `<lr-format-date>` — locale-aware `Intl.DateTimeFormat` output. Numeric `date` attributes are
 * epoch milliseconds, matching numeric property assignment; nonnumeric attributes remain date
 * strings.
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
  @property({ converter: dateSourceConverter }) date: string | number | Date = new Date();
  @property() weekday?: LyraFormatDateText;
  @property() era?: LyraFormatDateText;
  @property() year?: LyraFormatDateNumeric;
  @property() month?: LyraFormatDateMonth;
  @property() day?: LyraFormatDateNumeric;
  @property() hour?: LyraFormatDateNumeric;
  @property() minute?: LyraFormatDateNumeric;
  @property() second?: LyraFormatDateNumeric;
  @property({ attribute: 'time-zone-name' })
  timeZoneName?: LyraFormatDateTimeZoneName;
  @property({ attribute: 'date-style' }) dateStyle?: LyraFormatDateStyle;
  @property({ attribute: 'time-style' }) timeStyle?: LyraFormatDateStyle;
  /** IANA time-zone name forwarded to `Intl.DateTimeFormat` (attribute `time-zone`). */
  @property({ attribute: 'time-zone' })
  timeZone?: Intl.DateTimeFormatOptions['timeZone'];
  @property({ attribute: 'hour-format' }) hourFormat: LyraFormatDateHour = 'auto';

  override render(): TemplateResult {
    const value = resolvedDate(this.date);
    const options = dateTimeFormatOptions(this);
    let text = '';
    if (value) {
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
    return text && value
      ? html`<time datetime=${value.toISOString()}>${text}</time>`
      : html`<slot></slot>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lr-format-date': LyraFormatDate;
  }
}
