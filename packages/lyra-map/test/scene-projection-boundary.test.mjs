import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectionSnapshot, projectScenePosition } from '../src/scene/projection.mjs';

const input = projectionTransition => ({ tile: { z: 0, x: 0, y: 0, wrap: 0 },
  mainMatrix: [0.2, 0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0.2, 0, 0, 0, 0, 1],
  fallbackMatrix: [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 0.001, 0, -1, 1, 0, 1],
  clippingPlane: [0, 0, 1, -1 / 3], projectionTransition, width: 200, height: 100 });
const at = latitude => ({ lngLat: [0, latitude], altitude: 0 });

test('the native three-dimensional projection snaps only above its Float32 threshold', () => {
  for (const transition of [0.999, 0.999 + 1e-12, 0.9995, 1]) {
    const actual = projectScenePosition(at(0), createProjectionSnapshot(input(transition)));
    const uploaded = Math.fround(transition);
    const expected = uploaded > Math.fround(0.999) ? 0.2 : 0.2 * uploaded;
    assert.ok(Math.abs(actual.clip[2] - expected) < 1e-10, `Native branch mismatch at ${transition}`);
  }
});

test('projection refuses local y that the native globe shader interprets as a pole', () => {
  const source = input(0.5);
  source.tile = { z: 6, x: 32, y: 0, wrap: 0 };
  const north = createProjectionSnapshot(source);
  assert.throws(() => projectScenePosition(at(-80), north));
  source.tile.y = 63;
  const south = createProjectionSnapshot(source);
  assert.throws(() => projectScenePosition(at(80), south));
});

test('native-safe local y is checked after Float32 rounding at both sentinel boundaries', () => {
  const tile = { z: 5, x: 16, y: 16, wrap: 0 };
  const latitudeFor = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * (tile.y + y / 8192) / 2 ** tile.z))) * 180 / Math.PI;
  for (const localY of [-32767.5, 32766.5]) {
    const source = { ...input(0.5), tile };
    assert.doesNotThrow(() => projectScenePosition(at(latitudeFor(localY)), createProjectionSnapshot(source)));
  }
  for (const localY of [-32767.51, 32766.51]) {
    const snapshot = createProjectionSnapshot({ ...input(0.5), tile });
    assert.throws(() => projectScenePosition(at(latitudeFor(localY)), snapshot));
  }
});
