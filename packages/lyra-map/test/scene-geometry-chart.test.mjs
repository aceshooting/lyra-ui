import assert from 'node:assert/strict';
import test from 'node:test';
import { compileProjectionSnapshot, evaluateSceneProjection } from '../src/scene/projection.mjs';
import { evaluateSceneChartBoundary } from '../src/scene/geometry-chart.mjs';

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const at = (longitude, latitude = 0, altitude = 7) => ({ lngLat: [longitude, latitude], altitude });
const seam = side => ({ kind: 'antimeridian', side });
const cut = side => ({ kind: 'world-cut', side });
function request(tile, representative) {
  return { layoutRevision: 4, tile,
    key: `4:${tile.z}:${tile.x}:${tile.y}:${tile.wrap}`, representative };
}
function source(tile = { z: 0, x: 0, y: 0, wrap: 0 }, transition = 0, centerLongitude = 180) {
  const n = 2 ** tile.z, flat = identity();
  flat[0] = 2 / (8192 * n); flat[5] = -2 / (8192 * n);
  flat[12] = 2 * (tile.x / n + tile.wrap) - 1; flat[13] = 1 - 2 * tile.y / n;
  return { contract: 1, contextEpoch: 2, viewRevision: 3,
    layout: { revision: 4, tileZoom: tile.z, centerLongitude }, tile: { ...tile },
    width: 200, height: 100, mainMatrix: identity(), fallbackMatrix: flat.map(Math.fround),
    clippingPlane: [0, 0, 1, Math.fround(-1 / 3)],
    tileMercatorCoords: [tile.x / n, tile.y / n, 1 / (8192 * n), 1 / (8192 * n)].map(Math.fround),
    projectionTransition: Math.fround(transition) };
}
const near = (actual, expected, tolerance = 1e-12) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Number.isFinite(value) && Math.abs(value - expected[index]) <= tolerance));
};

test('antimeridian chart twins encode west as world x zero and east as world x one', () => {
  for (const z of [0, 20]) {
    const n = 2 ** z, y = Math.floor(n / 2);
    for (const longitude of [-180, 180]) {
      const west = evaluateSceneChartBoundary(at(longitude), compileProjectionSnapshot(source({ z, x: 0, y, wrap: 1 })), seam('west'));
      const east = evaluateSceneChartBoundary(at(longitude), compileProjectionSnapshot(source({ z, x: n - 1, y, wrap: 0 })), seam('east'));
      assert.equal(west.status, 'projected'); assert.equal(east.status, 'projected');
      assert.equal(west.tilePosition[0], 0); assert.equal(east.tilePosition[0], 8192);
      assert.equal(west.tilePosition[2], 7); assert.equal(east.tilePosition[2], 7);
      near(west.clip, [1, 0, 7, 1]); near(east.clip, west.clip);
    }
  }
});

test('world-cut twins admit only the two nearest-wrap tie copies without moving the geographic point', () => {
  const lower = compileProjectionSnapshot(source());
  const upper = compileProjectionSnapshot(source({ z: 0, x: 0, y: 0, wrap: 1 }));
  const a = evaluateSceneChartBoundary(at(0), lower, cut('lower-wrap'));
  const b = evaluateSceneChartBoundary(at(0), upper, cut('upper-wrap'));
  assert.equal(a.status, 'projected'); assert.equal(b.status, 'projected');
  assert.deepEqual(a.tilePosition, [4096, 4096, 7]); assert.deepEqual(b.tilePosition, a.tilePosition);
  near(a.clip, [0, 0, 7, 1]); near(b.clip, [2, 0, 7, 1]);
  assert.equal(evaluateSceneProjection(at(0), upper).status, 'origin-needed');
  assert.equal(evaluateSceneProjection(at(0), lower).status, 'projected');
});

