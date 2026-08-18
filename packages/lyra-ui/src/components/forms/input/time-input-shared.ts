import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import { isDateObject } from '../../../internal/dom-guards.js';

export type TimePrecision = 'minute' | 'second' | 'millisecond';

export interface ParsedTimeValue {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  precision: TimePrecision;
  milliseconds: number;
}

export type TimeHourFormat = 'auto' | '12' | '24';

export type TimePatternPart =
  | { type: 'hour' | 'minute' | 'second' | 'dayPeriod'; value: string }
  | { type: 'literal'; value: string };

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const TIME_VALUE_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/** Parses the canonical, timezone-free wire representation used by an HTML time control. */
export function parseTimeValue(value: string): ParsedTimeValue | undefined {
  const match = TIME_VALUE_PATTERN.exec(value);
  if (!match) return undefined;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  const millisecond = match[4] === undefined ? 0 : Number(match[4].padEnd(3, '0'));
  if (hour > 23 || minute > 59 || second > 59) return undefined;

  return {
    hour,
    minute,
    second,
    millisecond,
    precision: match[4] === undefined ? (match[3] === undefined ? 'minute' : 'second') : 'millisecond',
    milliseconds: ((hour * 60 + minute) * 60 + second) * 1000 + millisecond,
  };
}

/** Normalizes a public string/Date value without applying timezone or elapsed-time arithmetic. */
export function normalizeTimeValue(value: string | Date | null | undefined): string {
  if (value == null) return '';

  if (isDateObject(value)) {
    if (!Number.isFinite(value.getTime())) return '';
    const base = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    if (value.getMilliseconds() !== 0) {
      return `${base}:${pad(value.getSeconds())}.${pad(value.getMilliseconds(), 3)}`;
    }
    return value.getSeconds() === 0 ? base : `${base}:${pad(value.getSeconds())}`;
  }

  const parsed = parseTimeValue(value);
  if (!parsed) return '';

  const base = `${pad(parsed.hour)}:${pad(parsed.minute)}`;
  if (parsed.precision === 'minute') return base;
  const seconds = `${base}:${pad(parsed.second)}`;
  return parsed.precision === 'second' ? seconds : `${seconds}.${pad(parsed.millisecond, 3)}`;
}

/**
 * Formats milliseconds since local midnight as the canonical wire value, the inverse of
 * `parseTimeValue(...).milliseconds`.
 *
 * Arithmetic rather than a round-trip through a `Date`: building a local `Date` at midnight and
 * adding an offset lands on the wrong clock time on the days a zone shifts, which is exactly the
 * kind of once-a-year bug nobody reproduces. Anything outside a single day -- negative, a full day
 * or more, or non-finite -- yields `''`, matching how a native time input rejects an out-of-range
 * `valueAsNumber` rather than silently wrapping it into a different time.
 */
export function timeValueFromMilliseconds(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value >= DAY_MILLISECONDS) return '';
  const total = Math.trunc(value);
  const hour = Math.floor(total / 3_600_000);
  const minute = Math.floor(total / 60_000) % 60;
  const second = Math.floor(total / 1_000) % 60;
  const millisecond = total % 1_000;
  const base = `${pad(hour)}:${pad(minute)}`;
  if (millisecond !== 0) return `${base}:${pad(second)}.${pad(millisecond, 3)}`;
  return second === 0 ? base : `${base}:${pad(second)}`;
}

export function to24Hour(hour: number, dayPeriod: 'am' | 'pm'): number {
  const normalizedHour = hour % 12;
  return dayPeriod === 'pm' ? normalizedHour + 12 : normalizedHour;
}

