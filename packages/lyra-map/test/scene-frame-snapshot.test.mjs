import assert from 'node:assert/strict';
import test from 'node:test';
import { createEpochGeographicServices, createGeographicFrameLease } from '../src/scene/frame.mjs';
import * as projection from '../src/scene/projection.mjs';

const at = (longitude = 0, latitude = 0) => ({ lngLat: [longitude, latitude], altitude: 0 });
function fixture() {
  let rootCurrent = true, frameCurrent = true, calls = 0;
  let layout = { revision: 1, tileZoom: 0, centerLongitude: 0 };
  const source = {
    shaderData: { variantName: 'mercator', vertexShaderPrelude: 'vec4 projectTileFor3D(vec2 p, float z) { return vec4(p, z, 1.0); }', define: '#define PROJECTION_MERCATOR' },
    mainMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    fallbackMatrix: [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 0.001, 0, -1, 1, 0, 1],
    tileMercatorCoords: [0, 0, 1 / 8192, 1 / 8192],
    clippingPlane: [0, 0, 1, -1 / 3], projectionTransition: 0
  };
  const services = createEpochGeographicServices({ epoch: 1, isCurrent: () => rootCurrent, layout: () => layout });
  const input = { epoch: 1, revision: 2, time: 123, width: 200, height: 100, pixelRatio: 2,
    reducedMotion: false, services, isCurrent: () => frameCurrent,
    projectionFor() { calls++; return source; } };
  return { source, services, input, calls: () => calls,
    expireRoot() { rootCurrent = false; }, expireFrame() { frameCurrent = false; },
    setLayout(value) { layout = value; } };
}

test('captured numeric projection remains usable after the native callback lease closes', async () => {
  const f = fixture(), origin = f.services.frameFor(at());
  const lease = createGeographicFrameLease(f.input);
  const snapshot = lease.frame.geographic.captureProjection(origin);
  assert.deepEqual(lease.frame.projectionStamp, { contextEpoch: 1, viewRevision: 2,
    layout: { revision: 1, tileZoom: 0, centerLongitude: 0 } });
  assert.equal(snapshot.contract, 1);
  assert.equal(snapshot.width, 200); assert.equal(snapshot.height, 100);
  assert.equal(snapshot.viewRevision, lease.frame.revision);
  assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.layout) && Object.isFrozen(snapshot.tile));
  assert.ok(Object.isFrozen(lease.frame.projectionStamp));
  f.source.fallbackMatrix.fill(0); f.input.width = 500;
  lease.close(); await Promise.resolve();
  const compiled = projection.compileProjectionSnapshot(structuredClone(snapshot));
  const result = projection.evaluateSceneProjection(at(), compiled);
  assert.equal(result.status, 'projected');
  assert.deepEqual(result.clip, [0, 0, 0, 1]);
  assert.deepEqual(result.tilePosition, [4096, 4096, 0]);
  assert.equal(f.calls(), 1);
  assert.throws(() => lease.frame.geographic.captureProjection(origin));
});

test('capture and shader use one owned Float32 snapshot in either call order', () => {
  for (const first of ['capture', 'shader']) {
    const f = fixture(), origin = f.services.frameFor(at());
    f.source.mainMatrix[0] = 1 / 3;
    const lease = createGeographicFrameLease(f.input), geographic = lease.frame.geographic;
    if (first === 'capture') geographic.captureProjection(origin); else geographic.shader(origin);
    const snapshot = geographic.captureProjection(origin), shader = geographic.shader(origin);
    for (const [name, key] of [['u_projection_matrix', 'mainMatrix'], ['u_projection_fallback_matrix', 'fallbackMatrix'],
      ['u_projection_clipping_plane', 'clippingPlane'], ['u_projection_tile_mercator_coords', 'tileMercatorCoords'],
      ['u_projection_transition', 'projectionTransition']]) {
      assert.deepEqual(shader.uniforms.find(uniform => uniform.name === name).value, snapshot[key]);
    }
    assert.equal(snapshot.mainMatrix[0], Math.fround(1 / 3));
    assert.equal(f.calls(), 1);
    lease.close();
  }
});

test('logical origin caching survives branded origin eviction without another native call', () => {
  const f = fixture(); f.setLayout({ revision: 2, tileZoom: 10, centerLongitude: 0 });
  let calls = 0;
  f.input.projectionFor = origin => {
    calls++;
    const size = 2 ** origin.tile.z;
    return { ...f.source, tileMercatorCoords: [origin.tile.x / size, origin.tile.y / size, 1 / (8192 * size), 1 / (8192 * size)] };
  };
  const first = f.services.frameFor(at(179.8)), lease = createGeographicFrameLease(f.input);
  const captured = lease.frame.geographic.captureProjection(first);
  for (let index = 0; index < 512; index++) f.services.frameFor(at(-179 + index * 0.5));
  const recreated = f.services.frameFor(at(179.8));
  assert.notEqual(first, recreated);
  assert.deepEqual(first.tile, recreated.tile);
  assert.deepEqual(lease.frame.geographic.captureProjection(recreated), captured);
  lease.frame.geographic.shader(first);
  assert.equal(calls, 1);
  lease.close();
});

