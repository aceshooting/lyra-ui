import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { parseJson, snapshotJson, validateSchema } from './schema.js';

test('bounded plain JSON snapshots round-trip and do not mutate input', () => {
  fc.assert(fc.property(fc.jsonValue(), input => {
    const before = JSON.stringify(input);
    const result = snapshotJson(input);
    assert.equal(JSON.stringify(input), before);
    if (result.ok) {
      assert.equal(JSON.stringify(result.value), before);
      const restored = parseJson(before);
      assert.equal(restored.ok, true);
      if (restored.ok) assert.deepEqual(restored.value, result.value);
    }
  }), propertyRuns());
});

test('schema integer range agrees with an independent numeric predicate', () => {
  fc.assert(fc.property(fc.oneof(fc.integer(), fc.double(), fc.string(), fc.boolean()), value => {
    const result = validateSchema(value, { type: 'integer', minimum: -12, maximum: 30 });
    const expected = typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= -12 && value <= 30;
    assert.equal(result.ok, expected);
  }), propertyRuns());
});

test('arbitrary source text returns a bounded result without throwing', () => {
  fc.assert(fc.property(fc.string(), source => {
    const result = parseJson(source, { maxBytes: 500, maxDepth: 8, maxNodes: 50 });
    assert.ok(result.ok || result.diagnostics.length > 0);
  }), propertyRuns());
});
