import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { createProjectionSnapshot, projectScenePosition } from '../src/scene/projection.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const flat = [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 1 / 1000, 0, -1, 1, 0, 1];

test('Mercator longitude and meter altitude remain independent across finite snapshots', () => {
  fc.assert(fc.property(fc.integer({ min: -170, max: 170 }), fc.integer({ min: -70, max: 70 }),
    fc.integer({ min: -900, max: 900 }), (longitude, latitude, altitude) => {
      const data = { tile: { z: 0, x: 0, y: 0, wrap: 0 }, mainMatrix: [...flat], fallbackMatrix: [...flat],
        clippingPlane: [0, 0, 0, 0], projectionTransition: 0, width: 200, height: 100 };
      const before = structuredClone(data), frame = createProjectionSnapshot(data);
      const result = projectScenePosition({ lngLat: [longitude, latitude], altitude }, frame);
      assert.equal(result.clip.length, 4);
      assert.ok(Math.abs(result.clip[0] - longitude / 180) < 1e-10);
      assert.ok(Math.abs(result.clip[2] - altitude / 1000) < 1e-10);
      assert.equal(result.status, 'visibility-pending');
      assert.deepEqual(data, before);
    }), runs);
});
