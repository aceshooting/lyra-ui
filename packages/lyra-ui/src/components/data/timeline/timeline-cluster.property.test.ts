import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { timeValueChanged } from './timeline-cluster.js';

const instant = fc.integer({ min: -8.64e12, max: 8.64e12 });
const other = fc.oneof(fc.string({ maxLength: 4 }), fc.integer(), fc.constant(undefined), fc.constant(null), fc.double());

describe('timeline timestamp change detection properties', () => {
  it('treats a re-created equal Date as no change and different instants as a change', () => {
    fc.assert(fc.property(instant, instant, (a, b) => {
      expect(timeValueChanged(new Date(a), new Date(a)), 'equal instants').to.equal(false);
      expect(timeValueChanged(new Date(a), new Date(b)), 'instants differ').to.equal(a !== b);
    }), propertyRuns());
  });

  it('treats two invalid dates as unchanged', () => {
    expect(timeValueChanged(new Date(Number.NaN), new Date(Number.NaN))).to.equal(false);
  });

  it('is symmetric and irreflexive for arbitrary values', () => {
    fc.assert(fc.property(other, other, (a, b) => {
      expect(timeValueChanged(a, a), 'a value never differs from itself').to.equal(false);
      expect(timeValueChanged(a, b), 'symmetric').to.equal(timeValueChanged(b, a));
    }), propertyRuns());
  });

  it('reports a Date against a non-Date as a change', () => {
    fc.assert(fc.property(instant, other, (a, value) => {
      expect(timeValueChanged(new Date(a), value)).to.equal(true);
    }), propertyRuns());
  });
});
