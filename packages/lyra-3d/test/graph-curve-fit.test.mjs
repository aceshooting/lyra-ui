import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphEngine } from '../dist/graph/engine.js';
import { boundsOfPositions, fitOrbitCamera } from '../dist/core/orbit.js';

const viewport = { width: 1, height: 1 };

test('derived fit saturates safely for finite bounds near the number limit', () => {
  const fit = bounds => fitOrbitCamera(bounds, viewport, 0, undefined, { preserveDerivedBounds: true });
  for (const bounds of [
    { min: { x: 1e308, y: 1e308, z: 1e308 }, max: { x: 1.7e308, y: 1.7e308, z: 1.7e308 } },
    { min: { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE, z: -Number.MAX_VALUE }, max: { x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE } },
  ]) {
    const result = fit(bounds);
    assert.ok(Number.isFinite(result.distance) && result.distance > 1e7);
    assert.ok(Object.values(result.target).every(value => Number.isFinite(value) && Math.abs(value) <= 1e7));
    assert.ok(result.distance * 4 < 3.5e38);
  }
});
function graph(positions, curvature) {
  const engine = createGraphEngine();
  engine.setData({ nodeCount: 2, positions: new Float32Array(positions), source: new Uint32Array([0]), target: new Uint32Array([1]),
    spatialAppearance: { edgeCurvatures: new Float32Array([curvature]) } }, 0);
  return engine;
}
function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12, `${actual} differs from ${expected}`);
}

test('curve fit encloses analytic extrema between the reserved sample parameters', () => {
  const positions = [0, 0, 0, 10, 20, 30];
  const engine = graph(positions, 1);
  try {
    const length = Math.hypot(10, 20, 30);
    const normalLength = Math.hypot(30, -20);
    const control = [5, 10 + 2 * length * 30 / normalLength, 15 - 2 * length * 20 / normalLength];
    const min = [0, 0, 0], max = [10, 20, 30];
    for (let axis = 0; axis < 3; axis++) {
      const end = positions[axis + 3];
      const t = control[axis] / (2 * control[axis] - end);
      if (t > 0 && t < 1) {
        const value = 2 * (1 - t) * t * control[axis] + t * t * end;
        min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
      }
    }
    const point = (values) => ({ x: values[0], y: values[1], z: values[2] });
    const expected = fitOrbitCamera({ min: point(min), max: point(max) }, viewport, 0);
    const actual = engine.fit(0);
    close(actual.target.y, expected.target.y); close(actual.target.z, expected.target.z); close(actual.distance, expected.distance);
  } finally { engine.dispose(); }
});

test('curve fit retains derived bounds beyond the node limit and encloses around the clamped target', () => {
  const engine = graph([-1e7, 0, 1e7, 1e7, 0, 1e7], 1);
  try {
    const actual = engine.fit(0);
    assert.deepEqual(actual.target, { x: 0, y: 0, z: 1e7 });
    close(actual.distance, Math.hypot(1e7, 2e7) / Math.sin(Math.PI / 8));
  } finally { engine.dispose(); }
});

test('zero curvature retains the exact node-bound camera including world node radii', () => {
  const positions = new Float32Array([-10, 2, -3, 10, 20, 30]);
  const engine = createGraphEngine();
  try {
    engine.setData({ nodeCount: 2, positions, source: new Uint32Array([0]), target: new Uint32Array([1]), sizes: new Float32Array([8, 12]), spatialAppearance: { sizeUnits: 'world', edgeCurvatures: new Float32Array([0]) } }, 0);
    assert.deepEqual(engine.fit(0), fitOrbitCamera(boundsOfPositions(positions, [4, 6]), viewport, 0));
  } finally { engine.dispose(); }
});
