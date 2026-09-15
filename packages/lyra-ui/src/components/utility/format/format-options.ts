import { finiteInteger, finiteRange } from '../../../internal/numbers.js';
import { isDateObject } from '../../../internal/dom-guards.js';
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
  const safeStep = safeByteUnitStep(unitStep);
  const index = byteUnitIndex(value, unitStep, units.length);
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

/** Number of rungs in either byte/bit unit ladder (`byte`..`petabyte` / `bit`..`petabit`). Both
 * ladders are the same length, so one constant covers either family. */
const BYTE_SCALE_UNIT_COUNT = BYTE_UNITS.length;

/** Normalizes a byte/bit unit-ladder step: non-finite or `<= 1` input falls back to the historical
 * 1000-based (decimal) ladder. Shared by {@link byteFormat} and `utilities/format.ts`'s
 * `formatBytes()`, which needs the same normalized step to build an exact `bigint` divisor. */
export function safeByteUnitStep(unitStep: number): number {
  const step = finiteRange(unitStep, 1000, 1);
  return step > 1 ? step : 1000;
}

/**
 * Selects the byte/bit unit-ladder index for a magnitude and step. Shared by {@link byteFormat}
 * and `utilities/format.ts`'s `formatBytes()`, so a `bigint`/decimal-string input too large for
 * `number` still lands on the same unit its `Number(...)`-approximated magnitude would pick — the
 * approximation only ever affects which unit *name* is chosen at an extreme boundary, never the
 * exact digits `formatBytes()` goes on to compute with `bigint` division.
 */
export function byteUnitIndex(value: number, unitStep: number, unitCount: number = BYTE_SCALE_UNIT_COUNT): number {
  const safeStep = safeByteUnitStep(unitStep);
  return value === 0
    ? 0
    : Math.max(0, Math.min(unitCount - 1, Math.floor(Math.log(Math.abs(value)) / Math.log(safeStep))));
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

/**
 * Resolves only primitive date sources or native `Date` internal slots. This intentionally avoids
 * `new Date(object)`, which invokes caller-controlled conversion hooks on arbitrary objects.
 * Shared by `<lr-format-date>`, `<lr-relative-time>`, and `utilities/format.ts`'s `formatDate()` /
 * `formatRelativeTime()`.
 */
export function resolveDateSource(value: unknown): Date | undefined {
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

export type LyraRelativeTimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

const RELATIVE_TIME_DIVISORS: Record<LyraRelativeTimeUnit, number> = {
  year: 31_536_000,
  quarter: 7_884_000,
  month: 2_628_000,
  week: 604_800,
  day: 86_400,
  hour: 3_600,
  minute: 60,
  second: 1,
};

/** The relative-time unit ladder, largest-to-smallest -- shared by `<lr-relative-time>` and
 * `utilities/format.ts`'s `formatRelativeTime()`. */
export const RELATIVE_TIME_UNITS = Object.keys(RELATIVE_TIME_DIVISORS) as LyraRelativeTimeUnit[];

/** The number of seconds in one of `unit`, used both to auto-select a unit and to schedule the
 * next boundary a live `<lr-relative-time sync>` needs to re-render at. */
export function relativeTimeDivisor(unit: LyraRelativeTimeUnit): number {
  return RELATIVE_TIME_DIVISORS[unit];
}

export interface RelativeTimeState {
  readonly seconds: number;
  readonly requestedUnit: LyraRelativeTimeUnit | 'auto';
  readonly selected: LyraRelativeTimeUnit;
  readonly value: number;
}

/**
 * Selects the display unit and rounded magnitude for a relative-time delta (in seconds): the
 * largest unit whose divisor the magnitude still clears when `unit` is `'auto'`, or the
 * explicitly requested unit when it names a real one. Shared by `<lr-relative-time>` and
 * `utilities/format.ts`'s `formatRelativeTime()`.
 */
export function resolveRelativeTimeState(seconds: number, unit: LyraRelativeTimeUnit | 'auto'): RelativeTimeState {
  const requestedUnit = unit === 'auto' || RELATIVE_TIME_UNITS.includes(unit) ? unit : 'auto';
  const selected =
    requestedUnit === 'auto'
      ? RELATIVE_TIME_UNITS.find((candidate) => Math.abs(seconds) >= relativeTimeDivisor(candidate)) ?? 'second'
      : requestedUnit;
  return {
    seconds,
    requestedUnit,
    selected,
    value: Math.round(seconds / relativeTimeDivisor(selected)),
  };
}
