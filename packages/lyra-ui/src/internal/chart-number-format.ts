import { getNumberFormat } from './intl-cache.js';

/**
 * Fraction digits (0-20) that show `significant` significant digits of a positive `magnitude`:
 * two significant digits of 0.0004 need four, of 5 need one, of 10 need none.
 */
export function significantFractionDigits(magnitude: number, significant: number): number {
  return Math.min(20, Math.max(0, significant - 1 - Math.floor(Math.log10(magnitude)))) || 0;
}

/**
 * Fraction digits keeping `significant` significant digits below one (three significant digits of
 * 0.0004 need six), never fewer than `base`; `base` for zero and magnitudes of one or more.
 */
export function chartValueFractionDigits(value: number, base = 3, significant = 3): number {
  const magnitude = Math.abs(value);
  return magnitude > 0 && magnitude < 1
    ? Math.max(base, significantFractionDigits(magnitude, significant))
    : base;
}

/**
 * Keep the usual decimal precision, adding fraction digits for small values up to the
 * 20-digit cap. Below that range, scientific notation retains three significant digits.
 */
export function formatChartValue(
  value: number,
  locale: string,
  format?: Intl.NumberFormat,
  base = 3,
): string {
  const magnitude = Math.abs(value);
  if (magnitude > 0 && magnitude < 1e-18) {
    return getNumberFormat(locale, { notation: 'scientific', maximumSignificantDigits: 3 }).format(value);
  }
  const digits = chartValueFractionDigits(value, base);
  return digits > base
    ? getNumberFormat(locale, { maximumFractionDigits: digits }).format(value)
    : (format ?? getNumberFormat(locale, base === 3 ? undefined : { maximumFractionDigits: base })).format(value);
}