test('boundary helpers preserve canonical globe altitude and the uploaded transition branch', () => {
  const boundary = Math.fround(0.999), bits = new Uint32Array(new Float32Array([boundary]).buffer);
  bits[0]++; const above = new Float32Array(bits.buffer)[0];
  for (const t of [0, 0.5, boundary, above, 1]) {
    const west = evaluateSceneChartBoundary(at(-180), compileProjectionSnapshot(source({ z: 0, x: 0, y: 0, wrap: 1 }, t)), seam('west'));
    const east = evaluateSceneChartBoundary(at(180), compileProjectionSnapshot(source(undefined, t)), seam('east'));
    const sphere = [Math.sin(-Math.PI) * (1 + 7 / 6371008.8), 0, -(1 + 7 / 6371008.8), 1];
    const weight = t > boundary ? 1 : t;
    const expected = [1, 0, 7, 1].map((value, index) => value * (1 - weight) + sphere[index] * weight);
    near(west.clip, expected); near(east.clip, expected);
    assert.equal(west.horizonOccluded, east.horizonOccluded);
    assert.equal('visible' in west, false);
  }
});

test('boundary admission rejects nonboundary longitudes, invalid sides, forged authority and accessor inputs', () => {
  const compiled = compileProjectionSnapshot(source());
  for (const [point, boundary] of [[at(179.999999999), seam('east')], [at(-179.999999999), seam('west')],
    [at(0.000000001), cut('lower-wrap')], [at(0), seam('east')], [at(180), cut('lower-wrap')],
    [at(180), seam('lower-wrap')], [at(0), cut('east')], [at(0), { kind: 'other', side: 'east' }]]) {
    assert.throws(() => evaluateSceneChartBoundary(point, compiled, boundary), TypeError);
  }
  for (const fake of [{ ...compiled }, compiled.snapshot, Object.create(compiled)]) {
    assert.throws(() => evaluateSceneChartBoundary(at(180), fake, seam('east')), TypeError);
  }
  let reads = 0;
  const boundary = { kind: 'antimeridian' };
  Object.defineProperty(boundary, 'side', { get() { reads++; return 'east'; } });
  assert.throws(() => evaluateSceneChartBoundary(at(180), compiled, boundary), TypeError);
  assert.equal(reads, 0);
});

test('boundary admission does not turn an unrelated wrap into a third world copy', () => {
  const compiled = compileProjectionSnapshot(source({ z: 0, x: 0, y: 0, wrap: 2 }));
  assert.throws(() => evaluateSceneChartBoundary(at(0), compiled, cut('upper-wrap')), TypeError);
  assert.throws(() => evaluateSceneChartBoundary(at(180), compiled, seam('east')), TypeError);
});

test('coincident antimeridian and world-cut boundaries fail closed for every side', () => {
  for (const centerLongitude of [-720, -360, 0, 360, 720]) {
    const world = centerLongitude / 360;
    for (const longitude of [-180, 180]) {
      for (const wrap of [world - 1, world, world + 1]) {
        const compiled = compileProjectionSnapshot(source({ z: 0, x: 0, y: 0, wrap }, 0, centerLongitude));
        for (const boundary of [seam('west'), seam('east'), cut('lower-wrap'), cut('upper-wrap')]) {
          assert.throws(() => evaluateSceneChartBoundary(at(longitude), compiled, boundary), TypeError);
        }
      }
    }
  }
});

test('side encoding accepts neighboring canonical tiles in bounds rather than requiring an edge tile', () => {
  const west = evaluateSceneChartBoundary(at(-180), compileProjectionSnapshot(source({ z: 4, x: 1, y: 8, wrap: 1 })), seam('west'));
  const east = evaluateSceneChartBoundary(at(180), compileProjectionSnapshot(source({ z: 4, x: 14, y: 8, wrap: 0 })), seam('east'));
  assert.equal(west.status, 'projected'); assert.equal(east.status, 'projected');
  assert.equal(west.tilePosition[0], -8192); assert.equal(east.tilePosition[0], 16384);
  for (const [side, tile, target, representative] of [
    ['west', { z: 4, x: 15, y: 8, wrap: 1 }, { z: 4, x: 0, y: 8, wrap: 1 }, [-180, 0]],
    ['east', { z: 4, x: 0, y: 8, wrap: 0 }, { z: 4, x: 15, y: 8, wrap: 0 }, [180, 0]]]) {
    const result = evaluateSceneChartBoundary(at(180), compileProjectionSnapshot(source(tile)), seam(side));
    assert.equal(result.status, 'origin-needed');
    assert.deepEqual(result.request, request(target, representative));
    assert.equal(evaluateSceneChartBoundary(at(180), compileProjectionSnapshot(source(result.request.tile)), seam(side)).status, 'projected');
  }
});

