import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, PerspectiveCamera, Scene } from 'three';
import { admitModel } from '../dist/model/admission.js';
import { parseModel } from '../dist/model/model-parsers.js';
import { createModelEngine } from '../dist/model/engine.js';
import { DEFAULT_ORBIT_CAMERA, orbitCameraPose, projectOrbitPoint } from '../dist/core/orbit.js';
import { DEFAULT_LYRA_3D_STYLE, resolveLyra3dStyle } from '../dist/core/style.js';

const utf8 = (text) => new TextEncoder().encode(text);
const input = () => ({ format: 'obj', bytes: utf8('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n') });
const wait = () => new Promise((resolve) => setImmediate(resolve));
async function model() { const data = input(); return parseModel(admitModel(data.bytes, data.format)); }
function harness(delayed = false) {
  const events = []; const pending = []; const frames = new Set(); let callbacks; let options; let releases = 0;
  const world = new Group(); world.scale.y = -1; const scene = new Scene(); scene.add(world);
  const viewport = { world, scene, pickWorld: new Group(), canvas: {}, width: 640, height: 480, camera: new PerspectiveCamera(45, 640 / 480, 0.01, 1e8),
    orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), lost: false, disposed: false,
    setOrbit(value) { this.orbit = value; const pose = orbitCameraPose(value); this.camera.position.fromArray(pose.position); this.camera.up.fromArray(pose.up); this.camera.lookAt(...pose.target); this.camera.updateMatrixWorld(); },
    setStyle(value) { this.style = resolveLyra3dStyle(value); return this.style; }, invalidate() {},
    onFrame(callback) { frames.add(callback); return () => frames.delete(callback); },
    resize(width, height) { this.width = width; this.height = height; }, pickAt() { return 1; },
    project(point) { return projectOrbitPoint(point, this.orbit, this); }, dispose() { releases++; this.disposed = true; },
  };
  viewport.setOrbit(DEFAULT_ORBIT_CAMERA);
  const host = { progress(loaded, total) { events.push(['progress', loaded, total]); }, hover(value) { events.push(['hover', value]); }, pick(value) { events.push(['pick', value]); }, camera(value) { events.push(['camera', value]); }, lost(reason, detail) { events.push(['lost', reason, detail]); }, restored() { events.push(['restored']); }, rendering(value) { events.push(['rendering', value]); } };
  const services = { viewport(_container, nextHost, nextOptions) { callbacks = nextHost; options = nextOptions; return viewport; } };
  if (delayed) services.parse = (receipt, options) => new Promise((resolve, reject) => pending.push({ receipt, options, resolve, reject }));
  const engine = createModelEngine(services);
  return { engine, host, events, pending, viewport, frames, callbacks: () => callbacks, options: () => options, releases: () => releases };
}

test('model engine admits synchronously and preserves its prior scene on invalid or failed replacement', async () => {
  const h = harness(true); await h.engine.mount({}, h.host);
  const first = await model(); h.engine.setData(input(), 0); h.pending[0].resolve(first); await wait();
  assert.equal(first.object.parent, h.viewport.world);
  assert.throws(() => h.engine.setData({ format: 'obj', bytes: utf8('mtllib external.mtl') }, 1));
  assert.equal(first.object.parent, h.viewport.world); assert.equal(h.pending.length, 1);
  h.engine.setData(input(), 1); h.pending[1].reject(new Error('Parser rejected')); await wait();
  assert.equal(first.object.parent, h.viewport.world); assert.equal(h.events.filter((event) => event[0] === 'lost').length, 1);
  h.engine.dispose(); assert.equal(h.releases(), 1);
});

test('obsolete and disconnected parser completions dispose without replacing current data or emitting failures', async () => {
  const h = harness(true); await h.engine.mount({}, h.host);
  const obsolete = await model(); let obsoleteDisposed = 0; obsolete.object.children[0].geometry.addEventListener('dispose', () => obsoleteDisposed++);
  h.engine.setData(input(), 0); h.engine.setData(input(), 1); assert.equal(h.pending[0].options.signal.aborted, true);
  const current = await model(); h.pending[1].resolve(current); await wait(); h.pending[0].resolve(obsolete); await wait();
  assert.equal(current.object.parent, h.viewport.world); assert.equal(obsoleteDisposed, 1);
  h.engine.setData(input(), 2); h.engine.dispose(); h.engine.dispose(); const late = await model(); let lateDisposed = 0;
  late.object.children[0].geometry.addEventListener('dispose', () => lateDisposed++); h.pending[2].resolve(late); await wait();
  assert.equal(lateDisposed, 1); assert.equal(h.releases(), 1); assert.equal(h.events.filter((event) => event[0] === 'lost').length, 0);
});

