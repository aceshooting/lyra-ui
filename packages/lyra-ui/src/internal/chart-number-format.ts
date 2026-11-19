import { getNumberFormat } from './intl-cache.js';

/** Fraction digits keeping three significant digits below one (0.0004 needs six), else `base`. */
export function chartValueFractionDigits(value: number, base = 3): number {
  const magnitude = Math.abs(value);
  return magnitude > 0 && magnitude < 1
    ? Math.min(20, Math.max(base, 2 - Math.floor(Math.log10(magnitude))))
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
