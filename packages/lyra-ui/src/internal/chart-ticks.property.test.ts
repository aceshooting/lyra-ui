import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { boundedTicks, niceStep } from './chart-ticks.js';

describe('chart-ticks properties', () => {
  it('niceStep is positive and finite-or-1 with a 1/2/5 mantissa', () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-9, max: 1e12, noNaN: true }), fc.integer({ min: 1, max: 20 }), (range, count) => {
        const step = niceStep(range, count);
        expect(step > 0 && Number.isFinite(step)).to.equal(true);
        const mantissa = step / 10 ** Math.floor(Math.log10(step));
        expect([1, 2, 5, 10].some((m) => Math.abs(mantissa - m) < 1e-6 * m)).to.equal(true);
      }),
      propertyRuns(),
    );
  });
  it('boundedTicks is strictly ascending, capped and never throws', () => {
    fc.assert(
      fc.property(fc.double(), fc.double(), fc.double(), fc.integer({ min: 1, max: 100 }), (a, b, step, cap) => {
        const ticks = boundedTicks(a, b, step, cap);
        for (let i = 1; i < ticks.length; i++) expect(ticks[i]! > ticks[i - 1]!).to.equal(true);
        expect(ticks.length).to.be.at.most(Math.max(cap, 2));
      }),
      propertyRuns(),
    );
  });
});
