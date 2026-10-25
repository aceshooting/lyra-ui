import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Points, PointsMaterial, Texture, Vector3 } from 'three';
import { createModelEngine } from '../dist/model/engine.js';
import { waitUntil } from './wait-until.mjs';
import { installFakeBrowser } from './fake-browser.mjs';

const OBJ = new TextEncoder().encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
const data = (revision) => ({ data: { bytes: OBJ, format: 'obj' }, revision });
const state = (extra = {}) => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });

function triangleGeometry() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 10, 0, 0, 0, 10, 0], 3));
  return geometry;
}

/** A parsed model the engine installs as if a loader had produced it. */
function parsed(object, options = {}) {
  const record = { disposed: 0 };
  return {
    record,
    model: {
      object, bounds: options.bounds === undefined ? new Box3().setFromObject(object) : options.bounds,
      vertices: 3, indices: 0,
      dispose() { record.disposed += 1; if (options.disposeFails) throw new Error('parsed model release failed'); },
    },
  };
}

async function mounted(t, models, hostOverrides = {}) {
  const browser = installFakeBrowser();
  const queue = [...models];
  const engine = createModelEngine({ parse: async () => queue.shift() });
  t.after(() => {
    try { engine.dispose(); } finally { browser.restore(); }
  });
  const calls = { lost: [], progress: [] };
  const host = { hover() {}, pick() {}, camera() {}, lost: (reason, detail) => calls.lost.push({ reason, detail }), progress: (done, total) => calls.progress.push([done, total]), ...hostOverrides };
  await engine.mount(browser.container, host);
  engine.resize(400, 300);
  return { engine, browser, calls };
}

test('meshes with several materials keep their material array through highlighting and release', async (t) => {
  const geometry = triangleGeometry();
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(0, 3, 1);
  const originals = [new MeshStandardMaterial({ color: 0x336699 }), new MeshStandardMaterial({ color: 0x993366 })];
  const mesh = new Mesh(geometry, originals);
  const { record, model } = parsed(mesh);
  const { engine, browser } = await mounted(t, [model]);
  engine.setData(...Object.values(data(1)));
  await waitUntil(() => engine.positionOf(0) !== null, 'the model to install');
  assert.ok(Array.isArray(mesh.material) && mesh.material.length === 2);
  const painted = mesh.material.slice();
  const paintedDisposals = painted.map(() => 0);
  painted.forEach((material, index) => material.addEventListener('dispose', () => paintedDisposals[index]++));
  assert.ok(painted.every((material, index) => material !== originals[index]), 'the engine draws clones, never the loader\'s own materials');
  engine.setState(state({ selected: new Set([0]) }));
  assert.ok(Array.isArray(mesh.material) && mesh.material.every((material) => material instanceof MeshBasicMaterial), 'selection swaps in flat highlight materials');
  const highlights = mesh.material.slice();
  const highlightDisposals = highlights.map(() => 0);
  highlights.forEach((material, index) => material.addEventListener('dispose', () => highlightDisposals[index]++));
  engine.setState(state({ dimmed: new Set([0]) }));
  assert.ok(mesh.material.every((material, index) => material === painted[index]), 'clearing the selection restores the model\'s own look');
  assert.ok(mesh.material.every((material) => material.transparent === true && Math.abs(material.opacity - 0.3) < 1e-9), 'dimmed items fade');
  browser.flushFrames();
  engine.dispose();
  assert.equal(record.disposed, 1);
  assert.equal(mesh.material, originals, 'the loader gets its original material array back for owned disposal');
  assert.ok(originals.every((material) => material.opacity === 1 && material.transparent === false), 'drawing-state changes never mutate loader-owned materials');
  assert.deepEqual(paintedDisposals, [1, 1]);
  assert.deepEqual(highlightDisposals, [1, 1]);
  engine.dispose();
  assert.equal(record.disposed, 1);
  assert.deepEqual(paintedDisposals, [1, 1]);
  assert.deepEqual(highlightDisposals, [1, 1]);
});

