import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { traceSourceSummary } from './hierarchy-summary-source.js';

describe('trace source summary properties', () => {
  it('preserves every finite ordered nonnegative extent without mutating its input', () => {
    const time = fc.double({ min: 0, max: Number.MAX_VALUE, noNaN: true });
    fc.assert(fc.property(time, time, (first, second) => {
      const value = Object.freeze({ startMs: Math.min(first, second), endMs: Math.max(first, second) });
      let checks = 0;
      const result = traceSourceSummary(value, () => { checks++; });
      expect(result.startMs === value.startMs && result.endMs === value.endMs).to.equal(true);
      expect(checks).to.equal(2);
      expect(Number.isFinite(result.endMs - result.startMs)).to.equal(true);
    }), propertyRuns());
  });

  it('rejects negative, reversed and nonfinite boundaries', () => {
    fc.assert(fc.property(fc.double({ min: 1, max: Number.MAX_VALUE, noNaN: true }), value => {
      for (const summary of [{ startMs: -value, endMs: value }, { startMs: value, endMs: 0 },
        { startMs: 0, endMs: Infinity }, { startMs: NaN, endMs: value }]) {
        expect(() => traceSourceSummary(summary, () => undefined)).to.throw(TypeError);
      }
    }), propertyRuns());
  });
});
