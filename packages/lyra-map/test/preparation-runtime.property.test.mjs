import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createPreparationRuntime } from '../scripts/preparation-runtime.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const { snapshotStyle } = createPreparationRuntime({});
function objectGraph(value, result = new Set()) {
  if (!value || typeof value !== 'object' || result.has(value)) return result;
  result.add(value);
  for (const child of Object.values(value)) objectGraph(child, result);
  return result;
}

test('full style snapshots retain plain data without sharing any object identity', () => {
  fc.assert(fc.property(fc.json().map(JSON.parse), value => {
    const original = objectGraph(value);
    const snapshot = snapshotStyle(value);
    assert.deepEqual(snapshot, JSON.parse(JSON.stringify(value)));
    for (const object of objectGraph(snapshot)) assert.equal(original.has(object), false);
    assert.deepEqual(snapshotStyle(snapshot), snapshot);
  }), runs);
});

test('hostile own record names remain data without changing snapshot prototypes', () => {
  fc.assert(fc.property(fc.json().map(JSON.parse), value => {
    const original = Object.fromEntries(['__proto__', 'constructor', 'prototype'].map(key => [key, value]));
    const snapshot = snapshotStyle(original);
    assert.equal(Object.getPrototypeOf(snapshot), Object.prototype);
    for (const key of Object.keys(original)) {
      assert.equal(Object.hasOwn(snapshot, key), true);
      assert.deepEqual(snapshot[key], JSON.parse(JSON.stringify(value)));
    }
    const graph = objectGraph(original);
    for (const object of objectGraph(snapshot)) assert.equal(graph.has(object), false);
  }), runs);
});
