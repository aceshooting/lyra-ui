import { formatChartValue } from './chart-number-format.js';
import { getNumberFormat } from './intl-cache.js';
import { finiteRange } from './numbers.js';

/** Formats a media position or duration in whole seconds, rounded down. */
export function formatMediaTime(seconds: number, locale: string): string {
  const total = Math.floor(finiteRange(seconds, 0, 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  const regular = getNumberFormat(locale, { maximumFractionDigits: 0, useGrouping: false });
  const padded = getNumberFormat(locale, {
    maximumFractionDigits: 0,
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  return hours > 0
    ? `${regular.format(hours)}:${padded.format(minutes)}:${padded.format(remaining)}`
    : `${regular.format(minutes)}:${padded.format(remaining)}`;
}

/** Formats a playback rate with two fraction digits, widening for slow rates below 0.01 so a
 *  distinct rate never reads as `0`. */
export function formatPlaybackRate(rate: number, locale: string): string {
  return formatChartValue(rate, locale, getNumberFormat(locale, { maximumFractionDigits: 2 }), 2);
}

/** The playback-rate choices with `current` inserted in ascending order when the list lacks it, so
 *  a native rate `<select>` never shows a preset for an off-list rate. Returns `rates` unchanged
 *  when it already holds `current` or `current` is not a finite positive rate. */
export function withCurrentRate(rates: readonly number[], current: number): readonly number[] {
  if (!Number.isFinite(current) || current <= 0 || rates.includes(current)) return rates;
  return [...rates, current].sort((a, b) => a - b);
}
