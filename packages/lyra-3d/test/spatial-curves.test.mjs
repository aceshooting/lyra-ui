import assert from 'node:assert/strict';
import test from 'node:test';
import * as paths from '../dist/graph/spatial-paths.js';

const viewport = { style: { pointSize: 20 }, project: () => ({ scale: 1 }) };
const fixture = (curvature, extra = {}) => ({ nodeCount: 2, source: new Uint32Array([0]), target: new Uint32Array([1]), spatialAppearance: { sizeUnits: 'world', edgeCurvatures: new Float32Array([curvature]) }, ...extra });
const endpoints = [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }];
const sample = (data, t, points = endpoints) => paths.spatialEdgePoint(data, 0, t, (row) => points[row], viewport);

test('curves follow signed world-space midpoint and reversed endpoint convention', () => {
  assert.deepEqual(sample(fixture(0.5), 0), endpoints[0]);
  assert.deepEqual(sample(fixture(0.5), 1), endpoints[1]);
  assert.deepEqual(sample(fixture(0.5), 0.5), { x: 50, y: 0, z: 50 });
  assert.deepEqual(sample(fixture(0.5), 0.25), { x: 25, y: 0, z: 37.5 });
  assert.deepEqual(sample(fixture(-0.5), 0.5), { x: 50, y: 0, z: -50 });
  assert.deepEqual(sample(fixture(0.5), 0.5, [...endpoints].reverse()), { x: 50, y: 0, z: -50 });
  assert.deepEqual(sample(fixture(0), 0.5), { x: 50, y: 0, z: 0 });
  assert.deepEqual(sample({ ...fixture(0), spatialAppearance: {} }, 0.5), { x: 50, y: 0, z: 0 });
});

test('curve reservation depends on topology even while distinct endpoints coincide', () => {
  const data = fixture(0.5, { directed: new Uint8Array([1]) });
  assert.equal(paths.spatialEdgeSegments(data, 0), 16);
  assert.equal(paths.spatialPrimitiveCount(data), 17);
  assert.deepEqual(sample(data, 0.5, [endpoints[0], endpoints[0]]), endpoints[0]);
  assert.equal(paths.spatialEdgeSegments(data, 0), 16);
  const count = 117648;
  assert.throws(() => paths.spatialPrimitiveCount({ ...data, source: new Uint32Array(count), target: new Uint32Array(count).fill(1), directed: new Uint8Array(count).fill(1), spatialAppearance: { edgeCurvatures: new Float32Array(count).fill(0.5) } }), /primitive limit/);
});

test('loop and dangling samples ignore curvature', () => {
  const loop = fixture(1, { target: new Uint32Array([0]) });
  const expected = sample({ ...loop, spatialAppearance: { sizeUnits: 'world' } }, 0.25);
  assert.deepEqual(sample(loop, 0.25), expected);
  const dangling = fixture(1); dangling.spatialAppearance.dangling = new Uint8Array([1]);
  assert.equal(paths.spatialEdgeSegments(dangling, 0), 1);
  assert.deepEqual(sample(dangling, 0.5), { x: 14, y: -14, z: 0 });
});

test('analytic curve extrema include unsampled interior roots and preserve derived world extent', () => {
  assert.equal(typeof paths.spatialCurveExtrema, 'function');
  const a = { x: 0, y: 0, z: 1e7 }, b = { x: 100, y: 0, z: 1e7 };
  const extrema = paths.spatialCurveExtrema(a, b, 1);
  assert.ok(extrema.some((point) => point.x === 50 && point.z === 1e7 + 100));
  assert.ok(extrema.every((point) => Object.values(point).every(Number.isFinite)));
  const diagonal = paths.spatialCurveExtrema({ x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 100 }, 0.5);
  // Equal direction components choose X; cross(D,X) bows toward positive Y, negative Z.
  assert.ok(diagonal.some((point) => point.y > 100));
  assert.ok(diagonal.some((point) => point.z < 0));
  const peakY = diagonal.find((point) => point.y > 100);
  const root = peakY.x / 100;
  assert.ok(Math.abs(root * 16 - Math.round(root * 16)) > 0.001, 'the analytic extremum is between reserved stroke vertices');
  const huge = sample(fixture(1), 0.5, [{ x: -1e7, y: 0, z: 1e7 }, { x: 1e7, y: 0, z: 1e7 }]);
  assert.ok(Object.values(huge).every(Number.isFinite));
  assert.ok(huge.z > 1e7, 'derived curves are not clamped to node-coordinate limits');
});
