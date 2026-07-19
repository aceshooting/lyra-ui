import { expect } from '@open-wc/testing';
import { linearAlpha, linearBucket, minMax, sqrtStep } from './heatmap-scale.js';

it('linearAlpha maps the value range to a 0.1-1.0 alpha ramp', () => {
  expect(linearAlpha(0, 0, 10)).to.equal(0.1);
  expect(linearAlpha(10, 0, 10)).to.equal(1);
  expect(linearAlpha(5, 0, 10)).to.be.closeTo(0.55, 0.001);
});

it('linearAlpha handles a zero-span range without dividing by zero', () => {
  expect(linearAlpha(5, 5, 5)).to.equal(0.1);
});

it('sqrtStep returns -1 only for a negative count (the no-data sentinel)', () => {
  expect(sqrtStep(-1, 10, 7)).to.equal(-1);
});

it('buckets a real zero-value count into the lowest ramp step, not "no data"', () => {
  expect(sqrtStep(0, 100, 7)).to.equal(0);
});

it('buckets an entirely-zero dataset (max <= 0) to the lowest ramp step instead of no-data', () => {
  expect(sqrtStep(0, 0, 7)).to.equal(0);
});

it('still returns -1 for a negative count', () => {
  expect(sqrtStep(-1, 100, 7)).to.equal(-1);
});

it('sqrtStep compresses large counts so one outlier does not dominate', () => {
  const stepAtQuarter = sqrtStep(25, 100, 7);
  const stepAtMax = sqrtStep(100, 100, 7);
  expect(stepAtMax).to.equal(6);
  // sqrt(25/100) = 0.5, so this should land roughly mid-scale, not near 0
  expect(stepAtQuarter).to.be.greaterThan(2);
});

describe('linearBucket', () => {
  it('maps a value linearly into [0, steps-1], not by quantile rank', () => {
    expect(linearBucket(0, 0, 100, 4)).to.equal(0);
    expect(linearBucket(24, 0, 100, 4)).to.equal(0);
    expect(linearBucket(25, 0, 100, 4)).to.equal(1);
    expect(linearBucket(99, 0, 100, 4)).to.equal(3);
    expect(linearBucket(100, 0, 100, 4)).to.equal(3);
  });

  it('clamps out-of-range values to the first/last bucket', () => {
    expect(linearBucket(-10, 0, 100, 4)).to.equal(0);
    expect(linearBucket(1000, 0, 100, 4)).to.equal(3);
  });
});

describe('minMax', () => {
  it('returns null for an empty array', () => {
    expect(minMax([])).to.equal(null);
  });

  it('returns the [lo, hi] pair for a small array', () => {
    expect(minMax([3, 1, 4, 1, 5, 9, 2, 6])).to.deep.equal([1, 9]);
  });

  it('handles a single-element array', () => {
    expect(minMax([42])).to.deep.equal([42, 42]);
  });

  it('does not crash on a very large array (spreading it into Math.min/Math.max would blow the call stack)', () => {
    const values = Array.from({ length: 150_000 }, (_, i) => i);
    expect(minMax(values)).to.deep.equal([0, 149_999]);
  });
});
