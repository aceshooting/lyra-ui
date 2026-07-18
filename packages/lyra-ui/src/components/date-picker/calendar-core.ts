import { getDateTimeFormat } from '../../internal/intl-cache.js';

export type WeekdayFormat = 'narrow' | 'short' | 'long';
export type CalendarMode = 'single' | 'range';

/** Normalize an untyped calendar count to the supported one- or two-month range. */
export function normalizeCalendarMonths(value: unknown): 1 | 2 {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(2, Math.max(1, Math.trunc(numeric))) as 1 | 2;
}

/** Normalize an untyped weekday format before passing it to `Intl.DateTimeFormat`. */
export function normalizeWeekdayFormat(value: unknown): WeekdayFormat {
  return value === 'narrow' || value === 'long' ? value : 'short';
}

/** Normalize an untyped picker mode to the single-date default. */
export function normalizeCalendarMode(value: unknown): CalendarMode {
  return value === 'range' ? 'range' : 'single';
}

/**
 * Construct a date formatter while treating a malformed runtime locale as
 * the platform default. Attribute values and JavaScript property writes are
 * not constrained by TypeScript's declarations, so they must not be allowed
 * to turn a calendar render into a `RangeError`.
 */
export function dateTimeFormat(
  locale: unknown,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  try {
    return getDateTimeFormat(typeof locale === 'string' && locale ? locale : undefined, options);
  } catch {
    return getDateTimeFormat(undefined, options);
  }
}

/** Parse `YYYY-MM-DD` into a local Date, or null if invalid. */
export function parseISO(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;
  // The Date constructor silently rolls invalid components over into the
  // next month/year (e.g. month 13 or Feb 30) instead of producing an
  // invalid date, so a calendar-invalid input must be caught by comparing
  // the constructed date back against what was actually typed.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/** Format a Date as local `YYYY-MM-DD`. */
export function formatISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** First day of the month `n` months from `d`. */
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/**
 * `d` shifted by `n` months, keeping the same day-of-month unless the target
 * month is shorter, in which case the day is clamped to that month's last
 * day. Plain `new Date(year, month + n, d.getDate())` construction instead
 * overflows a too-large day-of-month into the *following* month (e.g. Jan 31
 * + 1 month rolls into March, skipping February entirely) because the Date
 * constructor normalizes out-of-range day components rather than clamping
 * them.
 */
export function addMonthsClampingDay(d: Date, n: number): Date {
  const targetMonth = d.getMonth() + n;
  const lastDayOfTargetMonth = new Date(d.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(d.getFullYear(), targetMonth, Math.min(d.getDate(), lastDayOfTargetMonth));
}

export function clampDate(d: Date, min: Date | null, max: Date | null): Date {
  if (min && d < min) return min;
  if (max && d > max) return max;
  return d;
}

/**
 * A 6×7 grid of Dates covering the given month, week-aligned to `firstDayOfWeek`
 * (0=Sunday … 6=Saturday). Includes leading/trailing days from adjacent months.
 */
export function monthMatrix(year: number, month: number, firstDayOfWeek = 0): Date[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - firstDayOfWeek + 7) % 7;
  const cursor = new Date(year, month, 1 - offset);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

/** Localized weekday header labels, ordered from `firstDayOfWeek`. */
export function weekdayLabels(firstDayOfWeek = 0, format: WeekdayFormat = 'short', locale?: string): string[] {
  const numericFirstDay = Number(firstDayOfWeek);
  const start = Number.isFinite(numericFirstDay)
    ? ((Math.trunc(numericFirstDay) % 7) + 7) % 7
    : 0;
  const fmt = dateTimeFormat(locale, { weekday: normalizeWeekdayFormat(format) });
  const labels: string[] = [];
  // 2021-08-01 is a Sunday, so index i maps cleanly to a weekday.
  for (let i = 0; i < 7; i++) {
    const day = (start + i) % 7;
    labels.push(fmt.format(new Date(2021, 7, 1 + day)));
  }
  return labels;
}

/** Localized "Month YYYY" title. */
export function monthTitle(year: number, month: number, locale?: string): string {
  return dateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  );
}

const FDOW: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/**
 * `Intl.Locale`'s week-info surface, still shifting between runtimes: some
 * expose it as a `weekInfo` accessor, others as a `getWeekInfo()` method;
 * `firstDay` is ISO-numbered (1=Monday …
 * 7=Sunday), unlike this module's own 0=Sunday … 6=Saturday convention.
 *
 * Intentionally NOT `extends Intl.Locale`: some TypeScript/lib.dom versions
 * type the ambient `Intl.Locale.getWeekInfo` as a required, non-optional
 * method, and an optional override of a required base member is an invalid
 * interface extension (TS2430). An intersection with a plain `Intl.Locale`
 * avoids overriding any base member.
 */
type LocaleWithWeekInfo = Intl.Locale & {
  weekInfo?: { firstDay: number };
  getWeekInfo?: () => { firstDay: number };
};

/** Locale-derived first day of week (0=Sunday … 6=Saturday), or null if unsupported. */
function localeFirstDayOfWeek(locale: string): number | null {
  try {
    const l = new Intl.Locale(locale) as LocaleWithWeekInfo;
    const firstDay = l.weekInfo?.firstDay ?? l.getWeekInfo?.().firstDay;
    if (!firstDay) return null;
    return firstDay % 7; // ISO 1-7 (Mon-Sun) -> 0-6 (Sun-Sat)
  } catch {
    return null;
  }
}

/**
 * Resolve a `first-day-of-week` attribute (name or 'auto') to a 0–6 index.
 * `'auto'` derives the answer from `locale` via `Intl.Locale`'s week-info
 * when the runtime supports it, falling back to Sunday otherwise.
 */
export function resolveFirstDayOfWeek(value: string, locale?: string): number {
  if (!value || value === 'auto') {
    const derived = locale ? localeFirstDayOfWeek(locale) : null;
    return derived ?? 0;
  }
  return typeof value === 'string' ? (FDOW[value.toLowerCase()] ?? 0) : 0;
}
