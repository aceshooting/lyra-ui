import { expect } from '@open-wc/testing';
import type { LyraHistogramDistribution } from '../../../utilities/data-preparation.js';
import { binnedBuckets, distributionBuckets, invalidateHistogramBuckets, snapshotHistogramDistribution } from './histogram-buckets.js';

const LEFT_TO_RIGHT_ISOLATE = String.fromCharCode(0x2066);
const POP_DIRECTIONAL_ISOLATE = String.fromCharCode(0x2069);

function distribution(): LyraHistogramDistribution {
  return {
    revision: 'r', counts: { sourceCount: 10, validCount: 8, invalidCount: 2 },
    domain: { min: -1, max: 3 }, edges: [0, 1, 2], binCounts: [2, 3], belowCount: 1, aboveCount: 2,
  };
}

/** The plain object `binnedBuckets` reads from a histogram host. */
function host(source: unknown) {
  return { distribution: source as LyraHistogramDistribution | null, bins: 5, values: [] as number[], effectiveLocale: 'en' };
}

describe('histogram distribution admission', () => {
  it('copies an exact distribution into a frozen snapshot', () => {
    const snapshot = snapshotHistogramDistribution(distribution());
    expect(snapshot.binCounts).to.deep.equal([2, 3]);
    expect(snapshot.edges).to.deep.equal([0, 1, 2]);
    expect([snapshot.belowCount, snapshot.aboveCount]).to.deep.equal([1, 2]);
    expect(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.edges) && Object.isFrozen(snapshot.binCounts)).to.equal(true);
  });

  it('rejects a distribution or nested record that is not an object', () => {
    expect(() => snapshotHistogramDistribution(null)).to.throw(TypeError, 'Invalid distribution');
    expect(() => snapshotHistogramDistribution(7)).to.throw(TypeError, 'Invalid distribution');
    expect(() => snapshotHistogramDistribution({ ...distribution(), counts: 5 })).to.throw(TypeError, 'Invalid distribution');
    expect(() => snapshotHistogramDistribution({ ...distribution(), domain: 'wide' })).to.throw(TypeError, 'Invalid distribution');
  });

  it('rejects edges or counts that are not arrays', () => {
    expect(() => snapshotHistogramDistribution({ ...distribution(), edges: 'abc' })).to.throw(TypeError, 'Invalid bins');
    expect(() => snapshotHistogramDistribution({ ...distribution(), binCounts: 'abc' })).to.throw(TypeError, 'Invalid bins');
  });

  it('rejects bin counts that exceed the valid observations and outliers that contradict the domain', () => {
    expect(() => snapshotHistogramDistribution({ ...distribution(), binCounts: [9, 1] })).to.throw(TypeError, 'Invalid bin count');
    // The domain says nothing exceeds the last edge although two observations are counted above it.
    expect(() => snapshotHistogramDistribution({ ...distribution(), domain: { min: -1, max: 2 } })).to.throw(TypeError, 'Invalid outlier domain');
    // The domain says nothing sits below the first edge although one observation is counted there.
    expect(() => snapshotHistogramDistribution({ ...distribution(), domain: { min: 0, max: 3 } })).to.throw(TypeError, 'Invalid outlier domain');
  });
});

describe('histogram distribution labels', () => {
  it('labels every explicit bin with an isolated range and the exact count', () => {
    const buckets = distributionBuckets(snapshotHistogramDistribution(distribution()), 'en');
    expect(buckets.map(bucket => bucket.count)).to.deep.equal([2, 3]);
    expect(buckets.every(bucket => bucket.label.startsWith(LEFT_TO_RIGHT_ISOLATE) && bucket.label.endsWith(POP_DIRECTIONAL_ISOLATE))).to.equal(true);
    expect(buckets[0]!.label).to.contain('0');
    expect(buckets[1]!.label).to.contain('2');
  });

  it('joins the range endpoints itself when the engine has no range formatter', () => {
    const prototype = Intl.NumberFormat.prototype as { formatRange?: unknown };
    const original = Object.getOwnPropertyDescriptor(prototype, 'formatRange');
    try {
      Reflect.deleteProperty(prototype, 'formatRange');
      const labels = distributionBuckets(snapshotHistogramDistribution(distribution()), 'en').map(bucket => bucket.label);
      expect(labels).to.deep.equal([
        `${LEFT_TO_RIGHT_ISOLATE}0\u20131${POP_DIRECTIONAL_ISOLATE}`,
        `${LEFT_TO_RIGHT_ISOLATE}1\u20132${POP_DIRECTIONAL_ISOLATE}`,
      ]);
    } finally {
      if (original) Object.defineProperty(prototype, 'formatRange', original);
    }
  });
});

describe('histogram distribution buckets for a host', () => {
  it('reuses the buckets of an unchanged distribution until it is explicitly refreshed', () => {
    const source = host(distribution());
    const first = binnedBuckets(source);
    expect(first.map(bucket => bucket.count)).to.deep.equal([2, 3]);
    expect(binnedBuckets(source) === first).to.equal(true);
    invalidateHistogramBuckets(source);
    const refreshed = binnedBuckets(source);
    expect(refreshed === first).to.equal(false);
    expect(refreshed.map(bucket => bucket.count)).to.deep.equal([2, 3]);
  });

  it('yields no buckets for a distribution that fails admission and recovers once it is replaced', () => {
    const source = host(7);
    expect(binnedBuckets(source)).to.deep.equal([]);
    source.distribution = distribution();
    expect(binnedBuckets(source).map(bucket => bucket.count)).to.deep.equal([2, 3]);
  });
});
