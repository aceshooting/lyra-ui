import assert from 'node:assert/strict';
import test from 'node:test';
import { createEpochGeographicServices, createGeographicFrameLease } from '../src/scene/frame.mjs';

const at = (longitude = 0, latitude = 0, altitude = 0) => ({ lngLat: [longitude, latitude], altitude });
const nativeProjection = () => ({
  shaderData: { variantName: 'mercator', vertexShaderPrelude: 'vec4 projectTileFor3D(vec2 p, float z) { return vec4(p, z, 1.0); }', define: '#define PROJECTION_MERCATOR' },
  mainMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  fallbackMatrix: [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 1 / 1000, 0, -1, 1, 0, 1],
  tileMercatorCoords: [0, 0, 1 / 8192, 1 / 8192],
  clippingPlane: [0, 0, 1, -1 / 3], projectionTransition: 0
});

function fixture() {
  let epochCurrent = true, frameCurrent = true;
  let layout = { revision: 1, tileZoom: 0, centerLongitude: 0 };
  let calls = 0;
  const services = createEpochGeographicServices({ epoch: 1, isCurrent: () => epochCurrent, layout: () => layout });
  const source = nativeProjection();
  const input = { epoch: 1, revision: 2, time: 123, width: 200, height: 100, pixelRatio: 2,
    reducedMotion: false, services, isCurrent: () => frameCurrent,
    projectionFor: () => { calls++; return source; } };
  return { services, source, input, calls: () => calls,
    expireEpoch() { epochCurrent = false; }, expireFrame() { frameCurrent = false; },
    setLayout(value) { layout = value; } };
}

test('absolute resolution owns data and terrain stays explicitly unavailable', () => {
  const f = fixture();
  const position = at(360, 0, 27);
  const resolved = f.services.resolve(position);
  position.lngLat[0] = 90;
  assert.deepEqual(resolved, { lngLat: [0, 0], altitude: 27, status: 'resolved' });
  assert.ok(Object.isFrozen(resolved) && Object.isFrozen(resolved.lngLat));
  const terrain = f.services.resolve({ ...at(12, 20, 7), altitudeReference: 'terrain' });
  assert.deepEqual(terrain, { lngLat: [12, 20], status: 'terrain-unavailable' });
  assert.equal(f.calls(), 0);
  assert.deepEqual(f.services.fromEnu(resolved, [0, 0, 0]), at(0, 0, 27));
});

test('origins select canonical tiles and nearest wrapped copies with the lower tie', () => {
  const f = fixture();
  f.setLayout({ revision: 2, tileZoom: 2, centerLongitude: 180 });
  assert.deepEqual(f.services.frameFor(at(-179)).tile, { z: 2, x: 0, y: 2, wrap: 1 });
  assert.deepEqual(f.services.frameFor(at(179)).tile, { z: 2, x: 3, y: 2, wrap: 0 });
  f.setLayout({ revision: 3, tileZoom: 0, centerLongitude: 0 });
  assert.equal(f.services.frameFor(at(-180)).tile.wrap, 0);
});

test('a frame copies metadata, encodes meters and keeps completed depth unresolved', () => {
  const f = fixture();
  const origin = f.services.frameFor(at());
  const lease = createGeographicFrameLease(f.input);
  f.input.width = 999;
  assert.equal(lease.frame.width, 200);
  assert.equal(lease.frame.revision, 2);
  assert.equal(lease.frame.time, 123);
  assert.deepEqual(lease.frame.geographic.encode(f.services.resolve(at(0, 0, 25)), origin), [4096, 4096, 25]);
  const projected = lease.frame.geographic.project(at());
  assert.deepEqual(projected.point, [100, 50]);
  assert.equal(projected.visible, false);
  assert.equal(projected.status, 'visibility-pending');
  const terrain = lease.frame.geographic.project({ ...at(), altitudeReference: 'terrain' });
  assert.equal(terrain.status, 'terrain-unavailable');
  assert.equal(terrain.visible, false);
  lease.close();
});

test('shader snapshots copy native arrays, cache each origin and declare horizon composition', () => {
  const f = fixture();
  const origin = f.services.frameFor(at());
  const lease = createGeographicFrameLease(f.input);
  const shader = lease.frame.geographic.shader(origin);
  const savedUniforms = structuredClone(shader.uniforms);
  f.source.mainMatrix.fill(9);
  f.source.fallbackMatrix.fill(9);
  f.source.tileMercatorCoords.fill(9);
  f.source.shaderData.vertexShaderPrelude = 'changed';
  assert.deepEqual(lease.frame.geographic.shader(origin).uniforms, savedUniforms);
  assert.equal(f.calls(), 1);
  assert.equal(shader.positionEncoding, 'tile-xy-meters-z');
  assert.equal(shader.projectFunction, 'lrProjectPosition');
  assert.equal(shader.horizonPositionFunction, 'lrHorizonPosition');
  assert.equal(shader.horizonOccludedFunction, 'lrHorizonOccluded');
  assert.equal(shader.horizonMode, 'none');
  assert.ok(shader.vertexPrelude.includes('projectTileFor3D'));
  assert.ok(shader.fragmentPrelude.includes('lrHorizonOccluded'));
  assert.ok(Object.isFrozen(shader) && Object.isFrozen(shader.uniforms));
  for (const uniform of shader.uniforms) {
    assert.ok(Object.isFrozen(uniform));
    if (Array.isArray(uniform.value)) assert.ok(Object.isFrozen(uniform.value));
  }
  lease.close();
});

