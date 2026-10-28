import assert from 'node:assert/strict';
import test from 'node:test';
import { projectionOriginFor, compileProjectionSnapshot, evaluateSceneProjection } from '../src/scene/projection.mjs';

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const position = (longitude = 0, latitude = 0, altitude = 0) => ({ lngLat: [longitude, latitude], altitude });
function snapshot(tile = { z: 0, x: 0, y: 0, wrap: 0 }) {
  const n = 2 ** tile.z;
  return {
    contract: 1, contextEpoch: 2, viewRevision: 3,
    layout: { revision: 4, tileZoom: tile.z, centerLongitude: 0 }, tile: { ...tile },
    width: 200, height: 100, mainMatrix: identity(), fallbackMatrix: identity(),
    clippingPlane: [0, 0, 1, Math.fround(-1 / 3)],
    tileMercatorCoords: [tile.x / n, tile.y / n, 1 / (8192 * n), 1 / (8192 * n)].map(Math.fround),
    projectionTransition: 0
  };
}
const evaluate = (value, source = snapshot()) => evaluateSceneProjection(value, compileProjectionSnapshot(source));
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
function atLocal(x, y, tile) {
  const n = 2 ** tile.z;
  return position(((tile.x + x / 8192) / n) * 360 - 180,
    Math.atan(Math.sinh(Math.PI * (1 - 2 * (tile.y + y / 8192) / n))) * 180 / Math.PI);
}
function adjacent(value, upwards) {
  const buffer = new ArrayBuffer(4), floats = new Float32Array(buffer), bits = new Uint32Array(buffer);
  floats[0] = value; bits[0] += (value >= 0) === upwards ? 1 : -1; return floats[0];
}

test('compilation owns frozen structured-cloned numeric snapshots and geometry stamps', () => {
  const source = structuredClone(snapshot()), original = structuredClone(source);
  const compiled = compileProjectionSnapshot(source);
  source.mainMatrix.fill(0); source.fallbackMatrix.fill(0); source.tile.x = 4;
  source.layout.revision = 900; source.viewRevision = 900; source.contextEpoch = 900;
  assert.deepEqual(compiled.snapshot, original);
  for (const value of [compiled, compiled.snapshot, compiled.snapshot.layout, compiled.snapshot.tile,
    compiled.snapshot.mainMatrix, compiled.snapshot.fallbackMatrix, compiled.snapshot.clippingPlane,
    compiled.snapshot.tileMercatorCoords]) assert.equal(Object.isFrozen(value), true);
  assert.deepEqual(evaluateSceneProjection(position(0, 0, 12), compiled).clip, [4096, 4096, 12, 1]);
});

test('compiled handles require runtime authority even when their public snapshot is valid', () => {
  const compiled = compileProjectionSnapshot(snapshot());
  for (const fake of [snapshot(), { snapshot: compiled.snapshot, effectiveProjection: 'mercator' },
    { ...compiled }, Object.create(compiled)]) {
    assert.throws(() => evaluateSceneProjection(position(), fake), TypeError);
  }
});

test('snapshot admission rejects getters without executing them or custom array iterators', () => {
  let reads = 0;
  for (const path of ['width', 'layout', 'matrix', 'tile']) {
    const source = snapshot();
    const target = path === 'matrix' ? source.mainMatrix : path === 'tile' ? source.tile : source;
    const key = path === 'matrix' ? '0' : path === 'tile' ? 'x' : path;
    Object.defineProperty(target, key, { get() { reads++; throw new Error('getter'); } });
    assert.throws(() => compileProjectionSnapshot(source), TypeError);
  }
  const source = snapshot();
  source.mainMatrix[Symbol.iterator] = () => { reads++; throw new Error('iterator'); };
  compileProjectionSnapshot(source);
  assert.equal(reads, 0);
});

