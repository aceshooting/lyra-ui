import { getNumberFormat, getPluralRules } from './intl-cache.js';
import { finiteNumber } from './numbers.js';

/**
 * Formats `value` for `locale` through the shared formatter cache. A non-finite value formats as
 * `0` so a bad datum never prints `NaN`/`Infinity` into user-facing text.
 */
export function formatLocaleNumber(
  locale: string,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return getNumberFormat(locale, options).format(finiteNumber(value, 0));
}

/** Smallest share printed as a number; anything nonzero below it prints as `<0.1%`. */
const SHARE_FLOOR = 0.001;

/**
 * Formats a fraction (`0.25` is 25%) as a percentage whose precision adapts to its size, so a
 * small nonzero share never collapses to `0%`: below 0.1% it prints `<0.1%`, below 1% it keeps one
 * fraction digit, and from 1% upward it rounds to a whole percent. A non-finite fraction is 0%.
 */
export function formatAdaptiveShare(locale: string, fraction: number): string {
  const value = finiteNumber(fraction, 0);
  const magnitude = Math.abs(value);
  if (magnitude > 0 && magnitude < SHARE_FLOOR) {
    const floor = getNumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(SHARE_FLOOR);
    return `<${floor}`;
  }
  const digits = magnitude < 0.01 && magnitude > 0 ? 1 : 0;
  return getNumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** The CLDR plural category of `n` in `locale`; a non-finite `n` is treated as 0 (`other`-safe). */
export function pluralCategory(locale: string, n: number): Intl.LDMLPluralRule {
  return getPluralRules(locale).select(finiteNumber(n, 0));
}
