import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EARTH_RADIUS_METERS, geographicToTile, geographicFromEnu, interpolateGeographic
} from '../src/scene/geographic.mjs';

const root = { z: 0, x: 0, y: 0, wrap: 0 };
const position = (lng, lat, altitude = 0) => ({ lngLat: [lng, lat], altitude });
const near = (actual, expected, tolerance = 1e-8) => assert.ok(
  Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`
);

test('tile coordinates use extent 8192 and latitude-independent meter altitude', () => {
  assert.equal(EARTH_RADIUS_METERS, 6371008.8);
  assert.deepEqual(geographicToTile(position(0, 0, 1234), root), [4096, 4096, 1234]);
  for (const lat of [-80, -45, 0, 45, 80]) {
    assert.equal(geographicToTile(position(10, lat, 1234), root)[2], 1234);
  }
  assert.deepEqual(geographicToTile(position(0, 0), { z: 1, x: 1, y: 1, wrap: 0 }), [0, 0, 0]);
});

test('ENU axes preserve local rigid geometry on the sphere', () => {
  const origin = position(0, 0, 100);
  const east = geographicFromEnu(origin, [1000, 0, 0]);
  const north = geographicFromEnu(origin, [0, 1000, 0]);
  const up = geographicFromEnu(origin, [0, 0, 1000]);
  assert.ok(east.lngLat[0] > 0);
  near(east.lngLat[1], 0);
  assert.ok(north.lngLat[1] > 0);
  near(north.lngLat[0], 0);
  near(up.lngLat[0], 0);
  near(up.lngLat[1], 0);
  near(up.altitude, 1100);
  near(east.altitude, Math.hypot(EARTH_RADIUS_METERS + 100, 1000) - EARTH_RADIUS_METERS);
  assert.deepEqual(geographicFromEnu(origin, [0, 0, 0]), origin);
});

test('interpolation crosses the antimeridian by the shortest route with meter altitude', () => {
  for (const mode of ['linear', 'great-circle']) {
    const middle = interpolateGeographic(position(179, 0, 100), position(-179, 0, 300), 0.5, { mode });
    near(middle.lngLat[0], -180);
    near(middle.lngLat[1], 0);
    near(middle.altitude, 200);
  }
  const middle = interpolateGeographic(position(-45, 60), position(45, 60), 0.5);
  assert.ok(middle.lngLat[1] > 60, 'default great-circle route bends toward the pole');
});

test('great-circle interpolation refuses ambiguous antipodal endpoints', () => {
  assert.throws(() => interpolateGeographic(position(0, 0), position(180, 0), 0.5));
  assert.throws(() => interpolateGeographic(position(0, 20), position(180, -20), 0.5));
  assert.throws(() => interpolateGeographic(position(0, 0), position(180 - 1e-10, 0), 0.5));
});

test('invalid geographic coordinates, altitude, tiles and interpolation are rejected', () => {
  for (const value of [position(NaN, 0), position(0, Infinity), position(0, 86),
    position(0, -86), position(0, 0, NaN), position(0, 0, -12001), position(0, 0, 100000001)]) {
    assert.throws(() => geographicToTile(value, root));
    assert.throws(() => geographicFromEnu(value, [0, 0, 0]));
    assert.throws(() => interpolateGeographic(value, position(0, 0), 0.5));
  }
  for (const tile of [{ ...root, z: -1 }, { ...root, z: 0.5 }, { ...root, x: 1 },
    { ...root, y: -1 }, { ...root, wrap: Infinity }]) {
    assert.throws(() => geographicToTile(position(0, 0), tile));
  }
  for (const t of [-0.1, 1.1, NaN, Infinity]) {
    assert.throws(() => interpolateGeographic(position(0, 0), position(1, 1), t));
  }
  assert.throws(() => geographicFromEnu(position(0, 0), [NaN, 0, 0]));
  assert.throws(() => interpolateGeographic(position(0, 0), position(1, 1), 0.5, { mode: 'other' }));
});

test('geometry admission rejects accessors without evaluating caller code', () => {
  let reads = 0;
  const getter = () => { reads++; return 0; };
  const accessorPosition = { altitude: 0 };
  Object.defineProperty(accessorPosition, 'lngLat', { get: getter });
  assert.throws(() => geographicToTile(accessorPosition, root));
  const coordinates = [0, 0];
  Object.defineProperty(coordinates, '0', { get: getter });
  assert.throws(() => geographicFromEnu({ lngLat: coordinates }, [0, 0, 0]));
  const tile = { ...root };
  Object.defineProperty(tile, 'x', { get: getter });
  assert.throws(() => geographicToTile(position(0, 0), tile));
  const options = {};
  Object.defineProperty(options, 'mode', { get: getter });
  assert.throws(() => interpolateGeographic(position(0, 0), position(1, 1), 0.5, options));
  assert.equal(reads, 0);
  assert.throws(() => geographicToTile(Object.create(position(0, 0)), root));
});
