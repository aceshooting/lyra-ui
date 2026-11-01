import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { projectionOriginFor, compileProjectionSnapshot, evaluateSceneProjection } from '../src/scene/projection.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function source() {
  const matrix = identity(); matrix[0] = 1 / 8192; matrix[5] = 1 / 8192;
  return { contract: 1, contextEpoch: 1, viewRevision: 2,
    layout: { revision: 3, tileZoom: 0, centerLongitude: 0 }, tile: { z: 0, x: 0, y: 0, wrap: 0 },
    width: 200, height: 100, mainMatrix: [...matrix], fallbackMatrix: [...matrix],
    clippingPlane: [0, 0, 1, Math.fround(-1 / 3)], tileMercatorCoords: [0, 0, 1 / 8192, 1 / 8192], projectionTransition: 0 };
}

test('equatorial Mercator raw coordinates agree with longitude fraction and preserve meter altitude', () => {
  fc.assert(fc.property(fc.integer({ min: -170, max: 170 }), fc.integer({ min: -1000, max: 100000 }), (longitude, altitude) => {
    const input = source(), before = structuredClone(input), compiled = compileProjectionSnapshot(input);
    const result = evaluateSceneProjection({ lngLat: [longitude, 0], altitude }, compiled);
    assert.equal(result.status, 'projected');
    assert.ok(Math.abs(result.clip[0] - (longitude / 360 + 0.5)) < 1e-7);
    assert.deepEqual(result.clip.slice(1), [0.5, altitude, 1]);
    assert.equal(result.horizonOccluded, false); assert.deepEqual(input, before);
  }), runs);
});

test('nearest origin wrap minimizes distance among neighboring world copies with lower-wrap ties', () => {
  fc.assert(fc.property(fc.integer({ min: -179, max: 179 }), fc.integer({ min: -1080, max: 1080 }),
    fc.integer({ min: 0, max: 20 }), (longitude, centerLongitude, tileZoom) => {
      const point = { lngLat: [longitude, 0] }, layout = { revision: 1, tileZoom, centerLongitude };
      const request = projectionOriginFor(point, layout), wrap = request.tile.wrap;
      const distance = Math.abs(longitude + wrap * 360 - centerLongitude);
      for (const candidate of [wrap - 1, wrap + 1]) {
        const alternative = Math.abs(longitude + candidate * 360 - centerLongitude);
        assert.ok(distance <= alternative);
        if (distance === alternative) assert.ok(wrap < candidate);
      }
      assert.equal(request.tile.z, tileZoom); assert.equal(request.layoutRevision, 1);
      assert.ok(Number.isInteger(request.tile.x) && request.tile.x >= 0 && request.tile.x < 2 ** tileZoom);
      assert.equal(request.tile.y, Math.floor(2 ** tileZoom / 2));
      assert.deepEqual(request.representative, point.lngLat);
    }), runs);
});

test('finite translation matrices move raw homogeneous positions by their independent translation vector', () => {
  fc.assert(fc.property(fc.tuple(...Array.from({ length: 4 }, () => fc.integer({ min: -1000, max: 1000 }))), values => {
    const baseline = evaluateSceneProjection({ lngLat: [0, 0], altitude: 7 }, compileProjectionSnapshot(source()));
    const input = source();
    for (let index = 0; index < 4; index++) {
      input.mainMatrix[12 + index] += values[index]; input.fallbackMatrix[12 + index] += values[index];
    }
    const result = evaluateSceneProjection({ lngLat: [0, 0], altitude: 7 }, compileProjectionSnapshot(input));
    assert.equal(result.status, 'projected');
    assert.deepEqual(result.clip, baseline.clip.map((value, index) => value + values[index]));
  }), runs);
});
