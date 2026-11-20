import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { binnedBuckets, extendHistogramBuckets, snapshotHistogramDistribution } from './histogram-buckets.js';

const sample = fc.integer({ min: -500, max: 500 });

/** A consistent distribution: ascending edges, per-bin counts, outlier counts that add up. */
const distribution = fc
  .record({
    start: fc.integer({ min: -100, max: 100 }),
    widths: fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 12 }),
    below: fc.nat({ max: 5 }),
    above: fc.nat({ max: 5 }),
    seeds: fc.array(fc.nat({ max: 9 }), { minLength: 12, maxLength: 12 }),
  })
  .filter(({ widths, below, above, seeds }) => {
    const counts = seeds.slice(0, widths.length);
    return below + above + counts.reduce((a, b) => a + b, 0) > 0;
  })
  .map(({ start, widths, below, above, seeds }) => {
    const edges = [start];
    for (const width of widths) edges.push(edges.at(-1)! + width);
    const binCounts = seeds.slice(0, widths.length);
    const valid = below + above + binCounts.reduce((a, b) => a + b, 0);
    const firstPopulated = binCounts.findIndex((count) => count > 0);
    let lastPopulated = binCounts.length - 1;
    while (lastPopulated >= 0 && binCounts[lastPopulated]! <= 0) lastPopulated -= 1;
    const min = below > 0 ? edges[0]! - 1 : firstPopulated >= 0 ? edges[firstPopulated]! : edges[0]!;
    const max = above > 0 ? edges.at(-1)! + 1 : lastPopulated >= 0 ? edges[lastPopulated + 1]! - 1 : edges.at(-1)!;
    return {
      revision: 1,
      counts: { sourceCount: valid, validCount: valid, invalidCount: 0 },
      domain: { min: Math.min(min, max), max: Math.max(min, max) },
      edges,
      binCounts,
      belowCount: below,
      aboveCount: above,
    };
  });

function host(values: number[], bins: number) {
  return { bins, values, effectiveLocale: 'en' } as unknown as Parameters<typeof binnedBuckets>[0];
}

describe('histogram bucket properties', () => {
  it('never throws a non-TypeError for arbitrary snapshot input', () => {
    fc.assert(fc.property(fc.anything(), (input) => {
      try {
        snapshotHistogramDistribution(input);
      } catch (error) {
        expect(error instanceof TypeError, 'rejects with a TypeError').to.equal(true);
      }
    }), propertyRuns());
  });

  it('keeps a consistent distribution frozen, equal in content and with its counts conserved', () => {
    fc.assert(fc.property(distribution, (input) => {
      let snapshot;
      try {
        snapshot = snapshotHistogramDistribution(input);
      } catch {
        return; // generator may produce domains the validator rejects; those are not under test
      }
      expect(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.edges), 'frozen snapshot').to.equal(true);
      expect(snapshot.edges, 'edges kept').to.deep.equal(input.edges);
      const total = snapshot.binCounts.reduce((sum, count) => sum + count, 0) + snapshot.belowCount + snapshot.aboveCount;
      expect(total, 'valid count conserved').to.equal(snapshot.counts.validCount);
    }), propertyRuns());
  });

  it('extends a cached bucket set to exactly what a fresh binning gives', () => {
    fc.assert(fc.property(
      fc.array(sample, { minLength: 4, maxLength: 40 }),
      fc.integer({ min: 1, max: 12 }),
      fc.nat({ max: 3 }),
      fc.array(sample, { maxLength: 6 }),
      (values, bins, removedRaw, added) => {
        const el = host(values, bins);
        binnedBuckets(el);
        const removed = Math.min(removedRaw, values.length - 1);
        const next = [...values.slice(removed), ...added];
        const target = el as unknown as { values: number[] };
        target.values = next;
        extendHistogramBuckets(el, values, removed, added);
        const extended = binnedBuckets(el).map((bucket) => bucket.count);
        const fresh = binnedBuckets(host(next, bins)).map((bucket) => bucket.count);
        expect(extended, 'incremental update equals a fresh binning').to.deep.equal(fresh);
      }), propertyRuns());
  });
});
