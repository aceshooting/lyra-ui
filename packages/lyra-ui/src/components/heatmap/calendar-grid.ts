import { minMax } from './heatmap-scale.js';

export interface CalendarDay {
  /** ISO `yyyy-mm-dd` date string. */
  date: string;
  value: number;
}

export interface CalendarCell {
  date: string;
  value: number;
  /** 0-based week column, counting from the grid's first (earliest-containing) Sunday. */
  week: number;
  /** 0 (Sunday) .. 6 (Saturday). */
  weekday: number;
}

const MS_PER_DAY = 86_400_000;

/** Parses a `yyyy-mm-dd` string as UTC midnight, avoiding local-timezone day-boundary drift. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Whether `iso` (already run through parseIsoDate) actually round-trips —
 *  Date.UTC silently rolls e.g. day 30 of a 28-day February into March. */
function isCalendarValid(iso: string, parsed: Date): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}

/**
 * Lays `days` out onto a GitHub-style Sunday-Saturday x week grid. `days`
 * need not be sorted or contiguous; the grid spans from the earliest to the
 * latest date present, anchored at the Sunday on/before the earliest date.
 *
 * An entry whose `date` doesn't parse to a valid calendar date (e.g. `''` or
 * `'2026-03'`) is dropped rather than included: `parseIsoDate` on a malformed
 * string yields an `Invalid Date` (`getTime()` is `NaN`), and letting that
 * single `NaN` reach the min/max below would poison `firstWeekStart` (and
 * therefore every cell's `week`) for the whole grid instead of just the bad
 * entry. Likewise, an entry whose `date` is numerically well-formed but
 * calendar-invalid (e.g. `'2026-02-30'`, which `Date.UTC` silently rolls
 * over into March) is dropped rather than silently renormalized — see
 * `isCalendarValid()`.
 */
export function buildCalendarGrid(days: CalendarDay[]): {
  cells: CalendarCell[];
  weekCount: number;
  firstWeekStart: Date;
  monthLabels: { week: number; label: string }[];
} {
  const parsed = days
    .map((d) => ({ ...d, dateObj: parseIsoDate(d.date) }))
    .filter((d) => !Number.isNaN(d.dateObj.getTime()) && isCalendarValid(d.date, d.dateObj));

  if (parsed.length === 0) {
    return { cells: [], weekCount: 0, firstWeekStart: new Date(0), monthLabels: [] };
  }

  const timeBounds = minMax(parsed.map((d) => d.dateObj.getTime()))!;
  const min = new Date(timeBounds[0]);
  const firstWeekStart = new Date(
    Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), min.getUTCDate() - min.getUTCDay()),
  );

  const cells: CalendarCell[] = parsed.map((d) => {
    const weekday = d.dateObj.getUTCDay();
    const daysSinceStart = Math.round((d.dateObj.getTime() - firstWeekStart.getTime()) / MS_PER_DAY);
    const week = Math.floor(daysSinceStart / 7);
    return { date: d.date, value: d.value, week, weekday };
  });

  const weekCount = minMax(cells.map((c) => c.week))![1] + 1;

  // Label every distinct (year, month) present in the data, not just months
  // that happen to contain a Sunday-anchored cell — a sparse calendar (few
  // days per month, none landing on a Sunday) would otherwise render zero
  // month labels for months that do have data.
  const monthLabels: { week: number; label: string }[] = [];
  const seenMonths = new Set<string>();
  for (const cell of cells.slice().sort((a, b) => a.week - b.week || a.weekday - b.weekday)) {
    const cellDate = parseIsoDate(cell.date);
    const key = `${cellDate.getUTCFullYear()}-${cellDate.getUTCMonth()}`;
    if (seenMonths.has(key)) continue;
    seenMonths.add(key);
    monthLabels.push({
      week: cell.week,
      label: cellDate.toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
    });
  }

  return { cells, weekCount, firstWeekStart, monthLabels };
}

/** Splits `value`'s rank within `sorted` (ascending, pre-sorted by the caller) into `bucketCount` quartile-style buckets. */
export function quartileBucket(value: number, sorted: number[], bucketCount: number): number {
  if (sorted.length === 0) return 0;
  // `sorted` is ascending, so the count of elements <= value is found via an
  // upper-bound binary search (O(log n)) instead of scanning the whole array.
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! <= value) lo = mid + 1;
    else hi = mid;
  }
  const rank = lo / sorted.length;
  return Math.min(bucketCount - 1, Math.floor(rank * bucketCount));
}