/** Implements HTML time's ordinary range and its useful reversed-bound overnight range. */
export function isTimeInRange(value: string, min: string, max: string): boolean {
  const parsedValue = parseTimeValue(value);
  if (!parsedValue) return false;

  const parsedMin = min === '' ? undefined : parseTimeValue(min);
  const parsedMax = max === '' ? undefined : parseTimeValue(max);
  if (parsedMin && parsedMax && parsedMin.milliseconds > parsedMax.milliseconds) {
    return parsedValue.milliseconds >= parsedMin.milliseconds || parsedValue.milliseconds <= parsedMax.milliseconds;
  }
  if (parsedMin && parsedValue.milliseconds < parsedMin.milliseconds) return false;
  if (parsedMax && parsedValue.milliseconds > parsedMax.milliseconds) return false;
  return true;
}

/** HTML time's step base: valid `min`, otherwise the valid content/reset value, otherwise midnight. */
export function timeStepBaseMilliseconds(min: string, defaultValue = ''): number {
  return parseTimeValue(min)?.milliseconds ?? parseTimeValue(defaultValue)?.milliseconds ?? 0;
}

/** Checks the HTML time step grid using pure milliseconds since local midnight. */
export function hasTimeStepMismatch(
  value: string,
  step: number | 'any',
  min: string,
  defaultValue = '',
): boolean {
  if (step === 'any') return false;
  const parsedValue = parseTimeValue(value);
  if (!parsedValue) return false;

  const numericStep = Number(step);
  const stepMilliseconds = (Number.isFinite(numericStep) && numericStep > 0 ? numericStep : 60) * 1000;
  const stepBase = timeStepBaseMilliseconds(min, defaultValue);
  const remainder = ((parsedValue.milliseconds - stepBase) % stepMilliseconds + stepMilliseconds) % stepMilliseconds;
  return remainder > 0.000_001 && stepMilliseconds - remainder > 0.000_001;
}

function localeHour12(locale: string, hourFormat: TimeHourFormat): boolean {
  if (hourFormat !== 'auto') return hourFormat === '12';
  try {
    return getDateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;
  } catch {
    return false;
  }
}

/** Derives segment order and separators from the active locale instead of assuming `HH:mm`. */
export function localeTimePattern(
  locale: string,
  hourFormat: TimeHourFormat,
  includeSeconds: boolean,
): TimePatternPart[] {
  const hour12 = localeHour12(locale, hourFormat);
  try {
    const formatter = getDateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' as const } : {}),
      hour12,
      timeZone: 'UTC',
    });
    return formatter
      .formatToParts(new Date(Date.UTC(2020, 0, 1, 13, 5, 9)))
      .flatMap<TimePatternPart>((part) => {
        if (part.type === 'hour' || part.type === 'minute' || part.type === 'second' || part.type === 'dayPeriod') {
          return [{ type: part.type, value: part.value }];
        }
        return part.type === 'literal' ? [{ type: 'literal', value: part.value }] : [];
      });
  } catch {
    return [
      { type: 'hour', value: hour12 ? '1' : '13' },
      { type: 'literal', value: ':' },
      { type: 'minute', value: '05' },
      ...(includeSeconds
        ? ([{ type: 'literal', value: ':' }, { type: 'second', value: '09' }] as TimePatternPart[])
        : []),
      ...(hour12
        ? ([{ type: 'literal', value: ' ' }, { type: 'dayPeriod', value: 'PM' }] as TimePatternPart[])
        : []),
    ];
  }
}

/** Returns the locale's actual day-period labels, including non-Latin and punctuated forms. */
export function dayPeriodLabels(locale: string): { am: string; pm: string } {
  const labelAt = (hour: number): string | undefined => {
    try {
      return getDateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' })
        .formatToParts(new Date(Date.UTC(2020, 0, 1, hour)))
        .find((part) => part.type === 'dayPeriod')?.value;
    } catch {
      return undefined;
    }
  };

  return { am: labelAt(1) ?? 'AM', pm: labelAt(13) ?? 'PM' };
}

export function wrapTimeMilliseconds(value: number): number {
  return ((value % DAY_MILLISECONDS) + DAY_MILLISECONDS) % DAY_MILLISECONDS;
}
