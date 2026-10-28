import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { placeModelVertex } from '../dist/map/model-placement.js';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const coordinate = fc.integer({ min: -1000, max: 1000 });
test('axis conversion and quaternion rotation preserve scaled source distances', () => {
  fc.assert(fc.property(fc.tuple(coordinate, coordinate, coordinate), fc.integer({ min: 1, max: 20 }),
    fc.integer({ min: -180, max: 180 }), (point, scale, angle) => {
      const half = angle * Math.PI / 360;
      const original = [...point];
      const result = placeModelVertex(point, { metersPerUnit: scale, orientation: [0, 0, Math.sin(half), Math.cos(half)] });
      assert.ok(Math.abs(Math.hypot(...result) - Math.hypot(...point) * scale) < 1e-8);
      assert.deepEqual(point, original);
    }), runs);
});
