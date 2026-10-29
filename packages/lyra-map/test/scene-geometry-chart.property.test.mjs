import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { compileProjectionSnapshot } from '../src/scene/projection.mjs';
import { evaluateSceneChartBoundary } from '../src/scene/geometry-chart.mjs';

const runs = { seed: 0x5eed_1e57, numRuns: 200, includeErrorInReport: true };
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function compiled(z, x, wrap, centerLongitude = 180) {
  const n = 2 ** z, y = Math.floor(n / 2);
  return compileProjectionSnapshot({ contract: 1, contextEpoch: 2, viewRevision: 3,
    layout: { revision: 4, tileZoom: z, centerLongitude }, tile: { z, x, y, wrap },
    width: 200, height: 100, mainMatrix: identity(), fallbackMatrix: identity(),
    clippingPlane: [0, 0, 1, Math.fround(-1 / 3)],
    tileMercatorCoords: [x / n, y / n, 1 / (8192 * n), 1 / (8192 * n)].map(Math.fround), projectionTransition: 1 });
}

test('antimeridian twins retain identical canonical sphere coordinates across zooms and raised altitudes', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 20 }), fc.integer({ min: -12000, max: 100000000 }), (z, altitude) => {
    const point = { lngLat: [-180, 0], altitude };
    const west = evaluateSceneChartBoundary(point, compiled(z, 0, 1), { kind: 'antimeridian', side: 'west' });
    const east = evaluateSceneChartBoundary(point, compiled(z, 2 ** z - 1, 0), { kind: 'antimeridian', side: 'east' });
    assert.equal(west.status, 'projected'); assert.equal(east.status, 'projected');
    assert.deepEqual(west.clip, east.clip);
    assert.equal(west.tilePosition[0], 0); assert.equal(east.tilePosition[0], 8192);
    assert.equal(west.tilePosition[2], altitude); assert.equal(east.tilePosition[2], altitude);
    assert.ok(Math.abs(west.clip[2] + 1 + altitude / 6371008.8) < 1e-12);
  }), runs);
});

test('world-cut ties remain adjacent wraps when the center moves by whole worlds', () => {
  fc.assert(fc.property(fc.integer({ min: -100, max: 100 }), fc.integer({ min: -12000, max: 100000000 }), (world, altitude) => {
    const point = { lngLat: [0, 0], altitude }, center = 180 + 360 * world;
    const lower = evaluateSceneChartBoundary(point, compiled(0, 0, world, center), { kind: 'world-cut', side: 'lower-wrap' });
    const upper = evaluateSceneChartBoundary(point, compiled(0, 0, world + 1, center), { kind: 'world-cut', side: 'upper-wrap' });
    assert.equal(lower.status, 'projected'); assert.equal(upper.status, 'projected');
    assert.deepEqual(lower.tilePosition, [4096, 4096, altitude]);
    assert.deepEqual(upper.tilePosition, lower.tilePosition); assert.deepEqual(upper.clip, lower.clip);
    assert.deepEqual(lower.clip, [0, 0, 1 + altitude / 6371008.8, 1]);
  }), runs);
});
