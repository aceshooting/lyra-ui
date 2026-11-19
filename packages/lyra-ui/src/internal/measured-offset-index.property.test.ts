import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { MeasuredOffsetIndex } from './measured-offset-index.js';

const height = fc.oneof(fc.integer({ min: 1, max: 500 }), fc.constantFrom(Number.NaN, Infinity, -5, 0));
const clamp = (h: number, fallback: number): number => (Number.isFinite(h) ? Math.min(Math.max(h, 1), Number.MAX_SAFE_INTEGER) : fallback);

describe('measured offset index properties', () => {
  it('matches naive prefix sums after arbitrary updates', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 1, max: 200 }), { maxLength: 60 }),
      fc.array(fc.tuple(fc.integer({ min: -3, max: 70 }), height), { maxLength: 40 }),
      (initial, updates) => {
        const index = new MeasuredOffsetIndex(10);
        index.reset(initial, 10);
        const naive = [...initial];
        for (const [i, h] of updates) {
          index.set(i, h);
          if (i >= 0 && i < naive.length) naive[i] = clamp(h, naive[i]!);
        }
        let sum = 0;
        for (let i = 0; i <= naive.length; i += 1) {
          expect(index.offsetOf(i)).to.equal(sum);
          if (i < naive.length) sum += naive[i]!;
        }
        expect(index.total).to.equal(sum);
        if (naive.length === 0) {
          expect(index.indexAt(5)).to.equal(-1);
          return;
        }
        for (const probe of [0, 1, sum / 3, sum - 1, sum, sum + 100, -4, Number.NaN]) {
          const target = Number.isFinite(probe) ? Math.max(0, probe) : 0;
          let expected = 0;
          let running = 0;
          for (let i = 0; i < naive.length; i += 1) {
            if (running + naive[i]! <= target) { running += naive[i]!; expected = i + 1; } else break;
          }
          expect(index.indexAt(probe)).to.equal(Math.min(expected, naive.length - 1));
        }
      }
    ), propertyRuns());
  });

  it('keeps heights through resize and gives new items the estimate', () => {
    const index = new MeasuredOffsetIndex(20, 3);
    index.set(1, 50);
    index.resize(5);
    expect(index.total).to.equal(20 + 50 + 20 + 20 + 20);
    index.resize(2);
    expect(index.total).to.equal(70);
  });
});
