export interface HistogramBucket {
  label: string;
  count: number;
}

export const MAX_HISTOGRAM_BINS = 1_000;

/** Converts an untyped bucket count to a bounded, non-negative integer. */
export function normalizeHistogramBinCount(binCount: unknown): number {
  const numeric = typeof binCount === 'number' ? binCount : Number(binCount);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(MAX_HISTOGRAM_BINS, Math.max(0, Math.floor(numeric)));
}

/** Splits `values` into `binCount` equal-width buckets and counts membership.
 *  Non-finite `binCount` (or <= 0) yields no buckets; a fractional `binCount`
 *  is floored and an excessive count is capped; non-finite samples in
 *  `values` are dropped rather than corrupting bucket-index math. */
export function binValues(values: number[], binCount: number): HistogramBucket[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return [];
  const bins = normalizeHistogramBinCount(binCount);
  if (bins <= 0) return [];

  let lo = finite[0];
  let hi = finite[0];
  for (const v of finite) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  // Constant data (lo === hi) previously fell into the `v === hi` branch
  // below, which places every value in the *last* bucket alone — misleading,
  // since every other bucket reads 0 and the label implies a spread that
  // isn't real. Spread it into the *first* bucket instead so a single-value
  // dataset reads as "N items, one bucket populated" starting from the data's
  // own value, not its synthetic +1 upper edge.
  const constant = hi === lo;
  const span = hi - lo || 1;
  const width = span / bins;

  const buckets: HistogramBucket[] = Array.from({ length: bins }, (_, i) => {
    const bLo = lo + i * width;
    const bHi = lo + (i + 1) * width;
    return { label: `${bLo.toFixed(1)}–${bHi.toFixed(1)}`, count: 0 };
  });

  for (const v of finite) {
    const index = constant ? 0 : v === hi ? bins - 1 : Math.floor((v - lo) / width);
    buckets[Math.min(bins - 1, Math.max(0, index))].count++;
  }
  return buckets;
}
