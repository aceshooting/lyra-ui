import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { Euler, Matrix4 } from 'three';
import { deriveModelLighting } from '../dist/map/camera-lighting.js';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
test('independent perspective-affine fixtures preserve raised local vertical eye offsets', () => {
  fc.assert(fc.property(fc.integer({ min: -120, max: 120 }), fc.integer({ min: -60, max: 60 }),
    fc.integer({ min: -100, max: 1000 }), fc.integer({ min: 100, max: 10000 }),
    fc.integer({ min: -50, max: 50 }), (longitude, latitude, altitude, above, angle) => {
      const x = (longitude + 180) / 360 * 8192;
      const y = (1 - Math.asinh(Math.tan(latitude * Math.PI / 180)) / Math.PI) / 2 * 8192;
      const projection = new Matrix4().makePerspective(-1, 1.2, 0.8, -1.1, 1, 1000000);
      const view = new Matrix4().makeRotationFromEuler(new Euler(angle / 100, angle / 200, angle / 150))
        .multiply(new Matrix4().makeScale(1 / 8192, -1 / 8192, 1 / 1000))
        .multiply(new Matrix4().makeTranslation(-x, -y, -(altitude + above)));
      const result = deriveModelLighting({ nativeProjectionFamily: 'mercator', transition: 0,
        tile: { z: 0, x: 0, y: 0, wrap: 0 }, fallbackMatrix: projection.multiply(view).elements,
        clippingPlane: [0, 0, 0, 0], anchor: { lngLat: [longitude, latitude], altitude } });
      assert.equal(result.eyeEnu.length, 3);
      assert.ok(result.eyeEnu.every(Number.isFinite));
      assert.ok(Math.hypot(result.eyeEnu[0], result.eyeEnu[1], result.eyeEnu[2] - above) < 1e-4);
    }), runs);
});
