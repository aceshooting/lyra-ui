import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { escapePointerSegment, isSafeKey } from './schema.js';
import { parsePointer, readPointer } from './references.js';
import type { JsonValue } from './types.js';

test('escaping arbitrary safe key segments round trips without changing the address', () => {
  fc.assert(fc.property(fc.array(fc.string({ maxLength: 32 }).filter(isSafeKey), { maxLength: 12 }), segments => {
    const pointer = segments.map(segment => `/${escapePointerSegment(segment)}`).join('');
    const parsed = parsePointer(pointer);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.deepEqual(parsed.value, segments);
  }), { seed: 1729, numRuns: 200 });
});

test('reading any present object key returns exactly its independently generated JSON value', () => {
  fc.assert(fc.property(fc.string({ maxLength: 32 }).filter(isSafeKey), fc.jsonValue(), (key, value) => {
    const result = readPointer({ [key]: value as JsonValue }, `/${escapePointerSegment(key)}`);
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.value, value);
  }), { seed: 1729, numRuns: 200 });
});
