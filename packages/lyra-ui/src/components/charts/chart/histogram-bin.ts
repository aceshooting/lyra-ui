import { getNumberFormat } from '../../../internal/intl-cache.js';
import { resolveActiveOrExplicitLocale } from '../../../internal/localization-runtime.js';
import { finiteInterpolate, finiteRatio } from '../../../internal/numbers.js';
import { chartValueFractionDigits } from '../../../internal/chart-number-format.js';

export interface HistogramBucket {
  label: string;
  count: number;
}

const MAX_HISTOGRAM_BINS = 1_000;
const LEFT_TO_RIGHT_ISOLATE = '\u2066';
const POP_DIRECTIONAL_ISOLATE = '\u2069';

/** Converts an untyped bucket count to a bounded, non-negative integer. */
export function normalizeHistogramBinCount(binCount: unknown): number {
  let numeric: number;
  try {
    numeric = typeof binCount === 'number' ? binCount : Number(binCount);
  } catch {
    return 0; // an object whose conversion throws is not a count
  }
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(MAX_HISTOGRAM_BINS, Math.max(0, Math.floor(numeric)));
}

/** Formats bin boundaries with enough precision to distinguish adjacent values. */
export function histogramNumberFormat(locale: string | undefined, width: number, constant?: number): Intl.NumberFormat {
  const magnitude = Math.abs(constant ?? width);
  if (magnitude > 0 && magnitude < 1e-18) {
    return getNumberFormat(locale, { notation: 'scientific', maximumSignificantDigits: 17 });
  }
  return getNumberFormat(locale, { maximumFractionDigits: constant === undefined
    ? Math.min(20, Math.max(0, 1 - Math.floor(Math.log10(width)))) || 0
    : chartValueFractionDigits(constant) });
}

/** Splits `values` into `binCount` equal-width buckets and counts membership.
 *  Non-finite `binCount` (or <= 0) yields no buckets; a fractional `binCount`
 *  is floored and an excessive count is capped; non-finite samples in
 *  `values` are dropped rather than corrupting bucket-index math. Pass a BCP 47
 *  `locale` to localize the generated range labels -- an omitted value (or `'auto'`) resolves to
 *  the page's active `setLyraLocale()` locale the same way `utilities/format.ts`'s helpers do
 *  (see `resolveActiveOrExplicitLocale()`), falling back to `'en'` only once none has been set;
 *  an explicit tag always stays authoritative. `<lr-histogram>` itself is unaffected -- it always
 *  passes its own resolved `effectiveLocale` here. Range bounds show two significant digits of the
 *  bin width (no fraction digits once the width reaches 10) and never a forced trailing zero. */
export function binValues(
  values: readonly number[],
  binCount: number,
  locale?: string,
): HistogramBucket[] {
  const finite = values.filter(Number.isFinite);
  return histogramBucketsInDomain(finite, normalizeHistogramBinCount(binCount), histogramDomain(finite), locale);
}

export function histogramDomain(finite: readonly number[]): readonly [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const value of finite) {
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }
  return [lo, hi];
}

export function histogramBucketIndex(value: number, lo: number, hi: number, bins: number): number {
  return lo === hi ? 0 : Math.min(bins - 1, Math.max(0, Math.floor(finiteRatio(value, lo, hi) * bins)));
}

export function histogramBucketsInDomain(
  finite: readonly number[], bins: number, [lo, hi]: readonly [number, number], locale?: string,
): HistogramBucket[] {
  if (!finite.length || bins <= 0) return [];
  // Constant data (lo === hi) previously fell into the `v === hi` branch
  // below, which places every value in the *last* bucket alone — misleading,
  // since every other bucket reads 0 and the label implies a spread that
  // isn't real. Spread it into the *first* bucket instead so a single-value
  // dataset reads as "N items, one bucket populated" starting from the data's
  // own value, not its synthetic +1 upper edge.
  const constant = hi === lo;
  const resolvedLocale = resolveActiveOrExplicitLocale(locale);
  // Two significant digits of the bin width tell adjacent edges apart (none for widths of 10 and
  // above); a constant domain keeps three significant digits of its value. No forced trailing zero.
  const width = hi / bins - lo / bins;
  const numberFormat = histogramNumberFormat(resolvedLocale, width, constant ? lo : undefined);
  if (constant) {
    // A constant domain contains one truthful bucket. In particular, `MAX_VALUE + 1` is still
    // `MAX_VALUE`, so fabricating `binCount` ranges from that synthetic upper edge produces
    // repeated zero-width labels. Returning the single value also avoids implying a spread that
    // does not exist for ordinary constant input.
    return [{
      label: `${LEFT_TO_RIGHT_ISOLATE}${numberFormat.format(lo)}${POP_DIRECTIONAL_ISOLATE}`,
      count: finite.length,
    }];
  }
  const labelHi = hi;
  const formatRange = (
    numberFormat as Intl.NumberFormat & {
      formatRange?: (start: number, end: number) => string;
    }
  ).formatRange?.bind(numberFormat);

  const buckets: HistogramBucket[] = Array.from({ length: bins }, (_, i) => {
    const bLo = finiteInterpolate(lo, labelHi, i / bins);
    const bHi = finiteInterpolate(lo, labelHi, (i + 1) / bins);
    return {
      label: `${LEFT_TO_RIGHT_ISOLATE}${
        formatRange
          ? formatRange(bLo, bHi)
          : `${numberFormat.format(bLo)}–${numberFormat.format(bHi)}`
      }${POP_DIRECTIONAL_ISOLATE}`,
      count: 0,
    };
  });

  for (const v of finite) {
    buckets[histogramBucketIndex(v, lo, hi, bins)]!.count++;
  }
  return buckets;
}
