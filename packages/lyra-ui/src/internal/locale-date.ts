import type { ByteUnitDisplay } from './bytes.js';
import { isDateObject } from './dom-guards.js';
import { getDateTimeFormat, getNumberFormat } from './intl-cache.js';

export type LocaleDateField = 'day' | 'month' | 'year';

const BIDI_FORMATTING_MARKS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const UNICODE_DECIMAL_DIGIT = /^\p{Nd}$/u;

/** Removes the bidi formatting controls that Intl may include around localized digits. */
export function stripBidiFormattingMarks(text: string): string {
  return text.replace(BIDI_FORMATTING_MARKS, '');
}

/** Determines day/month/year order from a real sample; `calendar` preserves each caller's format. */
export function localeDateOrder(
  locale: string,
  calendar?: Intl.DateTimeFormatOptions['calendar'],
): LocaleDateField[] {
  try {
    const parts = getDateTimeFormat(locale, {
      ...(calendar ? { calendar } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(2026, 0, 2));
    const order = parts
      .filter(
        (part): part is Intl.DateTimeFormatPart & { type: LocaleDateField } =>
          part.type === 'day' || part.type === 'month' || part.type === 'year',
      )
      .map((part) => part.type);
    return order.length === 3 ? order : ['month', 'day', 'year'];
  } catch {
    return ['month', 'day', 'year'];
  }
}

function unicodeDecimalValue(character: string): number | undefined {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined || !UNICODE_DECIMAL_DIGIT.test(character)) return undefined;
  if (codePoint >= 0x30 && codePoint <= 0x39) return codePoint - 0x30;
  let rangeStart = codePoint;
  while (rangeStart > 0 && UNICODE_DECIMAL_DIGIT.test(String.fromCodePoint(rangeStart - 1))) {
    rangeStart--;
  }
  return (codePoint - rangeStart) % 10;
}

/** Builds the non-decimal locale digit substitutions that Intl formats for this locale. */
export function localeDigitMap(locale: string): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  try {
    const formatter = getNumberFormat(locale, { useGrouping: false });
    for (let digit = 0; digit <= 9; digit++) {
      const localized = stripBidiFormattingMarks(formatter.format(digit));
      if (localized && localized !== String(digit)) map.set(localized, String(digit));
    }
  } catch {
    return map;
  }

  return map;
}

/** Converts Unicode decimal and locale-native digits to ASCII after removing bidi marks. */
export function normalizeLocaleDigits(
  text: string,
  locale: string,
  digits: ReadonlyMap<string, string> = localeDigitMap(locale),
): string {
  let normalized = '';
  for (const character of stripBidiFormattingMarks(text)) {
    const value = unicodeDecimalValue(character);
    normalized += value === undefined ? digits.get(character) ?? character : String(value);
  }
  return normalized;
}

export type LyraRelativeTimeNumeric = 'always' | 'auto';

/** Builds runtime-safe options for `Intl.RelativeTimeFormat`. */
export function relativeTimeFormatOptions(
  format: ByteUnitDisplay,
  numeric: LyraRelativeTimeNumeric,
): Intl.RelativeTimeFormatOptions {
  return {
    style: format === 'short' || format === 'narrow' ? format : 'long',
    numeric: numeric === 'always' ? 'always' : 'auto',
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
export const RELATIVE_TIME_UNITS = /* @__PURE__ */ Object.keys(RELATIVE_TIME_DIVISORS) as LyraRelativeTimeUnit[];

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