test('nonzero world-cut longitude uses exact lower and upper wrap side requests', () => {
  const point = at(30), center = 210;
  for (const [side, wrap] of [['lower-wrap', 0], ['upper-wrap', 1]]) {
    const local = evaluateSceneChartBoundary(point, compileProjectionSnapshot(source({ z: 4, x: 9, y: 8, wrap }, 0, center)), cut(side));
    assert.equal(local.status, 'projected');
    near(local.clip, [1 / 6 + 2 * wrap, 0, 7, 1], 1e-7);
    const distant = evaluateSceneChartBoundary(point, compileProjectionSnapshot(source({ z: 4, x: 0, y: 8, wrap }, 0, center)), cut(side));
    assert.equal(distant.status, 'origin-needed');
    assert.deepEqual(distant.request, request({ z: 4, x: 9, y: 8, wrap }, [30, 0]));
    assert.equal(evaluateSceneChartBoundary(point, compileProjectionSnapshot(source(distant.request.tile, 0, center)), cut(side)).status, 'projected');
  }
});

test('large center subtraction cannot turn a nearby longitude into an exact world-cut boundary', () => {
  const compiled = compileProjectionSnapshot(source({ z: 0, x: 0, y: 0, wrap: 999999 }, 0, 359999820));
  assert.throws(() => evaluateSceneChartBoundary(at(1e-9), compiled, cut('lower-wrap')), TypeError);
  assert.equal(evaluateSceneChartBoundary(at(0), compiled, cut('lower-wrap')).status, 'projected');
});

test('canonical decimal-center boundaries admit both wraps without an integer residual test', () => {
  const point = at(179.89999999999998);
  for (const [side, wrap] of [['lower-wrap', -1], ['upper-wrap', 0]]) {
    const compiled = compileProjectionSnapshot(source({ z: 0, x: 0, y: 0, wrap }, 0, -0.1));
    assert.equal(evaluateSceneChartBoundary(point, compiled, cut(side)).status, 'projected');
  }
});

test('native submitted Float32 bounds apply to boundary vertices before raw projection', () => {
  // At x = 0 the west boundary is local zero; distant tile y must still request a nearer origin.
  const compiled = compileProjectionSnapshot(source({ z: 20, x: 0, y: 0, wrap: 1 }));
  const result = evaluateSceneChartBoundary(at(-180), compiled, seam('west'));
  assert.equal(result.status, 'origin-needed');
  assert.deepEqual(result.request, request({ z: 20, x: 0, y: 524288, wrap: 1 }, [-180, 0]));
  const nearby = compileProjectionSnapshot(source({ z: 4, x: 0, y: 0, wrap: 1 }));
  for (const [localY, status] of [[32766.49, 'projected'], [32766.51, 'origin-needed']]) {
    const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * localY / (8192 * 16)))) * 180 / Math.PI;
    const encoded = evaluateSceneChartBoundary(at(-180, latitude), nearby, seam('west'));
    assert.equal(encoded.status, status);
    if (status === 'projected') assert.ok(Math.fround(encoded.tilePosition[1]) <= 32766.5);
  }
  const lower = compileProjectionSnapshot(source({ z: 4, x: 0, y: 8, wrap: 1 }));
  for (const [localY, status] of [[-32767.49, 'projected'], [-32767.51, 'origin-needed']]) {
    const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * (8 + localY / 8192) / 16))) * 180 / Math.PI;
    assert.equal(evaluateSceneChartBoundary(at(-180, latitude), lower, seam('west')).status, status);
  }
});
