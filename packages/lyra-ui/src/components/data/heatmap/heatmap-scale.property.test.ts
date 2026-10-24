import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { linearAlpha, linearBucket, midpointAlpha, midpointBucket, sqrtStep } from './heatmap-scale.js';

const anyDouble = fc.double();
const bound = fc.double({ min: -1000, max: 1000, noNaN: true });
const probe = fc.double({ min: -3000, max: 3000, noNaN: true });
const steps = fc.integer({ min: 1, max: 64 });

/** A finite ascending domain with an anchor strictly inside it. */
const anchored = fc
  .record({
    lo: bound,
    below: fc.double({ min: 0.5, max: 500, noNaN: true, noDefaultInfinity: true }),
    above: fc.double({ min: 0.5, max: 500, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ lo, below, above }) => ({ lo, midpoint: lo + below, hi: lo + below + above }));

describe('midpoint-anchored heatmap ramp properties', () => {
  it('pins the domain ends to the alpha floor and ceiling and the anchor to the middle of the ramp', () => {
    fc.assert(
      fc.property(anchored, ({ lo, midpoint, hi }) => {
        expect(midpointAlpha(lo, lo, hi, midpoint), 'low end').to.equal(0.1);
        expect(midpointAlpha(hi, lo, hi, midpoint), 'high end').to.equal(1);
        expect(midpointAlpha(midpoint, lo, hi, midpoint), 'anchor').to.be.closeTo(0.55, 1e-12);
      }),
      propertyRuns(),
    );
  });

  it('never leaves the alpha range and never decreases as the value grows', () => {
    fc.assert(
      fc.property(anchored, probe, probe, ({ lo, midpoint, hi }, first, second) => {
        const [low, high] = first <= second ? [first, second] : [second, first];
        const a = midpointAlpha(low, lo, hi, midpoint);
        const b = midpointAlpha(high, lo, hi, midpoint);
        const label = `lo=${lo} midpoint=${midpoint} hi=${hi} low=${low} high=${high}: ${a} then ${b}`;
        expect(a >= 0.1 && a <= 1 && b >= 0.1 && b <= 1, `outside the alpha range: ${label}`).to.equal(true);
        expect(a <= b + 1e-12, `decreased: ${label}`).to.equal(true);
      }),
      propertyRuns(),
    );
  });

  it('scales each half of the ramp by its own distance, so mirroring the data mirrors the ramp', () => {
    fc.assert(
      fc.property(anchored, probe, ({ lo, midpoint, hi }, value) => {
        const direct = midpointAlpha(value, lo, hi, midpoint);
        const mirrored = midpointAlpha(-value, -hi, -lo, -midpoint);
        expect(direct + mirrored, `lo=${lo} midpoint=${midpoint} hi=${hi} value=${value}`).to.be.closeTo(1.1, 1e-9);
      }),
      propertyRuns(),
    );
  });

  it('degrades to the plain min-max ramp for a non-finite input or an anchor outside the domain', () => {
    const outside = fc.oneof(
      fc.record({ value: anyDouble, lo: anyDouble, hi: anyDouble, midpoint: anyDouble }),
      fc.record({ value: probe, lo: bound, hi: bound, midpoint: fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY) }),
      fc.record({ value: probe, lo: bound, hi: bound, midpoint: bound }).filter(({ lo, hi, midpoint }) => !(midpoint > lo && midpoint < hi)),
    );
    fc.assert(
      fc.property(outside, ({ value, lo, hi, midpoint }) => {
        const finiteInputs = [value, lo, hi, midpoint].every(Number.isFinite);
        if (finiteInputs && midpoint > lo && midpoint < hi) return;
        expect(midpointAlpha(value, lo, hi, midpoint), `value=${value} lo=${lo} hi=${hi} midpoint=${midpoint}`)
          .to.equal(linearAlpha(value, lo, hi));
      }),
      propertyRuns(),
    );
  });

  it('keeps a discrete bucket inside the ramp, with the domain ends in the first and last step', () => {
    fc.assert(
      fc.property(anchored, steps, probe, ({ lo, midpoint, hi }, count, value) => {
        const bucket = midpointBucket(value, lo, hi, midpoint, count);
        expect(Number.isInteger(bucket) && bucket >= 0 && bucket <= count - 1, `bucket ${bucket} of ${count}`).to.equal(true);
        expect(midpointBucket(lo, lo, hi, midpoint, count)).to.equal(0);
        expect(midpointBucket(hi, lo, hi, midpoint, count)).to.equal(count - 1);
      }),
      propertyRuns(),
    );
  });
});

