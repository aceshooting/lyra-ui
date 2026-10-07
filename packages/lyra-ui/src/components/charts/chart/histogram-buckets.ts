import type { LyraHistogram } from './histogram.class.js';
import { binValues, normalizeHistogramBinCount, type HistogramBucket } from './histogram-bin.js';

// Both the `labels` and `datasets` accessors below derive from the same
// `binValues(values, bins)` pass, and `LyraChart` reads `datasets` more than
// once per `draw()`/`render()` — memoize the last bucketing result per
// instance (keyed by reference equality on `values`/`bins`, matching Lit's
// own change detection for the `values` array) so an unrelated property
// change doesn't re-run the O(n) bucketing loop from scratch on every access.
const bucketCache = new WeakMap<
  LyraHistogram,
  { values: readonly number[]; bins: number; locale: string; buckets: HistogramBucket[] }
>();

export function binnedBuckets(el: LyraHistogram): HistogramBucket[] {
  const bins = normalizeHistogramBinCount(el.bins);
  const locale = (el as unknown as { effectiveLocale: string }).effectiveLocale;
  const cached = bucketCache.get(el);
  if (
    cached &&
    cached.values === el.values &&
    cached.bins === bins &&
    cached.locale === locale
  ) {
    return cached.buckets;
  }
  const buckets = binValues(el.values, bins, locale);
  bucketCache.set(el, { values: el.values, bins, locale, buckets });
  return buckets;
}