test('same-origin provider reentry poisons the entry even when the provider swallows the error', () => {
  const f = fixture(), origin = f.services.frameFor(at());
  let calls = 0, lease;
  f.input.projectionFor = () => {
    calls++;
    if (calls > 1) throw new Error('Repeated provider call');
    assert.throws(() => lease.frame.geographic.captureProjection(origin));
    return f.source;
  };
  lease = createGeographicFrameLease(f.input);
  assert.throws(() => lease.frame.geographic.captureProjection(origin));
  assert.throws(() => lease.frame.geographic.shader(origin));
  assert.equal(calls, 1);
  lease.close();
});

test('provider throw or invalid numeric data cannot be retried within the same callback', () => {
  for (const failure of ['throw', 'coefficients', 'overflow']) {
    const f = fixture(), origin = f.services.frameFor(at());
    let calls = 0;
    f.input.projectionFor = () => {
      calls++;
      if (failure === 'throw') throw new Error('Native projection unavailable');
      if (failure === 'coefficients') f.source.tileMercatorCoords[2] = 1;
      if (failure === 'overflow') f.source.mainMatrix[0] = 1e100;
      return f.source;
    };
    const lease = createGeographicFrameLease(f.input);
    assert.throws(() => lease.frame.geographic.captureProjection(origin));
    assert.throws(() => lease.frame.geographic.shader(origin));
    assert.throws(() => lease.frame.geographic.captureProjection(origin));
    assert.equal(calls, 1);
    lease.close();
  }
});

test('closing or changing the view, root or layout during capture cannot publish a snapshot', () => {
  for (const change of ['close', 'view', 'root', 'layout']) {
    const f = fixture(), origin = f.services.frameFor(at());
    let calls = 0, lease;
    f.input.projectionFor = () => {
      calls++;
      if (change === 'close') lease.close();
      if (change === 'view') f.expireFrame();
      if (change === 'root') f.expireRoot();
      if (change === 'layout') f.setLayout({ revision: 2, tileZoom: 0, centerLongitude: 0 });
      return f.source;
    };
    lease = createGeographicFrameLease(f.input);
    assert.throws(() => lease.frame.geographic.captureProjection(origin));
    assert.throws(() => lease.frame.geographic.captureProjection(origin));
    assert.equal(calls, 1);
    lease.close();
  }
});

test('stale and foreign origins reject before native capture, including cache hits', () => {
  for (const change of ['view', 'root', 'layout']) {
    const f = fixture(), origin = f.services.frameFor(at());
    const lease = createGeographicFrameLease(f.input);
    const historical = lease.frame.geographic.captureProjection(origin);
    if (change === 'view') f.expireFrame();
    if (change === 'root') f.expireRoot();
    if (change === 'layout') f.setLayout({ revision: 2, tileZoom: 1, centerLongitude: 0 });
    assert.throws(() => lease.frame.geographic.captureProjection(origin));
    assert.equal(f.calls(), 1);
    assert.equal(projection.evaluateSceneProjection(at(), projection.compileProjectionSnapshot(historical)).status, 'projected');
    lease.close();
  }
  const f = fixture(), other = fixture(), lease = createGeographicFrameLease(f.input);
  assert.throws(() => lease.frame.geographic.captureProjection(other.services.frameFor(at())));
  assert.throws(() => lease.frame.geographic.captureProjection(structuredClone(f.services.frameFor(at()))));
  assert.equal(f.calls(), 0);
  lease.close();
});

test('uploaded zero globeness uses the Mercator horizon convention in snapshot and shader', () => {
  const f = fixture(), origin = f.services.frameFor(at());
  f.source.projectionTransition = 1e-100;
  const lease = createGeographicFrameLease(f.input);
  const snapshot = lease.frame.geographic.captureProjection(origin);
  assert.equal(snapshot.projectionTransition, 0);
  assert.equal(lease.frame.geographic.shader(origin).horizonMode, 'none');
  lease.close();
});

test('encoding cannot bypass the raw evaluator nearest-world-copy policy', () => {
  const f = fixture();
  f.setLayout({ revision: 2, tileZoom: 0, centerLongitude: 180 });
  const origin = f.services.frameFor(at(1)), point = f.services.resolve(at(-1));
  assert.equal(origin.tile.wrap, 0);
  const lease = createGeographicFrameLease(f.input);
  const snapshot = lease.frame.geographic.captureProjection(origin);
  assert.equal(projection.evaluateSceneProjection(point, projection.compileProjectionSnapshot(snapshot)).status, 'origin-needed');
  assert.throws(() => lease.frame.geographic.encode(point, origin));
  assert.doesNotThrow(() => lease.frame.geographic.encode(point, f.services.frameFor(at(-1))));
  lease.close();
});
