import { getNumberFormat } from './intl-cache.js';
import { finiteRange } from './numbers.js';

/** Fallback `max` for both progress components, and the value a non-positive `max` falls back to. */
const PROGRESS_DEFAULT_MAX = 100;

/** `max`, normalized to a finite number and guarded against `<= 0` -- which would otherwise
 *  divide-by-zero in `progressPercent()` -- falling back to `PROGRESS_DEFAULT_MAX`. */
export function progressSafeMax(max: number): number {
  const normalized = finiteRange(max, PROGRESS_DEFAULT_MAX, 0);
  return normalized > 0 ? normalized : PROGRESS_DEFAULT_MAX;
}

/** `value`, normalized to a finite number clamped to `[0, safeMax]`. Takes an already-normalized
 *  `safeMax` so a caller that needs both does not run the guard above twice. */
export function progressSafeValue(value: number, safeMax: number): number {
  return finiteRange(value, 0, 0, safeMax);
}

/** Completion as a percentage in `[0, 100]`, from already-normalized inputs. */
export function progressPercent(safeValue: number, safeMax: number): number {
  return (safeValue / safeMax) * 100;
}

/** The percentage rendered as text, in the element's own effective locale (never `'en'`, never a
 *  bare `undefined`). */
export function formatProgressPercent(locale: string, percent: number): string {
  return getNumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(percent / 100);
}

