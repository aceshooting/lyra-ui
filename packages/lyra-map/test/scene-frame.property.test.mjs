import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createEpochGeographicServices, createGeographicFrameLease } from '../src/scene/frame.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const scalar = (min, max) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

test('nearby canonical origins keep local coordinates bounded and preserve meter height', () => {
  fc.assert(fc.property(scalar(-179, 179), scalar(-80, 80), scalar(-1000, 100000), fc.integer({ min: 0, max: 22 }),
    (longitude, latitude, altitude, tileZoom) => {
      const services = createEpochGeographicServices({ epoch: 1, isCurrent: () => true,
        layout: () => ({ revision: 1, tileZoom, centerLongitude: longitude }) });
      const position = { lngLat: [longitude, latitude], altitude };
      const origin = services.frameFor(position);
      const lease = createGeographicFrameLease({ epoch: 1, revision: 1, time: 0, width: 400, height: 300,
        pixelRatio: 1, reducedMotion: true, services, isCurrent: () => true,
        projectionFor() { throw new Error('Encoding must not require native projection.'); } });
      const [x, y, z] = lease.frame.geographic.encode(services.resolve(position), origin);
      assert.ok(x >= -1e-5 && x <= 8192 + 1e-5 && y >= -1e-5 && y <= 8192 + 1e-5);
      assert.equal(z, altitude);
      const size = 2 ** tileZoom;
      const inverseLongitude = (origin.tile.x + x / 8192) / size * 360 - 180;
      const inverseLatitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * (origin.tile.y + y / 8192) / size))) * 180 / Math.PI;
      assert.ok(Math.abs(inverseLongitude - longitude) < 1e-8);
      assert.ok(Math.abs(inverseLatitude - latitude) < 1e-8);
      lease.close();
    }), runs);
});

test('terrain heights add finite authored offsets once while keeping origin partitioning independent', () => {
  fc.assert(fc.property(scalar(-179, 179), scalar(-80, 80), scalar(-1000, 10000), scalar(-100, 100),
    fc.integer({ min: 0, max: 22 }), (longitude, latitude, height, offset, tileZoom) => {
      let samples = 0;
      const lngLat = [longitude === 0 ? 0 : longitude, latitude];
      const services = createEpochGeographicServices({ epoch: 1, isCurrent: () => true,
        layout: () => ({ revision: 1, tileZoom, centerLongitude: longitude }),
        resolveTerrain(point, layout) {
          samples++; assert.deepEqual(point, lngLat);
          assert.equal(Object.isFrozen(point), true); assert.equal(Object.isFrozen(layout), true);
          return { status: 'resolved', height };
        } });
      const position = { lngLat: [longitude, latitude], altitude: offset, altitudeReference: 'terrain' };
      const origin = services.frameFor(position);
      assert.equal(samples, 0);
      const lease = createGeographicFrameLease({ epoch: 1, revision: 1, time: 0, width: 400, height: 300,
        pixelRatio: 1, reducedMotion: true, services, isCurrent: () => true,
        projectionFor() { throw new Error('Terrain resolution and encoding do not require native projection.'); } });
      const expected = { lngLat, altitude: height + offset, status: 'resolved' };
      assert.deepEqual(services.resolve(position), expected);
      const resolved = lease.frame.geographic.resolve(position);
      assert.deepEqual(resolved, expected);
      assert.equal(lease.frame.geographic.encode(resolved, origin)[2], height + offset);
      assert.equal(samples, 2); lease.close();
    }), runs);
});