test('mesh fit, focus, selection and context restoration preserve owned model state', async () => {
  const h = harness(); h.engine.setData(input(), 0); await wait(); await h.engine.mount({}, h.host); await wait();
  assert.deepEqual(h.engine.positionOf(0), { x: 0.5, y: 0.5, z: 0 }); assert.equal(h.engine.positionOf(1), null);
  const camera = h.engine.fit(); assert.deepEqual(camera.target, { x: 0.5, y: 0.5, z: 0 });
  assert.deepEqual(h.engine.focus(0).target, camera.target); assert.ok(h.engine.project(0));
  h.engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, accent: '#ff0000', focus: '#00ff00' });
  h.engine.setState({ selected: new Set([0]), dimmed: new Set(), hover: -1, focus: -1 });
  const mesh = h.viewport.world.children[0].children[0]; assert.equal(mesh.material.color.r, 1); assert.equal(mesh.material.color.g, 0);
  h.callbacks().lost('context-lost'); h.options().onRestore?.(); h.callbacks().restored();
  assert.equal(h.engine.positionOf(0).x, 0.5); assert.deepEqual(h.events.filter((event) => event[0] === 'restored'), [['restored']]);
  h.engine.dispose(); assert.equal(h.frames.size, 0);
});

test('pure point clouds delegate row picking and linear colors without disposing the shared viewport', async () => {
  const h = harness(); await h.engine.mount({}, h.host);
  h.engine.setData({ format: 'xyz', bytes: utf8('0 0 0 128 128 128\n1 2 3 255 0 0\n') }, 0); await wait();
  assert.deepEqual(h.engine.positionOf(1), { x: 1, y: 2, z: 3 }); assert.equal(h.engine.pick(0, 0), 1);
  const pointMesh = h.viewport.world.children.find((child) => child.geometry?.getAttribute('pointColor'));
  assert.ok(pointMesh); assert.ok(Math.abs(pointMesh.geometry.getAttribute('pointColor').array[0] - 0.2158605) < 1e-6);
  let pointsDisposed = 0; pointMesh.geometry.addEventListener('dispose', () => pointsDisposed++);
  h.engine.setData(input(), 1); await wait(); assert.equal(pointsDisposed, 1); assert.equal(h.releases(), 0);
  h.engine.dispose(); assert.equal(h.releases(), 1);
});

test('camera and revision writes stay silent and mount/dispose lifecycle is bounded', async () => {
  const h = harness(); h.engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, distance: 100 }); await h.engine.mount({}, h.host);
  h.engine.setData(input(), 0); await wait(); assert.equal(h.viewport.orbit.distance, 100);
  assert.throws(() => h.engine.setData(input(), 0)); assert.throws(() => h.engine.setData(input(), NaN));
  await assert.rejects(h.engine.mount({}, h.host)); assert.equal(h.events.filter((event) => event[0] === 'camera').length, 0);
  h.engine.dispose(); h.engine.setData(input(), 1); assert.equal(h.releases(), 1);
});

test('indexed glTF point clouds preserve index order and linear material tint', async () => {
  const h = harness(); await h.engine.mount({}, h.host);
  const bytes = new Uint8Array(26); bytes.set(new Uint8Array(new Float32Array([1, 2, 3, 4, 5, 6]).buffer)); bytes.set([1, 0], 24);
  const json = {
    asset: { version: '2.0' }, buffers: [{ byteLength: 26, uri: `data:application/octet-stream;base64,${Buffer.from(bytes).toString('base64')}` }],
    bufferViews: [{ buffer: 0, byteLength: 24 }, { buffer: 0, byteOffset: 24, byteLength: 2 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 2, type: 'VEC3', min: [1, 2, 3], max: [4, 5, 6] }, { bufferView: 1, componentType: 5121, count: 2, type: 'SCALAR' }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.5, 0.25, 1, 1] } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 0, material: 0 }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
  };
  h.engine.setData({ format: 'gltf', bytes: utf8(JSON.stringify(json)) }, 0); await wait();
  assert.deepEqual(h.engine.positionOf(0), { x: 4, y: 5, z: 6 }); assert.deepEqual(h.engine.positionOf(1), { x: 1, y: 2, z: 3 });
  const mesh = h.viewport.world.children.find((child) => child.geometry?.getAttribute('pointColor'));
  assert.ok(mesh); assert.deepEqual(Array.from(mesh.geometry.getAttribute('pointColor').array.slice(0, 3)), [0.5, 0.25, 1]);
  assert.equal(h.events.filter((event) => event[0] === 'lost').length, 0); h.engine.dispose();
});


