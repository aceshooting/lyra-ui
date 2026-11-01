import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { createTimeIndex } from './time-index.js';

it('preserves every strictly increasing timestamp as its exact sample index', () => {
  fc.assert(fc.property(fc.uniqueArray(fc.integer({ min: -1000000, max: 1000000 }), { maxLength: 100 }), values => {
    const sorted = [...values].sort((a, b) => a - b);
    const index = createTimeIndex(sorted);
    sorted.forEach((instant, position) => {
      expect(index.locate(instant)).to.deep.equal({ lowerIndex: position, upperIndex: position, nearestIndex: position, fraction: 0 });
    });
  }), propertyRuns());
});
