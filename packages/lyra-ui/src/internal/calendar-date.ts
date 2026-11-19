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
