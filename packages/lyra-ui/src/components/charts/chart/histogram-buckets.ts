import type { LyraHistogramDistribution } from '../../../utilities/data-preparation.js';
import { sourceCount, sourceRevision } from '../../../internal/source-request-controller.js';
import { resolveActiveOrExplicitLocale } from '../../../internal/localization-runtime.js';
import { histogramBucketIndex, histogramBucketsInDomain, histogramDomain, histogramNumberFormat, normalizeHistogramBinCount, type HistogramBucket } from './histogram-bin.js';

interface HistogramBucketSource {
  readonly distribution?: LyraHistogramDistribution | null;
  readonly bins: number;
  readonly values: readonly number[];
}

function own(value: unknown, key: PropertyKey): unknown {
  if (value === null || typeof value !== 'object') throw new TypeError('Invalid distribution');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) throw new TypeError('Invalid distribution');
  return descriptor.value;
}

/** @internal Bounded own-data snapshot; accessors and sparse arrays are not observations. */
export function snapshotHistogramDistribution(value: unknown): LyraHistogramDistribution {
  const revision = sourceRevision(own(value, 'revision'));
  const rawCounts = own(value, 'counts');
  const source = sourceCount(own(rawCounts, 'sourceCount'));
  const valid = sourceCount(own(rawCounts, 'validCount'));
  const invalid = sourceCount(own(rawCounts, 'invalidCount'));
  if (valid > source || invalid !== source - valid) throw new TypeError('Invalid counts');
  const rawEdges = own(value, 'edges'), rawBins = own(value, 'binCounts');
  if (!Array.isArray(rawEdges) || !Array.isArray(rawBins)) throw new TypeError('Invalid bins');
  const edgeLength = sourceCount(own(rawEdges, 'length')), binLength = sourceCount(own(rawBins, 'length'));
  if (edgeLength > 1001 || binLength > 1000 || (edgeLength !== 0 && edgeLength < 2) ||
    binLength !== Math.max(0, edgeLength - 1)) throw new TypeError('Invalid bins');
  const edges: number[] = [], binCounts: number[] = [];
  for (let index = 0; index < edgeLength; index++) {
    const edge = own(rawEdges, index);
    if (typeof edge !== 'number' || !Number.isFinite(edge) || (index > 0 && edge <= edges[index - 1]!)) throw new TypeError('Invalid edge');
    edges.push(edge);
  }
  let remainder = valid;
  for (let index = 0; index < binLength; index++) {
    const count = sourceCount(own(rawBins, index));
    if (count > remainder) throw new TypeError('Invalid bin count');
    remainder -= count; binCounts.push(count);
  }
  const belowCount = sourceCount(own(value, 'belowCount')), aboveCount = sourceCount(own(value, 'aboveCount'));
  if (belowCount > remainder || aboveCount !== remainder - belowCount || (!edges.length && valid !== 0)) throw new TypeError('Invalid outliers');
  const rawDomain = own(value, 'domain');
  let domain: { readonly min: number; readonly max: number } | null = null;
  if (valid) {
    const min = own(rawDomain, 'min'), max = own(rawDomain, 'max');
    if (typeof min !== 'number' || typeof max !== 'number' || !Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new TypeError('Invalid domain');
    if ((belowCount > 0) !== (min < edges[0]!) || (aboveCount > 0) !== (max > edges.at(-1)!)) throw new TypeError('Invalid outlier domain');
    for (let index = 0; index < binLength; index++) {
      if (binCounts[index] === 0) continue;
      const lo = edges[index]!, hi = edges[index + 1]!;
      if (lo > max || (index === binLength - 1 ? hi < min : hi <= min)) throw new TypeError('Populated bin outside domain');
    }
    const partition = (point: number): number => {
      if (point < edges[0]!) return -1;
      if (point > edges[edgeLength - 1]!) return binLength;
      let index = 0;
      while (index < binLength - 1 && point >= edges[index + 1]!) index++;
      return index;
    };
    const partitionCount = (index: number): number => index < 0 ? belowCount : index === binLength ? aboveCount : binCounts[index]!;
    const minPartition = partition(min), maxPartition = partition(max);
    if (partitionCount(minPartition) === 0 || partitionCount(maxPartition) === 0 ||
      (min !== max && minPartition === maxPartition && partitionCount(minPartition) < 2)) throw new TypeError('Unrepresented domain extrema');
    domain = Object.freeze({ min, max });
  } else if (rawDomain !== null) throw new TypeError('Invalid empty domain');
  return Object.freeze({ revision, counts: Object.freeze({ sourceCount: source, validCount: valid, invalidCount: invalid }),
    domain, edges: Object.freeze(edges), binCounts: Object.freeze(binCounts), belowCount, aboveCount });
}

/** @internal Preserve locale range labels for explicit, potentially unequal-width bins. */
export function distributionBuckets(distribution: LyraHistogramDistribution, locale?: string): HistogramBucket[] {
  return Object.freeze(distribution.binCounts.map((count, index) => {
    const lo = distribution.edges[index]!, hi = distribution.edges[index + 1]!;
    const width = hi - lo;
    const formatter = histogramNumberFormat(resolveActiveOrExplicitLocale(locale), width);
    const range = (formatter as Intl.NumberFormat & { formatRange?: (start: number, end: number) => string }).formatRange;
    const label = range ? range.call(formatter, lo, hi) : `${formatter.format(lo)}–${formatter.format(hi)}`;
    return Object.freeze({ label: `\u2066${label}\u2069`, count });
  })) as HistogramBucket[];
}

const distributionCache = new WeakMap<HistogramBucketSource, { source: LyraHistogramDistribution; locale: string; buckets: HistogramBucket[] }>();
const distributionGenerations = new WeakMap<HistogramBucketSource, object>();
/** @internal Rebind an explicitly refreshed mutable distribution. */
export function invalidateHistogramBuckets(el: HistogramBucketSource): void {
  distributionGenerations.set(el, {});
  distributionCache.delete(el);
}

interface RawHistogramCache {
  values: readonly number[];
  bins: number;
  locale: string;
  domain: readonly [number, number];
  buckets: HistogramBucket[];
}
const bucketCache = new WeakMap<HistogramBucketSource, RawHistogramCache>();

/** Keep range labels and count only the changed samples while both domain endpoints survive. */
export function extendHistogramBuckets(
  el: HistogramBucketSource, previous: readonly number[], removed: number, added: readonly number[],
): void {
  const cache = bucketCache.get(el);
  if (!cache || cache.values !== previous || !cache.buckets.length) return;
  const [lo, hi] = cache.domain;
  for (let index = 0; index < removed; index++) {
    const value = previous[index];
    if (value === lo || value === hi) return;
  }
  if (added.some(value => value < lo || value > hi)) return;
  const deltas = new Int32Array(cache.buckets.length);
  for (let index = 0; index < removed; index++) {
    const value = previous[index]!;
    if (Number.isFinite(value)) deltas[histogramBucketIndex(value, lo, hi, cache.bins)]!--;
  }
  for (const value of added) deltas[histogramBucketIndex(value, lo, hi, cache.bins)]!++;
  const buckets = cache.buckets.map((bucket, i) => deltas[i] ? { label: bucket.label, count: bucket.count + deltas[i]! } : bucket);
  bucketCache.set(el, { ...cache, values: el.values, buckets });
}

export function binnedBuckets(el: HistogramBucketSource): HistogramBucket[] {
  const locale = (el as unknown as { effectiveLocale: string }).effectiveLocale;
  const distribution = el.distribution;
  if (distribution != null) {
    const generation = distributionGenerations.get(el);
    const cached = distributionCache.get(el);
    if (cached?.source === distribution && cached.locale === locale) return cached.buckets;
    let buckets: HistogramBucket[];
    try { buckets = distributionBuckets(snapshotHistogramDistribution(distribution), locale); }
    catch { buckets = []; }
    // Descriptor traps can replace or explicitly refresh the source during capture.
    if (el.distribution === distribution && distributionGenerations.get(el) === generation) {
      distributionCache.set(el, { source: distribution, locale, buckets });
    }
    return buckets;
  }
  const bins = normalizeHistogramBinCount(el.bins);
  const cached = bucketCache.get(el);
  if (
    cached &&
    cached.values === el.values &&
    cached.bins === bins &&
    cached.locale === locale
  ) {
    return cached.buckets;
  }
  const finite = el.values.filter(Number.isFinite);
  const domain = histogramDomain(finite);
  const buckets = histogramBucketsInDomain(finite, bins, domain, locale);
  bucketCache.set(el, { values: el.values, bins, locale, domain, buckets });
  return buckets;
}