test('lines and textured point clouds are highlighted with materials of their own kind', async (t) => {
  const line = new Line(triangleGeometry(), new LineBasicMaterial({ color: 0x00ff00 }));
  const texture = new Texture();
  const cloud = new Points(triangleGeometry(), new PointsMaterial({ map: texture, size: 3, sizeAttenuation: false }));
  const group = new Group().add(line, cloud);
  const { model } = parsed(group);
  const { engine } = await mounted(t, [model]);
  engine.setData(...Object.values(data(1)));
  await waitUntil(() => engine.positionOf(1) !== null, 'both drawables to install');
  assert.equal(engine.positionOf(2), null);
  engine.setStyle({ accent: '#ff0000', focus: '#0000ff', foreground: '#ffffff' });
  engine.setState(state({ selected: new Set([0]), hover: 1 }));
  assert.ok(line.material instanceof LineBasicMaterial && line.material.color.g < 1, 'the line gets a highlight line material in the accent color');
  assert.ok(cloud.material instanceof PointsMaterial && cloud.material.map === null, 'the cloud gets a plain point material');
  assert.equal(cloud.material.size, 3);
  assert.equal(cloud.material.sizeAttenuation, false);
  engine.setState(state({ focus: 0 }));
  const focused = line.material.color.clone();
  engine.setState(state({ selected: new Set([0]) }));
  assert.notDeepEqual(line.material.color.toArray(), focused.toArray(), 'focus and selection use different colors');
});

test('a model without bounds installs, and bounds beyond the renderer\'s world are refused without losing the current model', async (t) => {
  const empty = parsed(new Group(), { bounds: null });
  const first = parsed(new Mesh(triangleGeometry(), new MeshStandardMaterial()));
  const huge = parsed(new Mesh(triangleGeometry(), new MeshStandardMaterial()), { bounds: new Box3(new Vector3(-2e7, 0, 0), new Vector3(2e7, 1, 1)) });
  const { engine, calls } = await mounted(t, [empty.model, first.model, huge.model]);
  engine.setData(...Object.values(data(1)));
  await waitUntil(() => calls.progress.length === 1, 'the empty model to install');
  assert.equal(engine.positionOf(0), null, 'an empty model has nothing to address');
  assert.deepEqual(calls.lost, []);
  engine.setData(...Object.values(data(2)));
  await waitUntil(() => engine.positionOf(0) !== null, 'the triangle to install');
  const center = engine.positionOf(0);
  engine.setData(...Object.values(data(3)));
  await waitUntil(() => calls.lost.length === 1, 'the oversized model to be refused');
  assert.deepEqual(calls.lost, [{ reason: 'error', detail: 'model-parse-failed' }]);
  assert.deepEqual(engine.positionOf(0), center, 'the previous model stays');
  assert.equal(huge.record.disposed, 1, 'the refused model is released');
});

test('releasing a model continues past materials and loaders that fail to dispose', async (t) => {
  const mesh = new Mesh(triangleGeometry(), new MeshStandardMaterial());
  const { record, model } = parsed(mesh, { disposeFails: true });
  const { engine } = await mounted(t, [model]);
  engine.setData(...Object.values(data(1)));
  await waitUntil(() => engine.positionOf(0) !== null, 'the model to install');
  const attempts = [];
  t.mock.method(Material.prototype, 'dispose', function dispose() { attempts.push(this.type); throw new Error('material release failed'); });
  assert.doesNotThrow(() => engine.dispose());
  assert.equal(record.disposed, 1, 'the loader\'s own release still runs');
  assert.ok(attempts.length >= 1, 'the highlight materials were all attempted');
});

test('a point cloud model that fails to release does not stop the rest of its release', async (t) => {
  const cloud = new Points(triangleGeometry(), new PointsMaterial());
  const { record, model } = parsed(cloud);
  const { engine } = await mounted(t, [model]);
  engine.setData(...Object.values(data(1)));
  await waitUntil(() => engine.positionOf(0) !== null, 'the point cloud to install');
  t.mock.method(BufferGeometry.prototype, 'dispose', () => { throw new Error('geometry release failed'); });
  assert.doesNotThrow(() => engine.dispose());
  assert.equal(record.disposed, 1);
});

test('a viewport created while the host is disposing the engine is released at once', async (t) => {
  let released = 0;
  let engine;
  engine = createModelEngine({
    viewport(_container, callbacks) {
      callbacks.rendering({ software: false });
      return { dispose() { released += 1; } };
    },
  });
  await engine.mount({}, { hover() {}, pick() {}, camera() {}, lost() {}, rendering() { engine.dispose(); } });
  assert.equal(released, 1);
  assert.equal(engine.positionOf(0), null);
  t.after(() => engine.dispose());
});
