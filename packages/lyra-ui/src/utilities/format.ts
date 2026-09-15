/**
 * Pure, string-returning locale formatters over the library's own memoized `Intl` formatter
 * cache (`internal/intl-cache.ts`) and locale resolution -- the same cache and fallback-locale
 * behavior `<lr-format-number>`, `<lr-format-date>`, `<lr-format-bytes>`, and `<lr-relative-time>`
 * render through. Reach for these when a caller needs a formatted *string* rather than a rendered
 * element: interpolating into a message template, populating a text-only property on another
 * component (a stat tile's value, a chart tick label, a badge's cost text), building a search
 * predicate, or composing an accessibility announcement.
 *
 * Every call shares one instance per distinct locale + options pair across the whole page,
 * including with the elements above -- constructing an `Intl` formatter performs an ICU
 * locale-data lookup that is orders of magnitude slower than reusing an existing instance.
 */

import { getDateTimeFormat, getNumberFormat, getRelativeTimeFormat } from '../internal/intl-cache.js';
import { finiteInteger } from '../internal/numbers.js';
import {
  byteFormat,
  byteUnitIndex,
  relativeTimeFormatOptions,
  resolveDateSource,
  resolveRelativeTimeState,
  safeByteUnitStep,
  type LyraFormatBytesUnit,
  type LyraFormatDisplay,
  type LyraRelativeTimeNumeric,
  type LyraRelativeTimeUnit,
} from '../components/utility/format/format-options.js';

/** A number, `bigint`, or decimal/integer string. Passing a `bigint` or string preserves every
 * digit through formatting -- a plain `number` is IEEE-754 float64 and cannot exactly represent
 * an integer beyond `Number.MAX_SAFE_INTEGER` or most decimal fractions. */
export type LyraFormattableNumber = number | bigint | string;

/**
 * `Intl.NumberFormat.prototype.format` accepts a `bigint` or a decimal string without precision
 * loss per ECMA-402's Intl.NumberFormat v3 (`ToIntlMathematicalValue`), which every evergreen
 * engine this library targets implements. This project's `tsconfig` `lib` predates that overload
 * (it stops at the `es2020.bigint` one), so the call is typed through this narrow local interface
 * instead of widening the shared `lib` array for one call site.
 */
interface NumericStringFormat {
  format(value: number | bigint | string): string;
}

/**
 * Locale-aware `Intl.NumberFormat` output, sharing the library's memoized formatter cache. `value`
 * may be a `bigint` or a decimal string for exact-precision input (large ids, monetary amounts) --
 * see {@link LyraFormattableNumber}. Invalid `options` (for example an unsupported currency code)
 * throw the same `RangeError`/`TypeError` `Intl.NumberFormat`'s own constructor would.
 */
export function formatNumber(
  value: LyraFormattableNumber,
  locale?: string,
  options?: Intl.NumberFormatOptions,
): string {
  const formatter = getNumberFormat(locale, options) as unknown as NumericStringFormat;
  return formatter.format(value);
}

/**
 * Locale-aware `Intl.DateTimeFormat` output, sharing the library's memoized formatter cache. `value`
 * accepts the same sources as `<lr-format-date>`'s `date` property: an ISO/date string, epoch
 * milliseconds, or a `Date`. Returns `undefined` for an unresolvable source (an invalid string, a
 * non-finite epoch, or a non-`Date` object) instead of throwing -- mirroring `resolveCssLength()`'s
 * "unsupported input returns `undefined`" convention for a pure helper. Invalid `options` still
 * throw, matching `Intl.DateTimeFormat`'s own constructor.
 */
