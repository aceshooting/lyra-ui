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
          expect(index.indexBefore(5)).to.equal(-1);
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
          const firstExcluded = naive.findIndex((_, i) => index.offsetOf(i) >= target);
          const expectedBefore = firstExcluded === -1 ? naive.length - 1 : Math.max(0, firstExcluded - 1);
          expect(index.indexBefore(probe)).to.equal(expectedBefore);
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

  it('appends incrementally with the same offsets as a full reset', () => {
    fc.assert(fc.property(
      fc.array(fc.array(fc.integer({ min: 1, max: 300 }), { maxLength: 12 }), { maxLength: 8 }),
      (batches) => {
        const incremental = new MeasuredOffsetIndex(10);
        for (const batch of batches) incremental.append(batch);
        const all = batches.flat();
        const full = new MeasuredOffsetIndex(10);
        full.reset(all, 10);
        for (let i = 0; i <= all.length; i += 1) expect(incremental.offsetOf(i)).to.equal(full.offsetOf(i));
        expect(incremental.length).to.equal(all.length);
      }
    ), propertyRuns());
  });

  it('resets copied or owned heights to the same clamped offsets as appending them', () => {
    fc.assert(fc.property(
      fc.array(fc.oneof(height, fc.integer({ min: -4, max: 6 }).map((half) => half / 2), fc.constant(-0)), { maxLength: 40 }),
      (heights) => {
        const input = [...heights];
        const copied = new MeasuredOffsetIndex(10, 0, { minimumHeight: 0 });
        copied.reset(input, 10);
        expect(input).to.deep.equal(heights);
        const owned = new MeasuredOffsetIndex(10, 0, { minimumHeight: 0 });
        owned.reset([...heights], 10, true);
        const appended = new MeasuredOffsetIndex(10, 0, { minimumHeight: 0 });
        appended.append(heights);
        for (let i = 0; i <= heights.length; i += 1) {
          expect(copied.offsetOf(i)).to.equal(appended.offsetOf(i));
          expect(owned.offsetOf(i)).to.equal(appended.offsetOf(i));
          expect(Object.is(owned.heightAt(i), appended.heightAt(i))).to.equal(true);
        }
      }
    ), propertyRuns());
  });

  it('keeps subpixel and zero heights with a zero minimum', () => {
    const index = new MeasuredOffsetIndex(10, 0, { minimumHeight: 0 });
    index.append([0.5, 0, 2.25, Number.NaN]);
    expect([0, 1, 2, 3].map((i) => index.heightAt(i))).to.deep.equal([0.5, 0, 2.25, 10]);
    expect(index.total).to.equal(12.75);
    expect(index.indexAt(0.5)).to.equal(2);
    expect(index.indexBefore(0.5)).to.equal(0);
    expect(index.indexBefore(0.75)).to.equal(2);
    expect(index.indexBefore(2.75)).to.equal(2);
    index.set(2, -4);
    expect(index.heightAt(2)).to.equal(0);
    const defaults = new MeasuredOffsetIndex(10, 2);
    defaults.set(0, 0);
    expect(defaults.heightAt(0)).to.equal(1);
  });

  it('saturates reported offsets at the maximum and recovers when a huge height shrinks', () => {
    const index = new MeasuredOffsetIndex(10, 3, { maximumTotal: Number.MAX_VALUE });
    index.set(1, Number.MAX_VALUE);
    index.set(2, Number.MAX_VALUE);
    expect(index.total).to.equal(Number.MAX_VALUE);
    expect(index.offsetOf(1)).to.equal(10);
    index.append([Number.MAX_VALUE]);
    expect(index.total).to.equal(Number.MAX_VALUE);
    index.set(1, 5);
    index.set(2, 6);
    index.set(3, 7);
    expect(index.total).to.equal(28);
    expect(index.indexAt(16)).to.equal(2);
    const safe = new MeasuredOffsetIndex(1, 2);
    safe.set(0, Number.MAX_SAFE_INTEGER);
    safe.set(1, Number.MAX_SAFE_INTEGER);
    expect(safe.total).to.equal(Number.MAX_SAFE_INTEGER);
    safe.set(0, 3);
    expect(safe.total).to.equal(Number.MAX_SAFE_INTEGER);
    safe.set(1, 4);
    expect(safe.total).to.equal(7);
  });
});
