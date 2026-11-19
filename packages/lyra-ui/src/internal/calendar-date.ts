/** Local proleptic-Gregorian date construction without Date's legacy 0–99 → 1900 remap. */
export function localDate(year: number, month = 0, day = 1): Date {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month, day);
  return date;
}

/** UTC counterpart of {@link localDate}, used for calendar-day arithmetic across DST. */
export function utcDate(year: number, month = 0, day = 1): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date;
}

/** A calendar day: `m` is 1-12, `d` is 1-31. */
export interface IsoDateParts {
  readonly y: number;
  readonly m: number;
  readonly d: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Whether `year` is a proleptic-Gregorian leap year. */
function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Parses a strict `YYYY-MM-DD` string (four-digit year, no surrounding whitespace; callers trim)
 * into its parts, or `undefined` when malformed or not a real calendar day (month 13, Feb 30,
 * Feb 29 in a common year).
 */
export function parseIsoDate(s: string): IsoDateParts | undefined {
  const match = ISO_DATE.exec(s);
  if (!match) return undefined;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1) return undefined;
  const days = m === 2 && isLeapYear(y) ? 29 : DAYS_IN_MONTH[m - 1]!;
  return d <= days ? { y, m, d } : undefined;
}

/** Whether `s` is a real calendar day in strict `YYYY-MM-DD` form. */
export function isValidIsoDate(s: string): boolean {
  return parseIsoDate(s) !== undefined;
}

/** Formats a year (0-9999), month (1-12) and day as `YYYY-MM-DD`. Parts are not validated. */
export function formatIsoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