test('nonzero transition declares the sphere horizon convention', () => {
  const f = fixture();
  f.source.projectionTransition = 0.5;
  f.source.shaderData.variantName = 'globe';
  const lease = createGeographicFrameLease(f.input);
  assert.equal(lease.frame.geographic.shader(f.services.frameFor(at())).horizonMode, 'sphere');
  lease.close();
});

test('shader publication refuses finite doubles that overflow native Float32 uniforms', () => {
  for (const target of ['matrix', 'camera', 'tile']) {
    const f = fixture();
    if (target === 'matrix') f.source.mainMatrix[0] = 1e100;
    if (target === 'camera') {
      f.source.projectionTransition = 1;
      f.source.clippingPlane = [0, 0, 1, -1e-100];
    }
    if (target === 'tile') f.source.tileMercatorCoords[0] = 1e100;
    const origin = f.services.frameFor(at());
    const lease = createGeographicFrameLease(f.input);
    assert.throws(() => lease.frame.geographic.shader(origin));
    lease.close();
  }
});

test('closing a callback rejects every frame service without another native call', () => {
  const f = fixture();
  const origin = f.services.frameFor(at());
  const position = f.services.resolve(at());
  const lease = createGeographicFrameLease(f.input);
  lease.close(); lease.close();
  for (const work of [() => lease.frame.geographic.resolve(at()), () => lease.frame.geographic.project(at()),
    () => lease.frame.geographic.encode(position, origin), () => lease.frame.geographic.shader(origin)]) assert.throws(work);
  assert.equal(f.calls(), 0);
  assert.equal(f.services.resolve(at()).status, 'resolved');
});

test('stale callback, root epoch and layout reject before the native provider', () => {
  for (const invalidate of ['expireFrame', 'expireEpoch', 'layout']) {
    const f = fixture();
    const origin = f.services.frameFor(at());
    const lease = createGeographicFrameLease(f.input);
    if (invalidate === 'layout') f.setLayout({ revision: 2, tileZoom: 0, centerLongitude: 0 });
    else f[invalidate]();
    assert.throws(() => lease.frame.geographic.shader(origin));
    assert.throws(() => lease.frame.geographic.project(at()));
    assert.equal(f.calls(), 0);
    lease.close();
  }
});

test('foreign services, epochs, copied origins and stale epoch root methods reject', () => {
  const f = fixture(), other = fixture();
  const origin = f.services.frameFor(at());
  const lease = createGeographicFrameLease(f.input);
  assert.throws(() => createGeographicFrameLease({ ...f.input, services: { ...f.services } }));
  assert.throws(() => createGeographicFrameLease({ ...f.input, epoch: 2 }));
  for (const invalid of [structuredClone(origin), other.services.frameFor(at())]) {
    assert.throws(() => lease.frame.geographic.shader(invalid));
  }
  f.expireEpoch();
  assert.throws(() => f.services.resolve(at()));
  assert.throws(() => f.services.frameFor(at()));
  assert.throws(() => f.services.fromEnu({ ...at(), status: 'resolved' }, [0, 0, 0]));
  assert.equal(f.calls(), 0);
  lease.close();
});

test('reentrant native projection invalidation cannot publish a shader snapshot', () => {
  const f = fixture();
  const origin = f.services.frameFor(at());
  let lease;
  f.input.projectionFor = () => { lease.close(); return f.source; };
  lease = createGeographicFrameLease(f.input);
  assert.throws(() => lease.frame.geographic.shader(origin));
});

test('distant origins and native pole sentinel values require a fresh tile partition', () => {
  const f = fixture();
  f.setLayout({ revision: 2, tileZoom: 6, centerLongitude: 0 });
  const origin = f.services.frameFor(at(0, 80));
  const lease = createGeographicFrameLease(f.input);
  assert.throws(() => lease.frame.geographic.encode(f.services.resolve(at(0, -80)), origin));
  assert.deepEqual(lease.frame.geographic.encode(f.services.resolve(at(0, 80)), origin).slice(2), [0]);
  lease.close();
});
