import { getNumberFormat } from '../../internal/intl-cache.js';
import { finiteRange } from '../../internal/numbers.js';

/** Formats a media position or duration with the caller's whole-second rounding rule. */
export function formatMediaTime(seconds: number, locale: string, rounding: 'floor' | 'round' = 'floor'): string {
  const safeSeconds = finiteRange(seconds, 0, 0);
  const total = rounding === 'round' ? Math.round(safeSeconds) : Math.floor(safeSeconds);
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