test('pre-mount asynchronous failure reaches the eventual host and a newer revision clears it', async () => {
  const h = harness(true); h.engine.setData(input(), 0); h.pending[0].reject(new Error('Early failure')); await wait();
  await h.engine.mount({}, h.host);
  assert.deepEqual(h.events.filter((event) => event[0] === 'lost'), [['lost', 'error', 'model-parse-failed']]); h.engine.dispose();
  const fresh = harness(true); fresh.engine.setData(input(), 0); fresh.pending[0].reject(new Error('Early failure')); await wait();
  fresh.engine.setData(input(), 1); fresh.pending[1].resolve(await model()); await wait(); await fresh.engine.mount({}, fresh.host);
  assert.equal(fresh.events.filter((event) => event[0] === 'lost').length, 0); fresh.engine.dispose();
});

test('lit meshes retain neutral illumination for black foreground styles', async () => {
  const h = harness(); await h.engine.mount({}, h.host); h.engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, foreground: '#000000' });
  for (const light of h.viewport.scene.children.filter((child) => child.isLight)) assert.deepEqual(light.color.toArray(), [1, 1, 1]);
  h.engine.dispose();
});

test('mounting an older point model cannot overwrite a queued newer mesh completion', async () => {
  const h = harness(true); const points = await parseModel(admitModel(utf8('5 6 7\n'), 'xyz'));
  h.engine.setData(input(), 0); h.pending[0].resolve(points); await wait();
  const mesh = await model(); h.engine.setData(input(), 1); h.pending[1].resolve(mesh);
  await h.engine.mount({}, h.host); await wait();
  assert.equal(mesh.object.parent, h.viewport.world); assert.deepEqual(h.engine.positionOf(0), { x: 0.5, y: 0.5, z: 0 });
  assert.equal(h.viewport.world.children.some((child) => child.geometry?.getAttribute('pointColor')), false); h.engine.dispose();
});

test('immediate mesh picking uses the current logical camera before a viewport render', async () => {
  const h = harness(); await h.engine.mount({}, h.host); h.engine.setData(input(), 0); await wait();
  h.viewport.setOrbit = function (value) { this.orbit = value; };
  h.engine.setCamera({ yaw: 0, pitch: 0, distance: 4, target: { x: 0.2, y: 0.2, z: 0 } });
  assert.equal(h.engine.pick(320, 240), 0);
  h.engine.setCamera({ yaw: 0, pitch: 0, distance: 4, target: { x: 100, y: 100, z: 0 } });
  assert.equal(h.engine.pick(320, 240), null); h.engine.dispose();
});

test('indexed point expansion above the row cap stays a bounded standard drawable', async () => {
  const h = harness(true); await h.engine.mount({}, h.host);
  const points = await parseModel(admitModel(utf8('5 6 7\n'), 'xyz')); points.object.geometry.setIndex([0]);
  points.object.geometry.index.count = 1_000_001;
  h.engine.setData(input(), 0); h.pending[0].resolve(points); await wait();
  assert.equal(points.object.parent, h.viewport.world); assert.equal(h.viewport.world.children.some((child) => child.geometry?.getAttribute('pointColor')), false);
  assert.equal(h.events.filter((event) => event[0] === 'lost').length, 0); h.engine.dispose();
});

