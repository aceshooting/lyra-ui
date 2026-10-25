import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotFeatureRequirements } from '../scripts/feature-requirements.mjs';

test('feature metadata rejects malformed records and containers while preserving explicit undefined fields', () => {
  for (const sources of [[{ type: 'geojson' }], 'invalid', 7]) {
    assert.throws(() => snapshotFeatureRequirements({ sources }), TypeError);
  }
  for (const layers of [{ 0: { id: 'dots', type: 'circle' }, length: 1 }, {}, false]) {
    assert.throws(() => snapshotFeatureRequirements({ layers }), TypeError);
  }
  for (const metadata of [null, true, 7, 'geojson', []]) {
    assert.throws(() => snapshotFeatureRequirements({ sources: { points: metadata } }), TypeError);
    assert.throws(() => snapshotFeatureRequirements({ layers: [metadata] }), TypeError);
    if (metadata !== null) assert.throws(() => snapshotFeatureRequirements({ projection: metadata }), TypeError);
  }
  for (const requirements of [
    { sources: { points: { type: 7 } } },
    { layers: [{ id: 7 }] },
    { layers: [{ ref: 7 }] },
    { layers: [{ type: 7 }] },
    { projection: { type: 7 } },
  ]) assert.throws(() => snapshotFeatureRequirements(requirements), TypeError);

  assert.deepEqual(snapshotFeatureRequirements({
    sources: { points: { type: undefined } },
    layers: [{ id: undefined, ref: undefined, type: undefined }],
    projection: { type: undefined },
  }), {
    version: 8,
    sources: { points: { type: undefined } },
    layers: [{ id: undefined, ref: undefined, type: undefined }],
    projection: { type: undefined },
  });
});

test('only own enumerable top-level fields and string source names participate in feature metadata', () => {
  let reads = 0;
  const discarded = () => { reads++; throw new Error('discarded metadata was read'); };
  const inherited = {};
  for (const name of ['sources', 'layers', 'projection', 'terrain']) {
    Object.defineProperty(inherited, name, { enumerable: true, get: discarded });
  }
  assert.deepEqual(snapshotFeatureRequirements(Object.create(inherited)), { version: 8, sources: {}, layers: [] });

  const sources = { points: { type: 'geojson' } };
  Object.defineProperty(sources, 'hidden', { get: discarded });
  Object.defineProperty(sources, Symbol('ignored source'), { enumerable: true, get: discarded });
  const requirements = { sources };
  Object.defineProperty(requirements, 'layers', { get: discarded });
  assert.deepEqual(snapshotFeatureRequirements(requirements), {
    version: 8, sources: { points: { type: 'geojson' } }, layers: [],
  });
  assert.equal(reads, 0);
});

test('sparse layer metadata preserves trailing holes and stops before inherited entries beyond its length', () => {
  let reads = 0;
  const layers = new Array(3);
  layers[1] = { id: 'dots', type: 'circle', paint: { 'circle-radius': 4 } };
  Object.setPrototypeOf(layers, Object.create(Array.prototype, {
    3: { get() { reads++; throw new Error('out-of-bounds layer was read'); } },
  }));
  const projected = snapshotFeatureRequirements({ layers });
  const expected = new Array(3);
  expected[1] = { id: 'dots', type: 'circle' };
  assert.deepEqual(projected, { version: 8, sources: {}, layers: expected });
  assert.equal(Object.hasOwn(projected.layers, 0), false);
  assert.equal(Object.hasOwn(projected.layers, 2), false);
  assert.equal(reads, 0);
});
