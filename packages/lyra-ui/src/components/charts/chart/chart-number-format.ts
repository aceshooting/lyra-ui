import { getNumberFormat } from '../../../internal/intl-cache.js';

/** Fraction digits keeping three significant digits below one (0.0004 needs six), else `base`. */
export function chartValueFractionDigits(value: number, base = 3): number {
  const magnitude = Math.abs(value);
  return magnitude > 0 && magnitude < 1
    ? Math.min(20, Math.max(base, 2 - Math.floor(Math.log10(magnitude))))
    : base;
}

/**
 * The chart family's default value text: the locale's default number format (at most three
 * fraction digits, `format` when the caller already holds it), widened below one so a small value
 * never reads "0" in a table, legend, title or announcement while the axis shows it.
 */
export function formatChartValue(value: number, locale: string, format?: Intl.NumberFormat): string {
  const digits = chartValueFractionDigits(value);
  return digits > 3
    ? getNumberFormat(locale, { maximumFractionDigits: digits }).format(value)
    : (format ?? getNumberFormat(locale)).format(value);
}
