export interface HistogramBucket {
  label: string;
  count: number;
}

/** Splits `values` into `binCount` equal-width buckets and counts membership. */
export function binValues(values: number[], binCount: number): HistogramBucket[] {
  if (values.length === 0 || binCount <= 0) return [];
  // Spreading `values` as call arguments (`Math.min(...values)`) throws
  // `RangeError: Maximum call stack size exceeded` once `values` is large
  // enough to overflow the engine's argument-list limit — reduce manually
  // instead so an arbitrarily large sample never crashes.
  let lo = values[0];
  let hi = values[0];
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const width = span / binCount;

  const buckets: HistogramBucket[] = Array.from({ length: binCount }, (_, i) => {
    const bLo = lo + i * width;
    const bHi = lo + (i + 1) * width;
    return { label: `${bLo.toFixed(1)}–${bHi.toFixed(1)}`, count: 0 };
  });

  for (const v of values) {
    const index = v === hi ? binCount - 1 : Math.floor((v - lo) / width);
    buckets[Math.min(binCount - 1, Math.max(0, index))].count++;
  }
  return buckets;
}
