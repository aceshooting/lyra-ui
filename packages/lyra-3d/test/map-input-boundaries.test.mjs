import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Matrix4 } from 'three';
import { snapshotSceneModels } from '../dist/map/admission.js';
import { deriveModelLighting } from '../dist/map/camera-lighting.js';
import { createModelPlacementTransform, placeModelVertex } from '../dist/map/model-placement.js';
import { createSceneResourceLedger } from '../dist/map/resource-ledger.js';

const model = (id = 'model', change = {}) => ({ id, label: 'Model', kind: 'model',
  position: { lngLat: [6, 49], altitude: 10 }, source: { format: 'glb', bytes: new Uint8Array([1, 2, 3]) }, ...change });

test('model snapshots reject non-list input and non-plain descriptor records', () => {
  for (const input of ['models', { length: 1, 0: model() }, null]) assert.throws(() => snapshotSceneModels(input), TypeError);
  assert.throws(() => snapshotSceneModels([null]), TypeError);
  assert.throws(() => snapshotSceneModels([7]), TypeError);
  assert.throws(() => snapshotSceneModels([Object.assign(Object.create({ inherited: true }), model())]), TypeError);
  assert.throws(() => snapshotSceneModels([model('position', { position: new (class Placement { lngLat = [0, 0]; })() })]), TypeError);
  const bare = Object.assign(Object.create(null), model('bare'));
  assert.equal(snapshotSceneModels([bare])[0].id, 'bare');
});

test('model longitudes wrap into [-180, 180) and the altitude reference is a closed set', () => {
  const [east, west, edge, antimeridian] = snapshotSceneModels([
    model('east', { position: { lngLat: [190, 10] } }), model('west', { position: { lngLat: [-200, 10] } }),
    model('edge', { position: { lngLat: [-180, 10] } }), model('anti', { position: { lngLat: [180, 10] } })]);
  assert.deepEqual(east.position.lngLat, [-170, 10]);
  assert.deepEqual(west.position.lngLat, [160, 10]);
  assert.deepEqual(edge.position.lngLat, [-180, 10]);
  assert.deepEqual(antimeridian.position.lngLat, [-180, 10]);
  assert.equal(east.position.altitudeReference, 'sea-level');
  const [terrain] = snapshotSceneModels([model('terrain', { position: { lngLat: [0, 0], altitudeReference: 'terrain' } })]);
  assert.equal(terrain.position.altitudeReference, 'terrain');
  for (const altitudeReference of ['ground', 'Terrain', 0]) {
    assert.throws(() => snapshotSceneModels([model('bad', { position: { lngLat: [0, 0], altitudeReference } })]), TypeError);
  }
});

test('model colors are optional bounded non-blank strings', () => {
  const [plain, colored] = snapshotSceneModels([model('plain'), model('colored', { color: '#f00' })]);
  assert.equal(Object.hasOwn(plain, 'color'), false);
  assert.equal(colored.color, '#f00');
  for (const color of [1, '   ', '', 'x'.repeat(257), null]) {
    assert.throws(() => snapshotSceneModels([model('bad', { color })]), TypeError);
  }
  assert.equal(snapshotSceneModels([model('long', { color: 'x'.repeat(256) })])[0].color.length, 256);
});

test('encoded model bytes share one aggregate ceiling across the whole snapshot', () => {
  const half = 32 * 1024 * 1024;
  const exact = snapshotSceneModels([model('a', { source: { format: 'glb', bytes: new Uint8Array(half) } }),
    model('b', { source: { format: 'glb', bytes: new Uint8Array(half) } })]);
  assert.equal(exact.length, 2);
  assert.throws(() => snapshotSceneModels([model('a', { source: { format: 'glb', bytes: new Uint8Array(half) } }),
    model('b', { source: { format: 'glb', bytes: new Uint8Array(half + 1) } })]), TypeError);
});

const radius = 6371008.8;
function perspective(eye, change = {}) {
  const projection = new Matrix4().makePerspective(-0.7, 1.1, 0.9, -0.6, 1, 100000);
  const affine = new Matrix4().makeRotationFromEuler(new Euler(0.3, -0.2, 0.1))
    .multiply(new Matrix4().makeScale(1 / 8192, -1 / 8192, 1 / 1000))
    .multiply(new Matrix4().makeTranslation(-eye[0], -eye[1], -eye[2]));
  return { nativeProjectionFamily: 'mercator', transition: 0,
    tile: { z: 0, x: 0, y: 0, wrap: 0 }, fallbackMatrix: projection.multiply(affine).elements,
    clippingPlane: [0, 0, 1, -1 / 3], anchor: { lngLat: [0, 0], altitude: 1000 }, ...change };
}

test('camera lighting rejects missing records and tile addresses outside the zoom pyramid', () => {
  assert.throws(() => deriveModelLighting(null), TypeError);
  for (const tile of [null, 'tile', { z: 31, x: 0, y: 0, wrap: 0 }, { z: -1, x: 0, y: 0, wrap: 0 },
    { z: 1, x: 2, y: 0, wrap: 0 }, { z: 1, x: 0, y: 2, wrap: 0 }, { z: 1, x: -1, y: 0, wrap: 0 },
    { z: 1, x: 0, y: -1, wrap: 0 }, { z: 0.5, x: 0, y: 0, wrap: 0 }, { z: 0, x: 0, y: 0, wrap: 1000001 }]) {
    assert.throws(() => deriveModelLighting(perspective([4096, 4096, 1100], { tile })), TypeError);
  }
  assert.ok(deriveModelLighting(perspective([4096, 4096, 1100], { tile: { z: 0, x: 0, y: 0, wrap: -1000000 } })).eyeEnu.every(Number.isFinite));
});