test('contract, dimensions, revisions, native tiles and Float32 uniforms are validated', () => {
  const changes = [{ contract: '1' }, { contract: 2 }, { width: 0 }, { height: Infinity },
    { contextEpoch: 0 }, { viewRevision: 1.5 }, { viewRevision: Number.MAX_SAFE_INTEGER + 1 },
    { layout: { revision: 0, tileZoom: 0, centerLongitude: 0 } },
    { layout: { revision: 4, tileZoom: 1, centerLongitude: 0 } },
    { tile: { z: 0, x: 1, y: 0, wrap: 0 } }, { tile: { z: 0, x: 0, y: -1, wrap: 0 } },
    { tile: { z: 0, x: 0, y: 0, wrap: 1000001 } },
    { mainMatrix: identity().slice(1) }, { mainMatrix: [NaN, ...identity().slice(1)] },
    { fallbackMatrix: [1e40, ...identity().slice(1)] }, { fallbackMatrix: [0.1, ...identity().slice(1)] },
    { clippingPlane: [0, 0, Infinity, -1] }, { projectionTransition: 0.1 },
    { projectionTransition: -1 }, { projectionTransition: 2 }];
  for (const change of changes) assert.throws(() => compileProjectionSnapshot({ ...snapshot(), ...change }), TypeError);
  const singular = snapshot(); singular.mainMatrix.fill(0); singular.fallbackMatrix.fill(0);
  assert.doesNotThrow(() => compileProjectionSnapshot(singular));
  for (const plane of [[0, 0, 0, -1], [0, 0, 1, 0], [0, 0, 1, 1]]) {
    assert.throws(() => compileProjectionSnapshot({ ...snapshot(), projectionTransition: 1, clippingPlane: plane }), TypeError);
  }
  assert.throws(() => compileProjectionSnapshot({ ...snapshot(), projectionTransition: 1,
    clippingPlane: [0, 0, 1, -(2 ** -149)] }), TypeError);
  if (typeof SharedArrayBuffer === 'function') {
    assert.throws(() => compileProjectionSnapshot({ ...snapshot(), mainMatrix: new Float32Array(new SharedArrayBuffer(64)) }), TypeError);
  }
  if (typeof ArrayBuffer.prototype.resize === 'function') {
    assert.throws(() => compileProjectionSnapshot({ ...snapshot(), mainMatrix: new Float32Array(new ArrayBuffer(64, { maxByteLength: 128 })) }), TypeError);
  }
});

test('tile coefficients match the canonical tile exactly and exclude wrap at every supported scale', () => {
  for (const z of [0, 20, 30]) for (const wrap of [-2, 0, 2]) {
    const source = snapshot({ z, x: z === 0 ? 0 : 17, y: z === 0 ? 0 : 31, wrap });
    assert.deepEqual(compileProjectionSnapshot(source).snapshot.tileMercatorCoords, source.tileMercatorCoords);
    for (const coefficients of [[0, 0, 1, 1],
      source.tileMercatorCoords.map((value, index) => index === 0 ? Math.fround(value + 1) : value),
      source.tileMercatorCoords.map((value, index) => index === 1 ? Math.fround(value + 1) : value),
      source.tileMercatorCoords.map((value, index) => index === 2 ? Math.fround(value * 2) : value)]) {
      assert.throws(() => compileProjectionSnapshot({ ...source, tileMercatorCoords: coefficients }), TypeError);
    }
  }
});

test('raw projection preserves nonpositive homogeneous w and physical out-of-volume z', () => {
  for (const w of [-2, 0]) {
    const source = snapshot(); source.mainMatrix[15] = w; source.fallbackMatrix[15] = w;
    const result = evaluate(position(0, 0, 500), source);
    assert.equal(result.status, 'projected'); assert.deepEqual(result.clip, [4096, 4096, 500, w]);
    assert.equal(Object.hasOwn(result, 'visible'), false); assert.equal(Object.hasOwn(result, 'point'), false);
  }
});

