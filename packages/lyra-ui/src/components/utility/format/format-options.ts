import { finiteInteger, finiteRange } from '../../../internal/numbers.js';
import type { ComplexAttributeConverter } from 'lit';

export type LyraFormatNumberType = 'currency' | 'decimal' | 'percent';
export type LyraFormatNumberNotation = 'standard' | 'compact' | 'scientific' | 'engineering';
export type LyraFormatCurrencyDisplay = 'symbol' | 'narrowSymbol' | 'code' | 'name';
export type LyraFormatBytesUnit = 'byte' | 'bit';
export type LyraFormatDisplay = 'long' | 'short' | 'narrow';
export type LyraFormatDateHour = 'auto' | '12' | '24';
export type LyraFormatDateStyle = 'full' | 'long' | 'medium' | 'short';
export type LyraFormatDateText = 'narrow' | 'short' | 'long';
export type LyraFormatDateNumeric = 'numeric' | '2-digit';
export type LyraFormatDateMonth = LyraFormatDateNumeric | LyraFormatDateText;
export type LyraFormatDateTimeZoneName = 'short' | 'long';
export type LyraRelativeTimeNumeric = 'always' | 'auto';

const NUMBER_TYPES = ['currency', 'decimal', 'percent'] as const;
const NUMBER_NOTATIONS = ['standard', 'compact', 'scientific', 'engineering'] as const;
const CURRENCY_DISPLAYS = ['symbol', 'narrowSymbol', 'code', 'name'] as const;
const DISPLAY_STYLES = ['long', 'short', 'narrow'] as const;
const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'] as const;
const BIT_UNITS = ['bit', 'kilobit', 'megabit', 'gigabit', 'terabit', 'petabit'] as const;
const DATE_STYLES = ['full', 'long', 'medium', 'short'] as const;
const DATE_TEXT_STYLES = ['narrow', 'short', 'long'] as const;
const DATE_NUMERIC_STYLES = ['numeric', '2-digit'] as const;
const MONTH_STYLES = ['numeric', '2-digit', 'narrow', 'short', 'long'] as const;
const TIME_ZONE_NAME_STYLES = ['short', 'long'] as const;
const HOUR_FORMATS = ['auto', '12', '24'] as const;

const NUMERIC_DATE_SOURCE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** Attribute converter shared by date-formatting elements. Numeric markup denotes epoch
 * milliseconds, while every other string remains an ISO/date string for the platform parser. */
export const dateSourceConverter: ComplexAttributeConverter<string | number | Date> = {
  fromAttribute(value): string | number {
    const source = value ?? '';
    const normalized = source.trim();
    if (NUMERIC_DATE_SOURCE.test(normalized)) {
      const epoch = Number(normalized);
      if (Number.isFinite(epoch)) return epoch;
    }
    return source;
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
    options.currency = (input.currency ?? 'USD').trim() || 'USD';
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

  if (input.timeZone?.trim()) options.timeZone = input.timeZone.trim();
  const hourFormat = closedValue(input.hourFormat, HOUR_FORMATS, 'auto');
  if (hourFormat !== 'auto') options.hour12 = hourFormat === '12';
  return options;
}

export interface ByteFormatResult {
  amount: number;
  options: Intl.NumberFormatOptions;
}

/** Scales a byte/bit quantity using a finite decimal step and builds its validated unit options. */
export function byteFormat(
  value: number,
  unit: LyraFormatBytesUnit,
  display: LyraFormatDisplay,
  unitStep: number,
  decimals: number,
): ByteFormatResult {
  const safeUnit = closedValue(unit, ['byte', 'bit'] as const, 'byte');
  const units = safeUnit === 'bit' ? BIT_UNITS : BYTE_UNITS;
  const step = finiteRange(unitStep, 1000, 1);
  const safeStep = step > 1 ? step : 1000;
  const index =
    value === 0
      ? 0
      : Math.max(0, Math.min(units.length - 1, Math.floor(Math.log(Math.abs(value)) / Math.log(safeStep))));
  return {
    amount: value / safeStep ** index,
    options: {
      style: 'unit',
      unit: units[index],
      unitDisplay: closedValue(display, DISPLAY_STYLES, 'short'),
      maximumFractionDigits: finiteInteger(decimals, 1, 0, 10),
    },
  };
}

/** Builds runtime-safe options for `Intl.RelativeTimeFormat`. */
export function relativeTimeFormatOptions(
  format: LyraFormatDisplay,
  numeric: LyraRelativeTimeNumeric,
): Intl.RelativeTimeFormatOptions {
  return {
    style: closedValue(format, DISPLAY_STYLES, 'long'),
    numeric: closedValue(numeric, ['always', 'auto'] as const, 'auto'),
  };
}