export function formatDate(
  value: string | number | Date,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string | undefined {
  const resolved = resolveDateSource(value);
  return resolved ? getDateTimeFormat(locale, options).format(resolved) : undefined;
}

export interface LyraFormatRelativeTimeOptions {
  /** An explicit unit, or `'auto'` (default) to pick the largest unit the magnitude clears --
   * the same heuristic `<lr-relative-time unit="auto">` uses. */
  readonly unit?: LyraRelativeTimeUnit | 'auto';
  readonly format?: LyraFormatDisplay;
  readonly numeric?: LyraRelativeTimeNumeric;
  /** The reference instant (epoch milliseconds) `value` is relative to. Defaults to `Date.now()`;
   * pass a fixed instant for a deterministic test or an "as of" report. */
  readonly now?: number;
}

/**
 * Locale-aware relative-time text (`"3 days ago"`, `"in 2 hours"`) for a target date, sharing the
 * library's memoized `Intl.RelativeTimeFormat` cache and the same auto-unit selection
 * `<lr-relative-time>` renders with. `value` accepts the same sources as `formatDate()`. Returns
 * `undefined` for an unresolvable source. This is a one-shot computation against `options.now` (or
 * the current instant); it does not schedule a refresh -- pair it with your own timer, or use
 * `<lr-relative-time sync>`, for text that must stay current while displayed.
 */
export function formatRelativeTime(
  value: string | number | Date,
  locale?: string,
  options: LyraFormatRelativeTimeOptions = {},
): string | undefined {
  const target = resolveDateSource(value)?.getTime();
  if (target === undefined) return undefined;
  const now = options.now ?? Date.now();
  const state = resolveRelativeTimeState((target - now) / 1000, options.unit ?? 'auto');
  const formatOptions = relativeTimeFormatOptions(options.format ?? 'long', options.numeric ?? 'auto');
  return getRelativeTimeFormat(locale, formatOptions).format(state.value, state.selected);
}

export interface LyraFormatBytesOptions {
  readonly unit?: LyraFormatBytesUnit;
  readonly display?: LyraFormatDisplay;
  /** The magnitude ladder step between units (`kilobyte` = 1000 bytes; pass `1024` for the binary
   * ladder). Default `1000`, matching `<lr-format-bytes>`. */
  readonly unitStep?: number;
  readonly decimals?: number;
}

const DEFAULT_BYTES_UNIT_STEP = 1000;
const DEFAULT_BYTES_DECIMALS = 1;
const DECIMAL_STRING_PATTERN = /^\s*(-?)(\d+)(?:\.(\d+))?\s*$/;

interface ExactDecimal {
  /** The value's digits with the decimal point removed: `numerator / 10n ** BigInt(scale)` is
   * the exact source value. */
  readonly numerator: bigint;
  readonly scale: number;
}

/** Parses a finite `number`, `bigint`, or decimal string into an exact `numerator / 10**scale`
 * pair with no float rounding. Returns `undefined` for a non-finite/non-integer `number` or a
 * malformed string -- those fall back to {@link byteFormat}'s existing float-based scaling. */
function exactDecimal(value: LyraFormattableNumber): ExactDecimal | undefined {
  if (typeof value === 'bigint') return { numerator: value, scale: 0 };
  if (typeof value === 'number') {
    return Number.isFinite(value) && Number.isInteger(value) ? { numerator: BigInt(value), scale: 0 } : undefined;
  }
  const match = DECIMAL_STRING_PATTERN.exec(value);
  if (!match) return undefined;
  const [, sign, whole, fraction = ''] = match;
  return { numerator: BigInt(`${sign}${whole}${fraction}`), scale: fraction.length };
}

/**
 * Divides an exact `numerator / 10**scale` value by `divisor`, rounding half away from zero to
 * `decimals` fraction digits -- entirely in `bigint` arithmetic, so the requested display rounding
 * is the only precision ever lost, never the source magnitude.
 */
function divideExact(numerator: bigint, scale: number, divisor: bigint, decimals: number): string {
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  const roundScale = 10n ** BigInt(decimals);
  const denominator = 10n ** BigInt(scale) * divisor;
  const scaledNumerator = magnitude * roundScale;
  const quotient = scaledNumerator / denominator;
  const remainder = scaledNumerator % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  const digits = rounded.toString().padStart(decimals + 1, '0');
  const integerPart = digits.slice(0, digits.length - decimals) || '0';
  const fractionPart = decimals > 0 ? digits.slice(digits.length - decimals) : '';
  // A negative source that rounds to zero still formats as "-0" -- matching what
  // `Intl.NumberFormat` itself does for a negative `number`/`bigint` input (`format(-0.04)` with
  // `maximumFractionDigits: 1` prints "-0", not "0"), so the exact and float scaling paths agree.
  const sign = negative ? '-' : '';
  return fractionPart ? `${sign}${integerPart}.${fractionPart}` : `${sign}${integerPart}`;
}

/**
 * Locale-aware byte/bit-size output (`"1.5 MB"`), sharing the library's memoized formatter cache
 * and the same unit-ladder selection `<lr-format-bytes>` renders with. `value` may be a `bigint`
 * or a decimal string: the unit ladder is still selected from an approximate magnitude (which
 * unit is only ever a display choice), but the displayed amount itself is computed with exact
 * `bigint` division, so a byte count beyond `Number.MAX_SAFE_INTEGER` -- an exact file size, a
 * cumulative transfer counter -- never gets rounded away. Returns `undefined` for a non-finite or
 * unparseable `value`, matching `formatDate()`/`formatRelativeTime()`'s "unresolvable input"
 * convention -- `Intl.NumberFormat` throws for `style: 'unit'` paired with the undefined unit a
 * `NaN` magnitude would otherwise select.
 */
export function formatBytes(
  value: LyraFormattableNumber,
  locale?: string,
  options: LyraFormatBytesOptions = {},
): string | undefined {
  const unit = options.unit ?? 'byte';
  const display = options.display ?? 'short';
  const unitStep = options.unitStep ?? DEFAULT_BYTES_UNIT_STEP;
  const decimals = finiteInteger(options.decimals ?? DEFAULT_BYTES_DECIMALS, 1, 0, 10);

  const exact = exactDecimal(value);
  if (exact === undefined) {
    // A non-finite number or a malformed string: fall back to `<lr-format-bytes>`'s existing
    // float-based scaling so behavior matches the element for the same bad input.
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    const { amount, options: formatOptions } = byteFormat(numeric, unit, display, unitStep, decimals);
    return formatNumber(amount, locale, formatOptions);
  }

  const approximateMagnitude = Number(exact.numerator) / 10 ** exact.scale;
  const { options: formatOptions } = byteFormat(approximateMagnitude, unit, display, unitStep, decimals);
  const index = byteUnitIndex(approximateMagnitude, unitStep);
  const divisor = BigInt(Math.round(safeByteUnitStep(unitStep))) ** BigInt(index);
  const amount = divideExact(exact.numerator, exact.scale, divisor, decimals);
  return formatNumber(amount, locale, formatOptions);
}