test('state overrides ignore authored paint channels and dispose every shared-image texture alias', async () => {
  const original = { bitmap: globalThis.createImageBitmap, self: globalThis.self }; let closed = 0;
  globalThis.self = globalThis; globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() { closed++; } });
  const h = harness();
  try {
    await h.engine.mount({}, h.host);
    const binary = new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]).buffer);
    const json = {
      asset: { version: '2.0' }, buffers: [{ byteLength: binary.length, uri: `data:application/octet-stream;base64,${Buffer.from(binary).toString('base64')}` }],
      bufferViews: [{ buffer: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 36 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' }],
      images: [{ uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==' }],
      samplers: [{ magFilter: 9728 }, { magFilter: 9729 }], textures: [{ source: 0, sampler: 0 }, { source: 0, sampler: 1 }],
      materials: [0, 1].map((index) => ({ pbrMetallicRoughness: { baseColorTexture: { index } }, emissiveFactor: [0, 0, 1] })),
      meshes: [0, 1].map((material) => ({ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, material }] })),
      nodes: [{ mesh: 0 }, { mesh: 1, translation: [2, 0, 0] }], scenes: [{ nodes: [0, 1] }], scene: 0,
    };
    h.engine.setData({ format: 'gltf', bytes: utf8(JSON.stringify(json)) }, 0); await wait();
    const meshes = []; h.viewport.world.traverse((object) => { if (object.isMesh) meshes.push(object); }); assert.equal(meshes.length, 2);
    const materials = meshes.map((mesh) => mesh.material); const maps = new Set(materials.map((material) => material.map)); assert.equal(maps.size, 2);
    const disposals = new Map(); for (const map of maps) map.addEventListener('dispose', () => disposals.set(map, (disposals.get(map) ?? 0) + 1));
    h.engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, foreground: '#000000', accent: '#ff0000', forcedColors: true });
    assert.ok(meshes.every((mesh) => mesh.material.isMeshBasicMaterial && !mesh.material.vertexColors && !mesh.material.map));
    assert.deepEqual(meshes[0].material.color.toArray(), [0, 0, 0]);
    h.engine.setState({ selected: new Set([0]), dimmed: new Set(), hover: -1, focus: -1 });
    assert.deepEqual(meshes[0].material.color.toArray(), [1, 0, 0]);
    h.engine.setStyle(DEFAULT_LYRA_3D_STYLE); h.engine.setState({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });
    assert.ok(meshes.every((mesh, index) => mesh.material === materials[index]));
    h.engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, forcedColors: true }); h.engine.dispose();
    assert.equal(closed, 1); assert.ok([...maps].every((map) => disposals.get(map) === 1));
  } finally {
    h.engine.dispose(); if (original.bitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = original.bitmap;
    if (original.self === undefined) delete globalThis.self; else globalThis.self = original.self;
  }
});


test('a pre-mount successful parse reports completion once after mounting', async () => {
  const h = harness(true); h.engine.setData(input(), 0); h.pending[0].resolve(await model()); await wait();
  assert.equal(h.events.length, 0); await h.engine.mount({}, h.host);
  assert.equal(h.events.filter((event) => event[0] === 'progress').length, 1); h.engine.dispose();
});

test('glTF point vertex alpha and transparency remain on standard point materials', async () => {
  const h = harness(); await h.engine.mount({}, h.host);
  const bytes = new Uint8Array(new Float32Array([1, 2, 3, 1, 0, 0, 0]).buffer);
  const json = {
    asset: { version: '2.0' }, buffers: [{ byteLength: 28, uri: `data:application/octet-stream;base64,${Buffer.from(bytes).toString('base64')}` }],
    bufferViews: [{ buffer: 0, byteLength: 12 }, { buffer: 0, byteOffset: 12, byteLength: 16 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3', min: [1, 2, 3], max: [1, 2, 3] }, { bufferView: 1, componentType: 5126, count: 1, type: 'VEC4' }],
    materials: [{ alphaMode: 'BLEND' }], meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, material: 0, mode: 0 }] }],
    nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
  };
  h.engine.setData({ format: 'gltf', bytes: utf8(JSON.stringify(json)) }, 0); await wait();
  const points = []; h.viewport.world.traverse((object) => { if (object.isPoints) points.push(object); });
  assert.equal(points.length, 1); assert.equal(points[0].geometry.getAttribute('color').getW(0), 0);
  assert.equal(points[0].material.transparent, true); assert.equal(h.viewport.world.children.some((child) => child.geometry?.getAttribute('pointColor')), false); h.engine.dispose();
});
