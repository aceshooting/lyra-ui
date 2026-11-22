/** Calendar-aware time splitting for `<lr-counter>`. Pure functions; no DOM. */

export type LyraCounterUnit = 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds';

/** Every unit, largest to smallest. */
export const COUNTER_UNITS: readonly LyraCounterUnit[] = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'];

/** Fixed-length units in milliseconds; months and years vary and have no entry. */
export const COUNTER_UNIT_MS: Readonly<Partial<Record<LyraCounterUnit, number>>> = {
  days: 86_400_000,
  hours: 3_600_000,
  minutes: 60_000,
  seconds: 1000,
};

export type LyraCounterValues = Partial<Record<LyraCounterUnit, number>>;

/** Adds calendar months in local time, clamping to the last day of a shorter month. */
export function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  // The setters keep years 0-99 out of the 1900s mapping the Date constructor applies.
  result.setFullYear(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(result.getTime());
  lastDay.setMonth(lastDay.getMonth() + 1, 0);
  result.setDate(Math.min(date.getDate(), lastDay.getDate()));
  return result;
}

/**
 * Splits the span between two instants into `largest`..`smallest` units. Time above `largest` rolls
 * into it; time below `smallest` is dropped. Years and months follow the local calendar and step from
 * the fixed end (`from` when counting up, `to` when `countdown`); days and smaller are exact elapsed
 * time, so a day is always 24 real hours. A negative span counts as zero.
 */
export function splitDuration(
  from: Date,
  to: Date,
  largest: LyraCounterUnit,
  smallest: LyraCounterUnit,
  countdown = false,
): LyraCounterValues {
  const shown = COUNTER_UNITS.slice(COUNTER_UNITS.indexOf(largest), COUNTER_UNITS.indexOf(smallest) + 1);
  const result: LyraCounterValues = {};
  const end = to.getTime() < from.getTime() ? from : to;
  let rest = end.getTime() - from.getTime();

  if (largest === 'years' || largest === 'months') {
    let months = (end.getFullYear() - from.getFullYear()) * 12 + end.getMonth() - from.getMonth();
    const restAfter = (count: number): number =>
      countdown
        ? addCalendarMonths(end, -count).getTime() - from.getTime()
        : end.getTime() - addCalendarMonths(from, count).getTime();
    if (restAfter(months) < 0) months--;
    rest = restAfter(months);
    // A countdown rounds up to its smallest unit so zero only arrives with the end date.
    if (countdown && (smallest === 'months' || smallest === 'years')) {
      if (rest > 0) months++;
      if (smallest === 'years') months = Math.ceil(months / 12) * 12;
    }
    if (largest === 'years') {
      result.years = Math.floor(months / 12);
      months %= 12;
    }
    if (shown.includes('months')) result.months = months;
  }

  for (const unit of ['days', 'hours', 'minutes', 'seconds'] as const) {
    if (!shown.includes(unit)) continue;
    const length = COUNTER_UNIT_MS[unit]!;
    result[unit] = Math.floor(rest / length);
    rest %= length;
  }
  return result;
}