describe('sqrt-compressed heatmap step properties', () => {
  it('marks only a negative count as no data and puts every count of an all-zero range in the first step', () => {
    fc.assert(
      fc.property(fc.double({ min: -1000, max: -Number.MIN_VALUE, noNaN: true }), fc.double({ min: -10, max: 1000, noNaN: true }), steps, (count, max, stepCount) => {
        expect(sqrtStep(count, max, stepCount)).to.equal(-1);
      }),
      propertyRuns(),
    );
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1000, noNaN: true }), fc.double({ min: -1000, max: 0, noNaN: true }), steps, (count, max, stepCount) => {
        expect(sqrtStep(count, max, stepCount)).to.equal(0);
      }),
      propertyRuns(),
    );
  });

  it('stays inside the ramp and never decreases as the count grows', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2000, noNaN: true }),
        fc.double({ min: 0, max: 2000, noNaN: true }),
        fc.double({ min: 0.001, max: 1000, noNaN: true }),
        steps,
        (first, second, max, count) => {
          const [low, high] = first <= second ? [first, second] : [second, first];
          const a = sqrtStep(low, max, count);
          const b = sqrtStep(high, max, count);
          expect(Number.isInteger(a) && a >= 0 && a <= count - 1 && Number.isInteger(b) && b >= 0 && b <= count - 1, `${a}, ${b} of ${count}`).to.equal(true);
          expect(a <= b, `${low} -> ${a}, ${high} -> ${b} (max ${max}, ${count} steps)`).to.equal(true);
          expect(sqrtStep(0, max, count)).to.equal(0);
          expect(sqrtStep(max, max, count)).to.equal(count - 1);
        },
      ),
      propertyRuns(),
    );
  });
});

describe('linear heatmap step properties', () => {
  it('maps the domain ends to the first and last step for any ascending finite domain', () => {
    fc.assert(
      fc.property(anchored, steps, ({ lo, hi }, count) => {
        expect(linearBucket(lo, lo, hi, count)).to.equal(0);
        expect(linearBucket(hi, lo, hi, count)).to.equal(count - 1);
      }),
      propertyRuns(),
    );
  });
});

describe('midpoint-anchored heatmap ramp fallbacks', () => {
  it('falls back to the plain ramp when the value, anchor or domain ends are not finite', () => {
    const plain = (value: number, lo: number, hi: number) => linearAlpha(value, lo, hi);
    expect(midpointAlpha(Number.NaN, 0, 10, 5)).to.equal(plain(Number.NaN, 0, 10));
    expect(midpointAlpha(4, 0, 10, Number.NaN)).to.equal(plain(4, 0, 10));
    expect(midpointAlpha(4, 0, 10, Number.POSITIVE_INFINITY)).to.equal(plain(4, 0, 10));
    expect(midpointAlpha(4, Number.NEGATIVE_INFINITY, 10, 5)).to.equal(plain(4, Number.NEGATIVE_INFINITY, 10));
    expect(midpointAlpha(4, 0, Number.POSITIVE_INFINITY, 5)).to.equal(plain(4, 0, Number.POSITIVE_INFINITY));
    expect(midpointAlpha(4, Number.NaN, 10, 5)).to.equal(plain(4, Number.NaN, 10));
    expect(midpointBucket(4, 0, Number.POSITIVE_INFINITY, 5, 8)).to.equal(linearBucket(4, 0, Number.POSITIVE_INFINITY, 8));
  });

  it('puts a value between the anchor and the high end on the upper half of the ramp', () => {
    expect(midpointAlpha(5, 0, 10, 5)).to.be.closeTo(0.55, 1e-12);
    expect(midpointAlpha(7.5, 0, 10, 5)).to.be.closeTo(0.1 + 0.9 * 0.75, 1e-12);
    expect(midpointAlpha(2.5, 0, 10, 5)).to.be.closeTo(0.1 + 0.9 * 0.25, 1e-12);
    // The anchor need not be central: each half keeps its own scale.
    expect(midpointAlpha(1, 0, 10, 2)).to.be.closeTo(0.1 + 0.9 * 0.25, 1e-12);
    expect(midpointAlpha(6, 0, 10, 2)).to.be.closeTo(0.1 + 0.9 * 0.75, 1e-12);
  });
});
