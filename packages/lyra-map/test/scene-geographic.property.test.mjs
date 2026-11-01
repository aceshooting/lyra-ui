import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import {
  EARTH_RADIUS_METERS, geographicToTile, geographicFromEnu, interpolateGeographic
} from '../src/scene/geographic.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const scalar = (min, max) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true });
const positions = fc.record({
  lngLat: fc.tuple(scalar(-179, 179), scalar(-75, 75)), altitude: scalar(-1000, 100000)
});
const root = { z: 0, x: 0, y: 0, wrap: 0 };
const near = (actual, expected, tolerance) => assert.ok(
  Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`
);
function cartesian(position) {
  const [lng, lat] = position.lngLat.map(value => value * Math.PI / 180);
  const radius = EARTH_RADIUS_METERS + position.altitude;
  return [radius * Math.cos(lat) * Math.cos(lng), radius * Math.cos(lat) * Math.sin(lng), radius * Math.sin(lat)];
}

test('ENU conversion preserves the rigid Cartesian offset in an independent spherical oracle', () => {
  fc.assert(fc.property(positions, fc.tuple(scalar(-10000, 10000), scalar(-10000, 10000), scalar(-1000, 1000)), (origin, point) => {
    const [lng, lat] = origin.lngLat.map(value => value * Math.PI / 180);
    const [east, north, up] = point;
    const base = cartesian(origin);
    const expected = [
      base[0] - east * Math.sin(lng) - north * Math.sin(lat) * Math.cos(lng) + up * Math.cos(lat) * Math.cos(lng),
      base[1] + east * Math.cos(lng) - north * Math.sin(lat) * Math.sin(lng) + up * Math.cos(lat) * Math.sin(lng),
      base[2] + north * Math.cos(lat) + up * Math.sin(lat)
    ];
    const result = geographicFromEnu(origin, point);
    const actual = cartesian(result);
    for (let index = 0; index < 3; index++) near(actual[index], expected[index], 1e-6);
    assert.ok(result.lngLat[0] >= -180 && result.lngLat[0] < 180);
  }), runs);
});

test('tile encoding retains meter altitude and agrees with the inverse Mercator latitude', () => {
  fc.assert(fc.property(positions, value => {
    const [x, y, z] = geographicToTile(value, root);
    assert.equal(z, value.altitude);
    near(x / 8192 * 360 - 180, value.lngLat[0], 1e-10);
    near(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 8192))) * 180 / Math.PI, value.lngLat[1], 1e-10);
  }), runs);
});

test('interpolating identical endpoints is stable and never mutates caller data', () => {
  fc.assert(fc.property(positions, scalar(0, 1), (value, t) => {
    const before = Object.assign(Object.create(Object.getPrototypeOf(value)), structuredClone(value));
    for (const mode of ['linear', 'great-circle']) {
      const result = interpolateGeographic(value, value, t, { mode });
      near(result.lngLat[0], value.lngLat[0], 1e-8);
      near(result.lngLat[1], value.lngLat[1], 1e-8);
      near(result.altitude, value.altitude, 1e-8);
    }
    assert.deepEqual(value, before);
  }), runs);
});

test('great-circle reversal gives the same geographic route and linearly interpolated altitude', () => {
  const endpoints = fc.tuple(scalar(-120, 120), scalar(-60, 60), scalar(1, 30), scalar(-1000, 10000), scalar(-1000, 10000));
  fc.assert(fc.property(endpoints, scalar(0, 1), ([lng, lat, delta, a, b], t) => {
    const start = { lngLat: [lng, lat], altitude: a };
    const end = { lngLat: [lng + delta, lat], altitude: b };
    const forward = interpolateGeographic(start, end, t);
    const reverse = interpolateGeographic(end, start, 1 - t);
    near(forward.lngLat[0], reverse.lngLat[0], 1e-8);
    near(forward.lngLat[1], reverse.lngLat[1], 1e-8);
    near(forward.altitude, a + (b - a) * t, 1e-8);
  }), runs);
});
