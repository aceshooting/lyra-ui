import assert from 'node:assert/strict';
import test from 'node:test';
import { admitGraphSpatialAppearance } from '../dist/graph/spatial-appearance.js';

test('spatial appearance admission copies bounded typed columns atomically', () => {
  const shapes = new Uint8Array([0, 2]); const rgba = new Float32Array([1, 0, 0, 0.5, 0, 1, 0, 1]);
  const input = { sizeUnits: 'world', nodeShapes: shapes, nodeColors: rgba, edgeWidths: new Float32Array([2]), edgeDashes: [[4, 2]], dangling: new Uint8Array([1]), dimmedOpacity: 0.35 };
  const result = admitGraphSpatialAppearance(input, 2, 1); shapes[0] = 2; rgba[0] = 0; input.edgeDashes[0][0] = 9;
  assert.equal(result.nodeShapes[0], 0); assert.equal(result.nodeColors[0], 1); assert.deepEqual(result.edgeDashes, [[4, 2]]);
  assert.equal(result.sizeUnits, 'world'); assert.equal(result.dimmedOpacity, 0.35);
});

test('invalid appearance fields fail without mutating a prior admission', () => {
  const prior = admitGraphSpatialAppearance({}, 2, 1);
  for (const input of [{ nodeShapes: new Uint8Array([0, 3]) }, { edgeWidths: new Float32Array([NaN]) }, { edgeWidths: new Float32Array([1001]) }, { nodeColors: new Float32Array(8).fill(2) }, { expandable: new Uint8Array([2, 0]) }, { dangling: new Uint8Array(2) }, { sizeUnits: 'other' }, { edgeDashes: [Array(33).fill(1)] }, { edgeDashes: [[-1, 2]] }, { dimmedOpacity: Infinity }]) assert.throws(() => admitGraphSpatialAppearance(input, 2, 1));
  assert.equal(prior.sizeUnits, 'css'); assert.equal(prior.dimmedOpacity, 0.35);
});

test('sparse dash patterns reject instead of uploading NaN', () => {
  assert.throws(() => admitGraphSpatialAppearance({ edgeDashes: [new Array(1)] }, 2, 1));
});