test('camera lighting rejects anchors beyond Web Mercator latitude and the altitude range', () => {
  for (const anchor of [{ lngLat: [0, 86], altitude: 0 }, { lngLat: [0, -86], altitude: 0 },
    { lngLat: [0, 0], altitude: -12001 }, { lngLat: [0, 0], altitude: 100000001 }]) {
    assert.throws(() => deriveModelLighting(perspective([4096, 4096, 1100], { anchor })), TypeError);
  }
  const low = deriveModelLighting(perspective([4096, 4096, 1100], { anchor: { lngLat: [0, 0], altitude: -12000 } }));
  assert.ok(Math.abs(low.eyeEnu[2] - 13100) < 1e-3);
});

test('a mercator eye below the centre of the sphere is not a usable camera', () => {
  assert.throws(() => deriveModelLighting(perspective([4096, 4096, -2 * radius])), TypeError);
});

test('globe transitions require a unit clipping plane facing a camera outside the sphere', () => {
  const globe = { nativeProjectionFamily: 'mercator-globe', transition: 0.5 };
  for (const clippingPlane of [[0, 0, 1, 0], [0, 0, 1, 0.5], [0, 0, 2, -0.5], [0, 0, 0.5, -0.5], [0, 0, 1, -2]]) {
    assert.throws(() => deriveModelLighting(perspective([4096, 4096, 1100], { ...globe, clippingPlane })), TypeError);
  }
  const outside = deriveModelLighting(perspective([4096, 4096, 1100], { ...globe, clippingPlane: [0, 0, 1, -0.5] }));
  assert.equal(outside.convention, 'sphere-eye');
  assert.ok(Math.abs(outside.eyeEnu[2] - (radius - 1000)) < 1e-3);
});

test('mercator inverses that overflow or cannot reproduce the eye fail closed', () => {
  const base = perspective([4096, 4096, 1100]);
  const inverseWith = (column) => {
    const inverse = new Matrix4(); inverse.elements.splice(8, 4, ...column);
    return inverse.invert().elements;
  };
  // A finite inverse whose homogeneous eye overflows when divided by its tiny w.
  assert.throws(() => deriveModelLighting({ ...base, fallbackMatrix: inverseWith([1e10, 0, 1, 1e-300]) }), TypeError);
  // A finite eye whose forward reprojection overflows to a non-finite clip coordinate.
  const overflow = [1, 1, 0, 0, 0, 1, 7.773676711518946e+25, 7.091753286682002e-284, 5.943584634538195e+256, 0, 1, 0, 0, 0, 0, 1];
  assert.throws(() => deriveModelLighting({ ...base, fallbackMatrix: overflow }), TypeError);
  // An ill-conditioned shear: the inverse eye no longer reprojects onto the clip-space axis.
  const residual = [1, 0, 0, 0, 2, 1, 0, 0, -741440801829560400, 0, 1, 3.5881446038490747e-112, 0, 0, 0, 1];
  assert.throws(() => deriveModelLighting({ ...base, fallbackMatrix: residual }), TypeError);
  const far = deriveModelLighting({ ...base, fallbackMatrix: inverseWith([0, 0, 1e8, 1e-300]) });
  assert.ok(far.eyeEnu.every(Number.isFinite) && Math.max(...far.eyeEnu.map(Math.abs)) > 1e300);
});

test('model placement rejects a null options record and sparse vertex tuples', () => {
  assert.throws(() => createModelPlacementTransform(null), TypeError);
  // eslint-disable-next-line no-sparse-arrays
  assert.throws(() => placeModelVertex([, 1, 2]), TypeError);
  // eslint-disable-next-line no-sparse-arrays
  assert.throws(() => createModelPlacementTransform({ orientation: [0, 0, , 1] }), TypeError);
  assert.deepEqual([...placeModelVertex([1, 2, 3])], [1, -3, 2]);
});

test('resource ledgers require a safe nonnegative cap and a named bounded allocation list', () => {
  for (const bytes of [-1, 1.5, '10', Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
    assert.throws(() => createSceneResourceLedger({ bytes }), TypeError);
  }
  assert.throws(() => createSceneResourceLedger(null), TypeError);
  const empty = createSceneResourceLedger({ bytes: 0 });
  empty.reserve('zero', [{ key: 'empty', bytes: 0 }]).release();
  assert.equal(empty.bytes, 0);
  const ledger = createSceneResourceLedger({ bytes: 10 });
  for (const [owner, allocations] of [['', []], [7, []], ['owner', 'allocations'], ['owner', { length: 0 }],
    ['owner', Array.from({ length: 100001 }, (_, index) => ({ key: `k${index}`, bytes: 0 }))]]) {
    assert.throws(() => ledger.reserve(owner, allocations), TypeError);
  }
  assert.equal(ledger.bytes, 0);
  const bounded = ledger.reserve('owner', Array.from({ length: 100000 }, () => ({ key: 'shared', bytes: 5 })));
  assert.equal(ledger.bytes, 5);
  bounded.release();
  assert.equal(ledger.bytes, 0);
});
