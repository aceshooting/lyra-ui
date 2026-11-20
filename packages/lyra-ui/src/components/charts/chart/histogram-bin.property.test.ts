import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { binValues, histogramBucketIndex, histogramDomain, normalizeHistogramBinCount } from './histogram-bin.js';

const sample = fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true });
const mixed = fc.array(fc.oneof(sample, fc.constantFrom(Number.NaN, Infinity, -Infinity)), { maxLength: 80 });

describe('histogram binning properties', () => {
  it('normalizes any bin count to an integer within [0, 1000]', () => {
    fc.assert(fc.property(fc.anything(), (input) => {
      const bins = normalizeHistogramBinCount(input);
      expect(Number.isInteger(bins) && bins >= 0 && bins <= 1000, 'bounded integer').to.equal(true);
    }), propertyRuns());
  });

  it('counts every finite sample exactly once and drops the rest', () => {
    fc.assert(fc.property(mixed, fc.integer({ min: 0, max: 40 }), (values, bins) => {
      const finite = values.filter(Number.isFinite).length;
      const buckets = binValues(values, bins, 'en');
      const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
      if (finite === 0 || bins === 0) expect(buckets).to.deep.equal([]);
      else expect(total, 'every finite sample is bucketed once').to.equal(finite);
      expect(buckets.length <= Math.max(bins, 1), 'never more buckets than requested').to.equal(true);
    }), propertyRuns());
  });

  it('keeps the bucket index in range and monotonic in the value', () => {
    fc.assert(fc.property(sample, sample, sample, sample, fc.integer({ min: 1, max: 64 }), (a, b, x, y, bins) => {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const indexX = histogramBucketIndex(x, lo, hi, bins);
      const indexY = histogramBucketIndex(y, lo, hi, bins);
      expect(indexX >= 0 && indexX < bins, 'index in range').to.equal(true);
      if (x <= y) expect(indexX <= indexY, 'monotonic').to.equal(true);
    }), propertyRuns());
  });

  it('derives a domain that contains every sample', () => {
    fc.assert(fc.property(fc.array(sample, { minLength: 1, maxLength: 60 }), (values) => {
      const [lo, hi] = histogramDomain(values);
      expect(values.every((value) => value >= lo && value <= hi)).to.equal(true);
      expect(values.includes(lo) && values.includes(hi)).to.equal(true);
    }), propertyRuns());
  });
});
