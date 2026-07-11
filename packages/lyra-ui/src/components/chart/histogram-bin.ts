export interface HistogramBucket {
  label: string;
  count: number;
}

/** Splits `values` into `binCount` equal-width buckets and counts membership. */
export function binValues(values: number[], binCount: number): HistogramBucket[] {
  if (values.length === 0 || binCount <= 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
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
