import { finiteInteger, finiteRange } from '../../../internal/numbers.js';

export type FormatNumberType = 'currency' | 'decimal' | 'percent';
export type FormatNumberNotation = 'standard' | 'compact' | 'scientific' | 'engineering';
export type FormatCurrencyDisplay = 'symbol' | 'narrowSymbol' | 'code' | 'name';
export type FormatBytesUnit = 'byte' | 'bit';
export type FormatDisplay = 'long' | 'short' | 'narrow';
export type FormatDateHour = 'auto' | '12' | '24';
export type FormatDateStyle = 'full' | 'long' | 'medium' | 'short';
export type FormatDateText = 'narrow' | 'short' | 'long';
export type FormatDateNumeric = 'numeric' | '2-digit';
export type FormatDateMonth = FormatDateNumeric | FormatDateText;
export type FormatDateTimeZoneName = 'short' | 'long';
export type RelativeTimeNumeric = 'always' | 'auto';

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

const MAX_FRACTION_DIGITS = 100;
const MAX_SIGNIFICANT_DIGITS = 21;

/** Runtime guard for public literal-union properties assigned through untyped JS or markup. */
export function closedValue<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : fallback;
}

/** Runtime guard for optional public literal-union properties. */
function optionalClosedValue<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  return typeof value === 'string' && values.includes(value as T) ? (value as T) : undefined;
}

function optionalInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number | undefined {
  return value === undefined ? undefined : finiteInteger(value, fallback, minimum, maximum);
}

function orderedDigits(
  minimum: number | undefined,
  maximum: number | undefined,
  minimumFallback: number,
  maximumFallback: number,
  lowerBound: number,
  upperBound: number,
): [number | undefined, number | undefined] {
  let safeMinimum = optionalInteger(minimum, minimumFallback, lowerBound, upperBound);
  let safeMaximum = optionalInteger(maximum, maximumFallback, lowerBound, upperBound);
  if (safeMinimum !== undefined && safeMaximum !== undefined && safeMinimum > safeMaximum) {
    [safeMinimum, safeMaximum] = [safeMaximum, safeMinimum];
  }
  return [safeMinimum, safeMaximum];
}

export interface NumberFormatInputs {
  type: FormatNumberType;
  notation: FormatNumberNotation;
  currency: string;
  currencyDisplay: FormatCurrencyDisplay;
  withoutGrouping: boolean;
  noGrouping: boolean;
  minimumIntegerDigits?: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumSignificantDigits?: number;
  maximumSignificantDigits?: number;
}

/** Builds a fully runtime-validated `Intl.NumberFormat` options bag. */
export function numberFormatOptions(input: NumberFormatInputs): Intl.NumberFormatOptions {
  const type = closedValue(input.type, NUMBER_TYPES, 'decimal');
  const notation = closedValue(input.notation, NUMBER_NOTATIONS, 'standard');
  const currencyDisplay = closedValue(input.currencyDisplay, CURRENCY_DISPLAYS, 'symbol');
  const options: Intl.NumberFormatOptions = {
    style: type,
    notation,
    useGrouping: !(input.withoutGrouping || input.noGrouping),
  };
  if (type === 'currency') {
    options.currency = input.currency.trim() || 'USD';
    options.currencyDisplay = currencyDisplay;
  }

  const minimumIntegerDigits = optionalInteger(input.minimumIntegerDigits, 1, 1, 21);
  const [minimumFractionDigits, maximumFractionDigits] = orderedDigits(
    input.minimumFractionDigits,
    input.maximumFractionDigits,
    0,
    MAX_FRACTION_DIGITS,
    0,
    MAX_FRACTION_DIGITS,
  );
  const [minimumSignificantDigits, maximumSignificantDigits] = orderedDigits(
    input.minimumSignificantDigits,
    input.maximumSignificantDigits,
    1,
    MAX_SIGNIFICANT_DIGITS,
    1,
    MAX_SIGNIFICANT_DIGITS,
  );
  if (minimumIntegerDigits !== undefined) options.minimumIntegerDigits = minimumIntegerDigits;
  if (minimumFractionDigits !== undefined) options.minimumFractionDigits = minimumFractionDigits;
  if (maximumFractionDigits !== undefined) options.maximumFractionDigits = maximumFractionDigits;
  if (minimumSignificantDigits !== undefined) options.minimumSignificantDigits = minimumSignificantDigits;
  if (maximumSignificantDigits !== undefined) options.maximumSignificantDigits = maximumSignificantDigits;
  return options;
}

export interface DateFormatInputs {
  weekday?: FormatDateText;
  era?: FormatDateText;
  year?: FormatDateNumeric;
  month?: FormatDateMonth;
  day?: FormatDateNumeric;
  hour?: FormatDateNumeric;
  minute?: FormatDateNumeric;
  second?: FormatDateNumeric;
  timeZoneName?: FormatDateTimeZoneName;
  dateStyle?: FormatDateStyle;
  timeStyle?: FormatDateStyle;
  timeZone?: string;
  hourFormat: FormatDateHour;
}

/** Builds one valid `Intl.DateTimeFormat` option family; preset and granular fields never mix. */
export function dateTimeFormatOptions(input: DateFormatInputs): Intl.DateTimeFormatOptions {
  const dateStyle = optionalClosedValue(input.dateStyle, DATE_STYLES);
  const timeStyle = optionalClosedValue(input.timeStyle, DATE_STYLES);
  const options: Intl.DateTimeFormatOptions = dateStyle || timeStyle
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
  unit: FormatBytesUnit,
  display: FormatDisplay,
  unitStep: number,
  decimals: number,
): ByteFormatResult {
  const safeUnit = closedValue(unit, ['byte', 'bit'] as const, 'byte');
  const units = safeUnit === 'bit' ? BIT_UNITS : BYTE_UNITS;
  const step = finiteRange(unitStep, 1000, 1);
  const safeStep = step > 1 ? step : 1000;
  const index = value === 0
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
  format: FormatDisplay,
  numeric: RelativeTimeNumeric,
): Intl.RelativeTimeFormatOptions {
  return {
    style: closedValue(format, DISPLAY_STYLES, 'long'),
    numeric: closedValue(numeric, ['always', 'auto'] as const, 'auto'),
  };
}
