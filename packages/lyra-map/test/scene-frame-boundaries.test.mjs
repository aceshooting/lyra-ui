import assert from 'node:assert/strict';
import test from 'node:test';
import { createEpochGeographicServices, createGeographicFrameLease } from '../src/scene/frame.mjs';

const at = (longitude = 0, latitude = 0, altitude = 0) => ({ lngLat: [longitude, latitude], altitude });
const expired = { name: 'TypeError', message: 'Invalid or expired geographic frame.' };
const nativeProjection = () => ({
  shaderData: { variantName: 'mercator', vertexShaderPrelude: 'vec4 projectTileFor3D(vec2 p, float z) { return vec4(p, z, 1.0); }', define: '#define PROJECTION_MERCATOR' },
  mainMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  fallbackMatrix: [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 1 / 1000, 0, -1, 1, 0, 1],
  tileMercatorCoords: [0, 0, 1 / 8192, 1 / 8192],
  clippingPlane: [0, 0, 1, -1 / 3], projectionTransition: 0
});
const services = (layout, isCurrent = () => true) => createEpochGeographicServices({ epoch: 1, isCurrent, layout });

test('altitude references are a closed set', () => {
  const geographic = services(() => ({ revision: 1, tileZoom: 0, centerLongitude: 0 }));
  for (const altitudeReference of ['ground', 'Terrain', null, 0]) {
    assert.throws(() => geographic.resolve({ ...at(), altitudeReference }), expired);
  }
  assert.equal(geographic.resolve({ ...at(), altitudeReference: 'sea-level' }).status, 'resolved');
});

test('layouts must carry a positive revision, a supported zoom and a bounded centre', () => {
  for (const layout of [{ revision: 0, tileZoom: 0, centerLongitude: 0 }, { revision: 1.5, tileZoom: 0, centerLongitude: 0 },
    { revision: 1, tileZoom: -1, centerLongitude: 0 }, { revision: 1, tileZoom: 31, centerLongitude: 0 },
    { revision: 1, tileZoom: 0.5, centerLongitude: 0 }, { revision: 1, tileZoom: 0, centerLongitude: Number.NaN },
    { revision: 1, tileZoom: 0, centerLongitude: 360000001 }, { revision: 1, tileZoom: 0, centerLongitude: -360000001 }, null]) {
    assert.throws(() => services(() => layout), expired);
  }
  assert.doesNotThrow(() => services(() => ({ revision: 1, tileZoom: 30, centerLongitude: -360000000 })));
});

test('an epoch that expires while its layout is read is refused', () => {
  let current = true, reads = 0;
  const geographic = services(() => { if (++reads > 1) current = false; return { revision: 1, tileZoom: 0, centerLongitude: 0 }; }, () => current);
  assert.throws(() => geographic.resolve(at()), expired);
});

test('a frame origin is refused when the layout changes while it is chosen', () => {
  let revision = 1, moving = false;
  const geographic = services(() => ({ revision: moving ? revision++ : revision, tileZoom: 2, centerLongitude: 0 }));
  assert.deepEqual(geographic.frameFor(at(10)).tile, { z: 2, x: 2, y: 2, wrap: 0 });
  moving = true;
  assert.throws(() => geographic.frameFor(at(10)), expired);
});

test('a frame encodes only positions resolved to an absolute altitude', () => {
  const geographic = services(() => ({ revision: 1, tileZoom: 0, centerLongitude: 0 }));
  const origin = geographic.frameFor(at());
  const lease = createGeographicFrameLease({ epoch: 1, revision: 2, time: 0, width: 200, height: 100, pixelRatio: 1,
    reducedMotion: false, services: geographic, isCurrent: () => true, projectionFor: () => nativeProjection() });
  try {
    const pending = geographic.resolve({ ...at(), altitudeReference: 'terrain' });
    assert.equal(pending.status, 'terrain-unavailable');
    assert.throws(() => lease.frame.geographic.encode(pending, origin), expired);
    assert.throws(() => lease.frame.geographic.encode({ ...at(), status: 'terrain-pending' }, origin), expired);
    assert.deepEqual(lease.frame.geographic.encode(geographic.resolve(at(0, 0, 5)), origin), [4096, 4096, 5]);
  } finally { lease.close(); }
});
