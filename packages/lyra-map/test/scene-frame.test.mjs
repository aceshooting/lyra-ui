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

function fixture(options = {}) {
  let epochCurrent = true, frameCurrent = true;
  let layout = { revision: 1, tileZoom: 0, centerLongitude: 0 };
  let calls = 0;
  const epochInput = { epoch: 1, isCurrent: () => epochCurrent, layout: () => layout };
  if (Object.hasOwn(options, 'resolveTerrain')) {
    Object.defineProperty(epochInput, 'resolveTerrain', Object.getOwnPropertyDescriptor(options, 'resolveTerrain'));
  }
  const services = createEpochGeographicServices(epochInput);
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

const terrainAt = (longitude = 0, latitude = 0, altitude = 0) => ({ ...at(longitude, latitude, altitude), altitudeReference: 'terrain' });
const terrainOperations = ['epoch.resolve', 'frame.resolve', 'frame.project'];
function terrainOperation(f, lease, operation, position = terrainAt()) {
  return operation === 'epoch.resolve' ? f.services.resolve(position) :
    lease.frame.geographic[operation === 'frame.resolve' ? 'resolve' : 'project'](position);
}

for (const [height, offset] of [[125.5, 7], [-40.25, -6], [0, 0]]) {
  test(`terrain height ${height} adds authored altitude ${offset} once in epoch, frame and projection services`, () => {
    let samples = 0;
    const f = fixture({ resolveTerrain() { samples++; return { status: 'resolved', height }; } });
    const position = terrainAt(0, 0, offset), resolved = { lngLat: [0, 0], altitude: height + offset, status: 'resolved' };
    const origin = f.services.frameFor(position), lease = createGeographicFrameLease(f.input);
    assert.equal(samples, 0, 'origin partitioning does not sample terrain');
    assert.deepEqual(f.services.resolve(position), resolved);
    const frameResolved = lease.frame.geographic.resolve(position);
    assert.deepEqual(frameResolved, resolved);
    assert.equal(Object.isFrozen(frameResolved), true); assert.equal(Object.isFrozen(frameResolved.lngLat), true);
    assert.equal(lease.frame.geographic.encode(frameResolved, origin)[2], height + offset);
    assert.deepEqual(lease.frame.geographic.project(position),
      lease.frame.geographic.project({ ...at(0, 0, height + offset), altitudeReference: 'sea-level' }));
    assert.equal(samples, 3); assert.equal(f.calls(), 1);
    lease.close();
  });
}

test('terrain resolver receives only frozen canonical coordinates and a copied current layout', () => {
  const layout = { revision: 2, tileZoom: 3, centerLongitude: 540 }, position = terrainAt(540, 20, 3);
  let argumentsSeen;
  const f = fixture({ resolveTerrain(...args) { argumentsSeen = args; return { status: 'resolved', height: 12 }; } });
  f.setLayout(layout);
  const resolved = f.services.resolve(position);
  assert.deepEqual(argumentsSeen, [[-180, 20], layout]); assert.equal(argumentsSeen.length, 2);
  assert.equal(argumentsSeen[0] === position.lngLat, false); assert.equal(argumentsSeen[1] === layout, false);
  assert.equal(Object.isFrozen(argumentsSeen[0]), true); assert.equal(Object.isFrozen(argumentsSeen[1]), true);
  position.lngLat[0] = 1; layout.centerLongitude = 0;
  assert.deepEqual(argumentsSeen, [[-180, 20], { revision: 2, tileZoom: 3, centerLongitude: 540 }]);
  assert.deepEqual(resolved, { lngLat: [-180, 20], altitude: 15, status: 'resolved' });
});

test('terrain altitude defaults to zero and absolute references never invoke the terrain resolver', () => {
  let samples = 0;
  const f = fixture({ resolveTerrain() { samples++; return { status: 'resolved', height: -12 }; } });
  const lease = createGeographicFrameLease(f.input), position = { lngLat: [0, 0], altitudeReference: 'terrain' };
  assert.deepEqual(f.services.resolve(position), { lngLat: [0, 0], altitude: -12, status: 'resolved' });
  assert.deepEqual(lease.frame.geographic.resolve(position), { lngLat: [0, 0], altitude: -12, status: 'resolved' });
  for (const absolute of [at(0, 0, 9), { ...at(0, 0, 9), altitudeReference: 'sea-level' }]) {
    assert.equal(f.services.resolve(absolute).altitude, 9);
    assert.equal(lease.frame.geographic.resolve(absolute).altitude, 9);
    lease.frame.geographic.project(absolute);
  }
  assert.equal(samples, 2); lease.close();
});

for (const status of ['terrain-pending', 'terrain-unavailable']) {
  test(`${status} remains unresolved in every geographic service without native projection`, () => {
    let samples = 0;
    const f = fixture({ resolveTerrain() { samples++; return { status }; } });
    const lease = createGeographicFrameLease(f.input), position = terrainAt(12, 20, 7);
    assert.deepEqual(f.services.resolve(position), { lngLat: [12, 20], status });
    assert.deepEqual(lease.frame.geographic.resolve(position), { lngLat: [12, 20], status });
    assert.deepEqual(lease.frame.geographic.project(position), { visible: false, status });
    assert.equal(samples, 3); assert.equal(f.calls(), 0); lease.close();
  });
}

test('missing terrain resolver keeps terrain unavailable in epoch and frame resolution', () => {
  const f = fixture({ resolveTerrain: undefined }), lease = createGeographicFrameLease(f.input);
  for (const operation of terrainOperations) {
    const value = terrainOperation(f, lease, operation);
    assert.equal(value.status, 'terrain-unavailable'); assert.equal(Object.hasOwn(value, 'altitude'), false);
  }
  assert.equal(f.calls(), 0); lease.close();
});

test('terrain-pending origins use canonical geography and the selected layout wrap without resolving height', () => {
  let samples = 0;
  const f = fixture({ resolveTerrain() { samples++; return { status: 'terrain-pending' }; } });
  f.setLayout({ revision: 2, tileZoom: 2, centerLongitude: 180 });
  const origin = f.services.frameFor(terrainAt(-179, 0, 27));
  assert.deepEqual(origin.tile, { z: 2, x: 0, y: 2, wrap: 1 });
  assert.equal(origin, f.services.frameFor(at(-179, 0, -12)));
  assert.equal(samples, 0); assert.equal(f.calls(), 0);
});

for (const [label, result] of [['null', null], ['missing status', {}], ['unknown status', { status: 'ready', height: 0 }],
  ['missing height', { status: 'resolved' }], ['NaN height', { status: 'resolved', height: NaN }],
  ['infinite height', { status: 'resolved', height: Infinity }], ['negative infinite height', { status: 'resolved', height: -Infinity }],
  ['string height', { status: 'resolved', height: '12' }],
  ['inherited result', Object.create({ status: 'resolved', height: 0 })]]) {
  test(`terrain resolver refuses ${label} before resolution or projection can succeed`, () => {
    for (const operation of terrainOperations) {
      let samples = 0;
      const f = fixture({ resolveTerrain() { samples++; return result; } }), lease = createGeographicFrameLease(f.input);
      assert.throws(() => terrainOperation(f, lease, operation), TypeError);
      assert.equal(samples, 1); assert.equal(f.calls(), 0); lease.close();
    }
  });
}

for (const member of ['status', 'height']) {
  test(`terrain result ${member} accessors are rejected without getter execution`, () => {
    for (const operation of terrainOperations) {
      let reads = 0, samples = 0;
      const result = { status: 'resolved', height: 12 };
      Object.defineProperty(result, member, { get() { reads++; throw new Error('result getter contents'); } });
      const f = fixture({ resolveTerrain() { samples++; return result; } }), lease = createGeographicFrameLease(f.input);
      assert.throws(() => terrainOperation(f, lease, operation), TypeError);
      assert.equal(samples, 1); assert.equal(reads, 0); assert.equal(f.calls(), 0); lease.close();
    }
  });
}

test('terrain resolver admission rejects accessors and nonfunction capabilities', () => {
  let reads = 0;
  const options = {};
  Object.defineProperty(options, 'resolveTerrain', { get() { reads++; throw new Error('resolver getter contents'); } });
  assert.throws(() => fixture(options), TypeError); assert.equal(reads, 0);
  for (const resolveTerrain of [null, false, 42, 'resolve', {}]) assert.throws(() => fixture({ resolveTerrain }), TypeError);
});

for (const operation of terrainOperations) {
  for (const invalidate of operation === 'epoch.resolve' ? ['expireEpoch', 'layout'] : ['expireEpoch', 'expireFrame', 'layout', 'close']) {
    test(`${operation} rejects terrain results after resolver reentry changes ${invalidate}`, () => {
      let lease, f, samples = 0;
      f = fixture({ resolveTerrain() {
        samples++;
        if (invalidate === 'layout') f.setLayout({ revision: 2, tileZoom: 1, centerLongitude: 360 });
        else if (invalidate === 'close') lease.close();
        else f[invalidate]();
        return { status: 'resolved', height: 12 };
      } });
      lease = createGeographicFrameLease(f.input);
      assert.throws(() => terrainOperation(f, lease, operation), TypeError);
      assert.equal(samples, 1); assert.equal(f.calls(), 0); lease.close();
    });
  }
}

for (const operation of terrainOperations) {
  test(`${operation} refuses stale terrain work before calling the resolver`, () => {
    let samples = 0;
    const f = fixture({ resolveTerrain() { samples++; return { status: 'resolved', height: 0 }; } });
    const lease = createGeographicFrameLease(f.input);
    if (operation === 'epoch.resolve') f.expireEpoch(); else lease.close();
    assert.throws(() => terrainOperation(f, lease, operation), TypeError);
    assert.equal(samples, 0); assert.equal(f.calls(), 0); lease.close();
  });

  test(`${operation} cannot publish a terrain result when the resolver throws`, () => {
    let samples = 0;
    const f = fixture({ resolveTerrain() { samples++; throw new Error('terrain callback contents'); } });
    const lease = createGeographicFrameLease(f.input);
    assert.throws(() => terrainOperation(f, lease, operation));
    assert.equal(samples, 1); assert.equal(f.calls(), 0); lease.close();
  });
}

for (const operation of terrainOperations) {
  for (const invalidate of operation === 'epoch.resolve' ? ['expireEpoch', 'layout'] : ['expireEpoch', 'expireFrame', 'layout', 'close']) {
    test(`${operation} refuses terrain callbacks invalidated during position descriptor reads by ${invalidate}`, () => {
      let samples = 0, invalidated = false;
      const f = fixture({ resolveTerrain() { samples++; return { status: 'resolved', height: 12 }; } });
      const lease = createGeographicFrameLease(f.input);
      const position = new Proxy(terrainAt(), {
        getOwnPropertyDescriptor(target, key) {
          if (!invalidated && key === 'lngLat') {
            invalidated = true;
            if (invalidate === 'layout') f.setLayout({ revision: 2, tileZoom: 1, centerLongitude: 360 });
            else if (invalidate === 'close') lease.close();
            else f[invalidate]();
          }
          return Reflect.getOwnPropertyDescriptor(target, key);
        }
      });
      assert.throws(() => terrainOperation(f, lease, operation, position), TypeError);
      assert.equal(invalidated, true); assert.equal(samples, 0); assert.equal(f.calls(), 0); lease.close();
    });
  }
}
