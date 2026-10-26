import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { snapshotA2uiData } from './a2ui-state.js';

test('protocol projection agrees with native JSON serialization while retaining undefined slots', () => {
  fc.assert(fc.property(fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)), { maxLength: 30 }), values => {
    const result = snapshotA2uiData(values);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.json, JSON.parse(JSON.stringify(values)));
    assert.deepEqual(result.value.data, values);
  }), propertyRuns());
});
