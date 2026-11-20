import type { ComplexAttributeConverter } from 'lit';

export type LyraFormatNumberType = 'currency' | 'decimal' | 'percent';
export type LyraFormatNumberNotation = 'standard' | 'compact' | 'scientific' | 'engineering';
export type LyraFormatCurrencyDisplay = 'symbol' | 'narrowSymbol' | 'code' | 'name';
export type LyraFormatDateHour = 'auto' | '12' | '24';
export type LyraFormatDateStyle = 'full' | 'long' | 'medium' | 'short';
export type LyraFormatDateText = 'narrow' | 'short' | 'long';
export type LyraFormatDateNumeric = 'numeric' | '2-digit';
export type LyraFormatDateMonth = LyraFormatDateNumeric | LyraFormatDateText;
export type LyraFormatDateTimeZoneName = 'short' | 'long';

const NUMBER_TYPES = ['currency', 'decimal', 'percent'] as const;
const NUMBER_NOTATIONS = ['standard', 'compact', 'scientific', 'engineering'] as const;
const CURRENCY_DISPLAYS = ['symbol', 'narrowSymbol', 'code', 'name'] as const;
const DATE_STYLES = ['full', 'long', 'medium', 'short'] as const;
const DATE_TEXT_STYLES = ['narrow', 'short', 'long'] as const;
const DATE_NUMERIC_STYLES = ['numeric', '2-digit'] as const;
const MONTH_STYLES = ['numeric', '2-digit', 'narrow', 'short', 'long'] as const;
const TIME_ZONE_NAME_STYLES = ['short', 'long'] as const;
const HOUR_FORMATS = ['auto', '12', '24'] as const;

const NUMERIC_DATE_SOURCE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** Attribute converter shared by date-formatting elements. Numeric markup denotes epoch
 * milliseconds, while every other string remains an ISO/date string for the platform parser. */
export const dateSourceConverter: ComplexAttributeConverter<string | number | Date | undefined> = {
  fromAttribute(value): string | number | undefined {
    if (value === null) return undefined;
    const normalized = value.trim();
    if (NUMERIC_DATE_SOURCE.test(normalized)) {
      const epoch = Number(normalized);
      if (Number.isFinite(epoch)) return epoch;
    }
    return value;
  },
};

/** Runtime guard for public literal-union properties assigned through untyped JS or markup. */
function closedValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : fallback;
}

/** Runtime guard for optional public literal-union properties. */
function optionalClosedValue<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : undefined;
}

export interface NumberFormatInputs {
  type: LyraFormatNumberType;
  notation: LyraFormatNumberNotation;
  currency: string;
  currencyDisplay: LyraFormatCurrencyDisplay;
  withoutGrouping: boolean;
  noGrouping: boolean;
  minimumIntegerDigits?: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumSignificantDigits?: number;
  maximumSignificantDigits?: number;
}

/** Builds an `Intl.NumberFormat` options bag after numeric inputs are normalized at the component boundary. */
export function numberFormatOptions(input: NumberFormatInputs): Intl.NumberFormatOptions {
  const type = closedValue(input.type, NUMBER_TYPES, 'decimal');
  const notation = closedValue(input.notation, NUMBER_NOTATIONS, 'standard');
  const currencyDisplay = closedValue(input.currencyDisplay, CURRENCY_DISPLAYS, 'symbol');
  const options: Intl.NumberFormatOptions = {
    style: type,
    notation,
  };
  // Omitting useGrouping preserves the locale/notation default. Passing true is not equivalent:
  // it forces separators in locales that ordinarily leave four-digit values ungrouped.
  if (input.withoutGrouping || input.noGrouping) options.useGrouping = false;
  if (type === 'currency') {
    options.currency = typeof input.currency === 'string' ? input.currency.trim() || 'USD' : 'USD';
    options.currencyDisplay = currencyDisplay;
  }

  if (input.minimumIntegerDigits !== undefined) options.minimumIntegerDigits = input.minimumIntegerDigits;
  if (input.minimumFractionDigits !== undefined) options.minimumFractionDigits = input.minimumFractionDigits;
  if (input.maximumFractionDigits !== undefined) options.maximumFractionDigits = input.maximumFractionDigits;
  if (input.minimumSignificantDigits !== undefined) {
    options.minimumSignificantDigits = input.minimumSignificantDigits;
  }
  if (input.maximumSignificantDigits !== undefined) {
    options.maximumSignificantDigits = input.maximumSignificantDigits;
  }
  return options;
}

export interface DateFormatInputs {
  weekday?: LyraFormatDateText;
  era?: LyraFormatDateText;
  year?: LyraFormatDateNumeric;
  month?: LyraFormatDateMonth;
  day?: LyraFormatDateNumeric;
  hour?: LyraFormatDateNumeric;
  minute?: LyraFormatDateNumeric;
  second?: LyraFormatDateNumeric;
  timeZoneName?: LyraFormatDateTimeZoneName;
  dateStyle?: LyraFormatDateStyle;
  timeStyle?: LyraFormatDateStyle;
  timeZone?: string;
  hourFormat: LyraFormatDateHour;
}

/** Builds one valid `Intl.DateTimeFormat` option family; preset and granular fields never mix. */
export function dateTimeFormatOptions(input: DateFormatInputs): Intl.DateTimeFormatOptions {
  const dateStyle = optionalClosedValue(input.dateStyle, DATE_STYLES);
  const timeStyle = optionalClosedValue(input.timeStyle, DATE_STYLES);
  const options: Intl.DateTimeFormatOptions =
    dateStyle || timeStyle
      ? { dateStyle, timeStyle }
      : {
          weekday: optionalClosedValue(input.weekday, DATE_TEXT_STYLES),
          era: optionalClosedValue(input.era, DATE_TEXT_STYLES),
          year: optionalClosedValue(input.year, DATE_NUMERIC_STYLES),
          month: optionalClosedValue(input.month, MONTH_STYLES),
          day: optionalClosedValue(input.day, DATE_NUMERIC_STYLES),
          hour: optionalClosedValue(input.hour, DATE_NUMERIC_STYLES),
          minute: optionalClosedValue(input.minute, DATE_NUMERIC_STYLES),
          second: optionalClosedValue(input.second, DATE_NUMERIC_STYLES),
          timeZoneName: optionalClosedValue(input.timeZoneName, TIME_ZONE_NAME_STYLES),
        };

  if (typeof input.timeZone === 'string' && input.timeZone.trim()) options.timeZone = input.timeZone.trim();
  const hourFormat = closedValue(input.hourFormat, HOUR_FORMATS, 'auto');
  if (hourFormat !== 'auto') options.hour12 = hourFormat === '12';
  return options;
}

export { byteFormat, byteUnitIndex, safeByteUnitStep, type ByteFormatResult } from '../../../internal/bytes.js';
export type { ByteUnitDisplay as LyraFormatDisplay, ByteUnitFamily as LyraFormatBytesUnit } from '../../../internal/bytes.js';
export {
  RELATIVE_TIME_UNITS, relativeTimeDivisor, relativeTimeFormatOptions, resolveDateSource, resolveRelativeTimeState,
  type LyraRelativeTimeNumeric, type LyraRelativeTimeUnit, type RelativeTimeState,
} from '../../../internal/locale-date.js';
