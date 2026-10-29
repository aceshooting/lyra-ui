import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Matrix4 } from 'three';
import { deriveModelLighting } from '../dist/map/camera-lighting.js';

const radius = 6371008.8;
function perspective(eye, change = {}) {
  const projection = new Matrix4().makePerspective(-0.7, 1.1, 0.9, -0.6, 1, 100000);
  const affine = new Matrix4().makeRotationFromEuler(new Euler(0.3, -0.2, 0.1))
    .multiply(new Matrix4().makeScale(1 / 8192, -1 / 8192, 1 / 1000))
    .multiply(new Matrix4().makeTranslation(-eye[0], -eye[1], -eye[2]));
  return { nativeProjectionFamily: 'mercator', transition: 0,
    tile: { z: 0, x: 0, y: 0, wrap: 0 }, fallbackMatrix: projection.multiply(affine).elements,
    clippingPlane: [0, 0, 1, -1 / 3], anchor: { lngLat: [0, 0], altitude: 1000 }, ...change };
}
const near = (actual, expected, tolerance = 1e-5) => {
  assert.equal(actual.length, 3);
  actual.forEach((value, index) => assert.ok(Number.isFinite(value) && Math.abs(value - expected[index]) < tolerance,
    `${actual} differs from ${expected}`));
};

test('perspective inverse recovers the authored eye with off-axis projection and full affine view', () => {
  const input = perspective([4096, 4096, 1100]);
  const original = structuredClone(input);
  const result = deriveModelLighting(input);
  near(result.eyeEnu, [0, 0, 100]);
  assert.equal(result.convention, 'mercator-eye');
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.eyeEnu));
  assert.deepEqual(input, original);
});

test('raised anchor subtraction applies once and every positive transition selects sphere eye', () => {
  const cameraRadius = 1 + 1100 / radius;
  for (const transition of [1e-8, 0.5, 1]) {
    const result = deriveModelLighting(perspective([4096, 4096, 9000], {
      nativeProjectionFamily: 'mercator-globe', transition, clippingPlane: [0, 0, 1, -1 / cameraRadius]
    }));
    near(result.eyeEnu, [0, 0, 100]); assert.equal(result.convention, 'sphere-eye');
  }
  near(deriveModelLighting(perspective([4096, 4096, 9000], { nativeProjectionFamily: 'mercator-globe' })).eyeEnu, [0, 0, 8000]);
});

test('tile copies and camera latitude beyond object coverage do not clamp the eye to a placement', () => {
  const latitude = 89, longitude = 12;
  const x = (longitude + 180) / 360;
  const y = (1 - Math.asinh(Math.tan(latitude * Math.PI / 180)) / Math.PI) / 2;
  const tile = { z: 2, x: 2, y: 0, wrap: 1 };
  const eye = [(x * 4 - tile.x) * 8192, y * 4 * 8192, 5000];
  const input = perspective(eye, { tile, anchor: { lngLat: [longitude, 0], altitude: 0 } });
  const result = deriveModelLighting(input);
  near(result.eyeEnu, [0, (radius + 5000) * Math.sin(latitude * Math.PI / 180),
    (radius + 5000) * Math.cos(latitude * Math.PI / 180) - radius], 0.01);
});

test('unusable inverse and unsupported native provenance reject without classifying arbitrary CRS by residual', () => {
  for (const change of [{ nativeProjectionFamily: 'custom' }, { transition: 0.5 },
    { fallbackMatrix: new Array(16).fill(0) }, { fallbackMatrix: [...new Matrix4().elements] },
    { fallbackMatrix: new Array(16).fill(Infinity) }, { transition: NaN }]) {
    assert.throws(() => deriveModelLighting(perspective([4096, 4096, 1100], change)));
  }
  let reads = 0; const input = perspective([4096, 4096, 1100]);
  Object.defineProperty(input, 'fallbackMatrix', { get() { reads++; return []; } });
  assert.throws(() => deriveModelLighting(input)); assert.equal(reads, 0);
});
