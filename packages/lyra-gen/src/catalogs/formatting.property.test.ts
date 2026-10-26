import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { formatTableValue } from './formatting.js';

test('numeric-looking text always retains its exact raw representation', () => {
  fc.assert(fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), value => {
    const raw = String(value);
    for (const locale of ['en', 'fr', 'ar']) assert.equal(formatTableValue(raw, { kind: 'number' }, locale), raw);
  }), propertyRuns());
});
