import {
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
  getOwnDataDescriptor,
} from '../../../internal/data-descriptors.js';
import { formatISO, parseISO, utcDate } from './calendar-core.js';

export function isSafeArray(value: unknown): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

/** Returns a fresh local Date using the native Date slot, never an overridable instance method. */
export function copyNativeDate(value: unknown): Date | null {
  if (value === null || typeof value !== 'object') return null;
  try {
    const epoch = Date.prototype.getTime.call(value);
    return Number.isFinite(epoch) ? new Date(epoch) : null;
  } catch {
    return null;
  }
}

/** A disabled-date assignment cannot turn a month render into an unbounded proxy walk. */
const MAX_DISABLED_DATE_ENTRIES = 10_000;

/**
 * ISO keys of a `disabledDates` value, capped at 10,000 entries.
 * @internal
 */
export function projectDisabledDateKeys(value: unknown): readonly string[] {
  if (typeof value === 'string') {
    return Object.freeze(
      value
        .split(/[\s,]+/)
        .map((entry) => parseISO(entry))
        .filter((entry): entry is Date => entry !== null)
        .map((entry) => formatISO(entry)),
    );
  }
  if (!isSafeArray(value)) return Object.freeze([]);
  const length = getOwnDataDescriptor(value, 'length');
  if (
    length === MISSING_OWN_DATA_DESCRIPTOR ||
    length === UNSAFE_OWN_DATA_DESCRIPTOR ||
    typeof length.value !== 'number' ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0
  )
    return Object.freeze([]);

  const dates: string[] = [];
  for (let index = 0; index < Math.min(length.value, MAX_DISABLED_DATE_ENTRIES); index += 1) {
    const entry = getOwnDataDescriptor(value, String(index));
    if (entry === MISSING_OWN_DATA_DESCRIPTOR || entry === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
    const date = typeof entry.value === 'string' ? parseISO(entry.value) : copyNativeDate(entry.value);
    if (date) dates.push(formatISO(date));
  }
  return Object.freeze(dates);
}

const WEEKDAY_NAMES: Readonly<Record<string, number>> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

/**
 * Weekday numbers (0 = Sunday) named by a `disabledDaysOfWeek` value.
 * @internal
 */
export function parseDisabledWeekdays(value: unknown): Set<number> {
  return new Set(
    String(value || '')
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((name) => WEEKDAY_NAMES[name] ?? (/^[0-6]$/.test(name) ? Number(name) : -1))
      .filter((day) => day >= 0)
  );
}

/**
 * Calendar days from `from` to `to`, both included, DST-safe.
 * @internal
 */
export function inclusiveDayCount(from: Date, to: Date): number {
  const fromUtc = utcDate(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toUtc = utcDate(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round(Math.abs(toUtc - fromUtc) / 86_400_000) + 1;
}