test('effective projection snaps strictly above the uploaded Float32 threshold', () => {
  const threshold = Math.fround(0.999), above = adjacent(threshold, true);
  for (const [transition, branch] of [[0, 'mercator'], [threshold, 'mixed'], [above, 'globe'], [1, 'globe']]) {
    const source = snapshot(); source.projectionTransition = transition;
    source.mainMatrix = identity(); source.mainMatrix[12] = 10;
    source.fallbackMatrix = identity(); source.fallbackMatrix[12] = 20;
    if (transition === 0) source.mainMatrix = [...source.fallbackMatrix];
    const compiled = compileProjectionSnapshot(source), result = evaluateSceneProjection(position(), compiled);
    assert.equal(compiled.effectiveProjection, branch);
    const expected = branch === 'globe' ? 10 : 4116 * (1 - transition) + 10 * transition;
    near(result.clip[0], expected);
    assert.equal(result.horizonOccluded, false);
  }
  assert.equal(Math.fround(0.999 + 1e-12), threshold);
});

test('raw Float32 xy margin is inclusive on both axes even in full globe', () => {
  const tile = { z: 4, x: 8, y: 8, wrap: 0 };
  for (const transition of [0, 1]) for (const axis of [0, 1]) for (const boundary of [-32767.5, 32766.5]) {
    const source = snapshot(tile); source.projectionTransition = transition;
    const coordinates = [0, 0]; coordinates[axis] = boundary;
    const result = evaluate(atLocal(...coordinates, tile), source);
    assert.equal(result.status, 'projected'); assert.equal(Math.fround(result.tilePosition[axis]), boundary);
    coordinates[axis] = adjacent(boundary, boundary > 0);
    assert.equal(evaluate(atLocal(...coordinates, tile), source).status, 'origin-needed');
  }
  const source = snapshot(tile);
  assert.equal(evaluate(atLocal(20000, 20000, tile), source).status, 'projected');
});

test('nearest-wrap mismatch requires another origin even within one root tile', () => {
  const source = snapshot(); source.layout.centerLongitude = 180;
  const plus = projectionOriginFor(position(1), source.layout), minus = projectionOriginFor(position(-1), source.layout);
  assert.equal(plus.tile.wrap, 0); assert.equal(minus.tile.wrap, 1);
  assert.equal(evaluate(position(1), source).status, 'projected');
  const result = evaluate(position(-1), source);
  assert.equal(result.status, 'origin-needed'); assert.deepEqual(result.request, minus);
  assert.equal(projectionOriginFor(position(0), source.layout).tile.wrap, 0);
  assert.equal(projectionOriginFor(position(-1), { ...source.layout, centerLongitude: 0 }).tile.wrap, 0);
  assert.equal(projectionOriginFor(position(179), source.layout).tile.wrap, 0);
  assert.equal(projectionOriginFor(position(-179), source.layout).tile.wrap, 1);
});

test('origin requests own representative coordinates and derive keys from numeric layout', () => {
  const point = position(12, 34), layout = { revision: 7, tileZoom: 3, centerLongitude: 0 };
  const request = projectionOriginFor(point, layout);
  point.lngLat.fill(0); layout.revision = 90;
  assert.equal(request.layoutRevision, 7); assert.deepEqual(request.representative, [12, 34]);
  assert.equal(typeof request.key, 'string'); assert.ok(request.key.length > 0);
  assert.deepEqual(request, projectionOriginFor(position(12, 34), { revision: 7, tileZoom: 3, centerLongitude: 0 }));
  for (const invalid of [position(NaN), position(0, 86), { ...position(), altitudeReference: 'terrain' }]) {
    assert.throws(() => projectionOriginFor(invalid, { revision: 7, tileZoom: 3, centerLongitude: 0 }), TypeError);
    assert.throws(() => evaluate(invalid), TypeError);
  }
});

test('distinct origins retain distinct local matrices without substituting another origin uniforms', () => {
  const left = snapshot({ z: 1, x: 0, y: 1, wrap: 0 }), right = snapshot({ z: 1, x: 1, y: 1, wrap: 0 });
  left.mainMatrix[12] = left.fallbackMatrix[12] = 100;
  right.mainMatrix[12] = right.fallbackMatrix[12] = 200;
  const a = evaluate(position(-90), left), b = evaluate(position(90), right);
  assert.deepEqual(a.clip, [4196, 0, 0, 1]); assert.deepEqual(b.clip, [4296, 0, 0, 1]);
  assert.deepEqual(a.tilePosition, [4096, 0, 0]); assert.deepEqual(b.tilePosition, [4096, 0, 0]);
});
