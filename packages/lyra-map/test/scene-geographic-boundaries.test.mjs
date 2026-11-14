import assert from 'node:assert/strict';
import test from 'node:test';
import { EARTH_RADIUS_METERS, geographicFromEnu, geographicToTile } from '../src/scene/geographic.mjs';
import { createProjectionSnapshot } from '../src/scene/projection.mjs';

const root = { z: 0, x: 0, y: 0, wrap: 0 };
const geometry = { name: 'TypeError', message: 'Invalid geographic geometry.' };

test('geographic positions and tiles must be records with exact coordinate tuples', () => {
  for (const value of [null, undefined, 'position', 3]) assert.throws(() => geographicToTile(value, root), geometry);
  assert.throws(() => geographicToTile({ lngLat: [0, 0] }, null), geometry);
  for (const lngLat of ['0,0', { 0: 0, 1: 0, length: 2 }, [0], [0, 0, 0]]) {
    assert.throws(() => geographicToTile({ lngLat }, root), geometry);
  }
  for (const point of [[0, 0], [0, 0, 0, 0], 'enu']) {
    assert.throws(() => geographicFromEnu({ lngLat: [0, 0] }, point), geometry);
  }
});

test('rigid ENU offsets are bounded horizontally and vertically', () => {
  const origin = { lngLat: [0, 0], altitude: 0 };
  for (const point of [[100001, 0, 0], [0, -100001, 0], [70711, 70711, 0], [0, 0, 100000001], [0, 0, -100000001]]) {
    assert.throws(() => geographicFromEnu(origin, point), geometry);
  }
  const edge = geographicFromEnu(origin, [100000, 0, 0]);
  assert.ok(edge.lngLat[0] > 0.89 && edge.lngLat[0] < 0.9);
});

test('an offset that passes through the centre of the sphere is refused', () => {
  const origin = { lngLat: [10, 20], altitude: 0 };
  assert.throws(() => geographicFromEnu(origin, [0, 0, -EARTH_RADIUS_METERS]), geometry);
  assert.throws(() => geographicFromEnu(origin, [0, 0, -EARTH_RADIUS_METERS - 1]), geometry);
});

test('projection snapshots require a record input', () => {
  for (const value of [null, undefined, 'snapshot', 1]) {
    assert.throws(() => createProjectionSnapshot(value), { name: 'TypeError', message: 'Invalid geographic projection.' });
  }
});
