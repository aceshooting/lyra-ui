import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectionSnapshot, projectScenePosition, sphereOccludesPosition } from '../src/scene/projection.mjs';

const flat = [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 1 / 1000, 0, -1, 1, 0, 1];
const globe = [0.2, 0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0.2, 0, 0, 0, 0, 1];
const input = (transition = 0) => ({ tile: { z: 0, x: 0, y: 0, wrap: 0 }, mainMatrix: [...globe],
  fallbackMatrix: [...flat], clippingPlane: [0, 0, 1, -1 / 3], projectionTransition: transition, width: 200, height: 100 });
const at = (longitude, latitude, altitude = 0) => ({ lngLat: [longitude, latitude], altitude });
const near = (actual, expected) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Number.isFinite(value) && Math.abs(value - expected[index]) < 1e-8));
};

test('projection snapshots own immutable native numeric inputs and leave visible depth unresolved', () => {
  const source = input();
  const snapshot = createProjectionSnapshot(source);
  source.fallbackMatrix.fill(0); source.tile.x = 1;
  const result = projectScenePosition(at(0, 0), snapshot);
  near(result.clip, [0, 0, 0, 1]); near(result.point, [100, 50]);
  assert.equal(result.status, 'visibility-pending');
  assert.equal(result.visible, false);
  assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.fallbackMatrix) && Object.isFrozen(snapshot.tile));
});

test('midpoint interpolates homogeneous geographic coordinates before perspective division', () => {
  const source = input(0.5); source.mainMatrix[15] = 2;
  const result = projectScenePosition(at(0, 0, 100), createProjectionSnapshot(source));
  const radius = 1 + 100 / 6371008.8;
  near(result.clip, [0, 0, (radius * 0.2 + 0.1) / 2, 1.5]);
  near(result.point, [100, 50]);
});

test('homogeneous clipping precedes visibility and sphere convention applies to every nonzero transition', () => {
  assert.equal(projectScenePosition(at(0, 0, 2000), createProjectionSnapshot(input())).status, 'clipped');
  for (const transition of [0.001, 0.5, 1]) {
    const frame = createProjectionSnapshot(input(transition));
    assert.equal(projectScenePosition(at(100, 0), frame).status, 'occluded');
    assert.equal(projectScenePosition(at(0, 0), frame).status, 'visibility-pending');
  }
  assert.equal(projectScenePosition(at(100, 0), createProjectionSnapshot(input())).status, 'visibility-pending');
});

test('sphere occlusion rejects ground beyond the horizon but retains raised far-side positions', () => {
  const camera = [0, 0, 3];
  assert.equal(sphereOccludesPosition(at(0, 0), camera), false);
  assert.equal(sphereOccludesPosition(at(100, 0), camera), true);
  assert.equal(sphereOccludesPosition(at(100, 0, 100000000), camera), false);
});

test('distant finite cameras retain the nearby sphere endpoint when testing occlusion', () => {
  for (const distance of [1e10, 1e20, 1e100]) {
    assert.equal(sphereOccludesPosition(at(0, 0), [0, 0, distance]), false);
    assert.equal(sphereOccludesPosition(at(180, 0), [0, 0, distance]), true);
  }
});

test('invalid and accessor native inputs reject without evaluation or partial snapshots', () => {
  for (const change of [{ width: 0 }, { height: Infinity }, { projectionTransition: -0.1 },
    { projectionTransition: 1.1 }, { mainMatrix: [1, 2] }, { tile: { z: 1, x: 2, y: 0, wrap: 0 } },
    { fallbackMatrix: [...flat.slice(0, 15), NaN] }]) assert.throws(() => createProjectionSnapshot({ ...input(), ...change }));
  let reads = 0; const source = input();
  Object.defineProperty(source, 'mainMatrix', { get() { reads++; return globe; } });
  assert.throws(() => createProjectionSnapshot(source)); assert.equal(reads, 0);
  assert.throws(() => sphereOccludesPosition(at(0, 0), [0, 0, 0.5]));
  assert.throws(() => projectScenePosition({ ...at(0, 0), altitudeReference: 'terrain' }, createProjectionSnapshot(input())));
});
