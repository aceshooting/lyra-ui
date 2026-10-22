import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ORBIT_CAMERA, boundsOfPositions, interpolateOrbit } from '../dist/core/orbit.js';
import { parseCssColor } from '../dist/core/style.js';
import { transferablesOf } from '../dist/core/worker.js';

test('bounds skip rows with missing or non-finite coordinates and report nothing for an empty set', () => {
  assert.equal(boundsOfPositions({ length: 6 }), null, 'a sparse array has no rows');
  assert.equal(boundsOfPositions([]), null);
  assert.equal(boundsOfPositions([Number.NaN, 0, 0, 0, Number.POSITIVE_INFINITY, 0]), null);
  assert.deepEqual(boundsOfPositions({ length: 6, 0: 1, 1: 2, 2: 3, 3: 9 }), { min: { x: 1, y: 2, z: 3 }, max: { x: 1, y: 2, z: 3 } }, 'the incomplete second row is ignored');
  const mixed = boundsOfPositions([0, 0, 0, Number.NaN, 1, 1, 4, -2, 6]);
  assert.deepEqual(mixed, { min: { x: 0, y: -2, z: 0 }, max: { x: 4, y: 0, z: 6 } });
});

test('orbit interpolation returns its endpoints for a settled parameter and turns the short way round', () => {
  const from = { ...DEFAULT_ORBIT_CAMERA, yaw: 0 };
  const to = { ...DEFAULT_ORBIT_CAMERA, yaw: 3.5, distance: 1000 };
  assert.equal(interpolateOrbit(from, to, 0), from);
  assert.equal(interpolateOrbit(from, to, -4), from, 'the parameter is clamped');
  assert.equal(interpolateOrbit(from, to, 1), to);
  assert.equal(interpolateOrbit(from, to, 4), to);
  assert.equal(interpolateOrbit(from, to, Number.NaN), to, 'an unusable parameter completes the move');
  const half = interpolateOrbit(from, to, 0.5);
  assert.ok(Math.abs(half.yaw - (3.5 - Math.PI * 2) / 2) < 1e-12, `3.5 rad is reached through -2.78 rad, got ${half.yaw}`);
  assert.ok(Math.abs(half.distance - Math.sqrt(500 * 1000)) < 1e-9, 'distances blend geometrically');
  const back = interpolateOrbit({ ...DEFAULT_ORBIT_CAMERA, yaw: 0 }, { ...DEFAULT_ORBIT_CAMERA, yaw: -3.5 }, 0.5);
  assert.ok(Math.abs(back.yaw - (Math.PI * 2 - 3.5) / 2) < 1e-12);
});

test('functional colors need exactly three channels and an optional alpha', () => {
  for (const value of ['rgb(1, 2)', 'rgb(1, 2, 3, 4, 5)', 'rgb(1 2 3 / 0.5 / 1)', 'rgb()', 'rgb(1 2)', 'color(srgb 1 1)']) {
    assert.equal(parseCssColor(value), null, value);
  }
  assert.deepEqual(parseCssColor('rgb(255 0 0 / 50%)'), { r: 1, g: 0, b: 0, a: 0.5 });
});

test('buffers are collected from raw ArrayBuffer outputs and from objects holding them', () => {
  const buffer = new ArrayBuffer(8);
  assert.deepEqual(transferablesOf(buffer), [buffer]);
  assert.deepEqual(transferablesOf({ raw: buffer, view: new Uint8Array(buffer), nested: { skipped: new Float32Array(1) } }), [buffer]);
  const shared = new SharedArrayBuffer(8);
  assert.deepEqual(transferablesOf(new Uint8Array(shared)), [], 'shared memory is never transferred');
  assert.deepEqual(transferablesOf(null), []);
});
