import assert from 'node:assert/strict';
import test from 'node:test';
import { CanvasTexture, Mesh, PlaneGeometry, Scene, ShaderMaterial } from 'three';
import { createPointsLabels, pointsAxes } from '../dist/points/axes.js';
import { admitPointsData } from '../dist/points/data.js';
import { disposePointsLabelResources } from '../dist/points/label-resources.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const keys = ['canvas', 'disposed', 'geometry', 'material', 'mesh', 'texture'];
const state = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
function cleared(resources) {
  assert.equal(resources.disposed, true);
  for (const key of keys) if (key !== 'disposed') assert.equal(resources[key], undefined, key);
}
function fixture(t) {
  const canvas = { width: 0, height: 0, getContext: () => ({ setTransform() {}, clearRect() {}, fillText() {} }) };
  const data = admitPointsData({ positions: new Float32Array([1, 2, 3]), labels: ['point'],
    axes: [{ axis: 'x', min: -2, max: 2, label: 'axis', ticks: [] }] });
  const viewport = { scene: new Scene(), orbit: DEFAULT_ORBIT_CAMERA, width: 640, height: 480,
    style: resolveLyra3dStyle(), project: () => ({ x: 100, y: 100 }) };
  const labels = createPointsLabels(viewport, data, pointsAxes(data).labels, () => canvas);
  labels.update(state);
  const restores = [];
  t.after(() => { for (const restore of restores.reverse()) restore(); labels.dispose(); });
  return { canvas, data, viewport, labels, resources: labels.resources, restores };
}
function traceRetirement(f, failAt, secondary) {
  const resources = f.resources, calls = [], failures = new Map();
  if (failAt) failures.set(failAt, new Error(`Controlled ${failAt} retirement failure`));
  if (secondary) failures.set(secondary, new Error(`Controlled ${secondary} retirement failure`));
  const observe = name => {
    cleared(resources); calls.push(name);
    if (failures.has(name)) throw failures.get(name);
  };
  for (const [owner, method, name] of [[resources.mesh, 'removeFromParent', 'mesh'],
    [resources.geometry, 'dispose', 'geometry'], [resources.material, 'dispose', 'material'], [resources.texture, 'dispose', 'texture']]) {
    const original = owner[method];
    owner[method] = function (...args) { const result = original.apply(this, args); observe(name); return result; };
    f.restores.push(() => { owner[method] = original; });
  }
  for (const dimension of ['width', 'height']) {
    let size = f.canvas[dimension];
    Object.defineProperty(f.canvas, dimension, { configurable: true, get: () => size,
      set(value) { size = value; assert.equal(value, 1); observe(dimension); } });
    f.restores.push(() => Object.defineProperty(f.canvas, dimension, { configurable: true, writable: true, value: size }));
  }
  return { calls, failure: failures.get(failAt) };
}

test('ordinary label owners expose only the exact native resource record and actual resource identities', t => {
  const f = fixture(t), r = f.resources;
  assert.deepEqual(Object.keys(r).sort(), keys);
  assert.equal(Object.getPrototypeOf(r), Object.prototype); assert.equal(r.disposed, false);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(r))) assert.equal(Object.hasOwn(descriptor, 'value'), true);
  for (const owner of [f.viewport, f.data, state, f.labels]) assert.equal(Object.values(r).includes(owner), false);
  assert.equal(r.canvas, f.canvas); assert.ok(r.texture instanceof CanvasTexture);
  assert.ok(r.material instanceof ShaderMaterial); assert.ok(r.geometry instanceof PlaneGeometry); assert.ok(r.mesh instanceof Mesh);
  assert.equal(r.mesh, f.viewport.scene.children[0]); assert.equal(r.mesh.geometry, r.geometry);
  assert.equal(r.mesh.material, r.material); assert.equal(r.material.uniforms.labels.value, r.texture);
  assert.equal(r.texture.image, r.canvas);
  disposePointsLabelResources(r); cleared(r); assert.equal(f.viewport.scene.children.length, 0);
});

test('label ownership and draw hooks are cleared before reentrant mesh and disposal callbacks', t => {
  const f = fixture(t), r = f.resources, mesh = r.mesh, calls = [];
  let oldDraws = 0;
  const oldHook = () => { oldDraws++; };
  mesh.onBeforeRender = oldHook; mesh.onAfterRender = oldHook;
  const check = name => {
    cleared(r); assert.notEqual(mesh.onBeforeRender, oldHook); assert.notEqual(mesh.onAfterRender, oldHook);
    const before = mesh.onBeforeRender, after = mesh.onAfterRender;
    before.call(undefined); after.call(undefined);
    calls.push(name); disposePointsLabelResources(r); f.labels.dispose();
  };
  const remove = mesh.removeFromParent;
  mesh.removeFromParent = function () { check('mesh'); return remove.call(this); };
  f.restores.push(() => { mesh.removeFromParent = remove; });
  for (const name of ['geometry', 'material', 'texture']) r[name].addEventListener('dispose', () => check(name));
  f.labels.dispose(); f.labels.dispose(); disposePointsLabelResources(r);
  assert.deepEqual(calls, ['mesh', 'geometry', 'material', 'texture']); assert.equal(oldDraws, 0);
  assert.deepEqual([f.canvas.width, f.canvas.height], [1, 1]); assert.equal(f.viewport.scene.children.length, 0);
});

test('label geometry failure preserves its first error and still retires material texture and both canvas dimensions', t => {
  const f = fixture(t), { calls, failure } = traceRetirement(f, 'geometry', 'material');
  assert.throws(() => f.labels.dispose(), error => error === failure);
  assert.deepEqual(calls, ['mesh', 'geometry', 'material', 'texture', 'width', 'height']);
  cleared(f.resources); assert.equal(f.viewport.scene.children.length, 0); assert.deepEqual([f.canvas.width, f.canvas.height], [1, 1]);
  f.labels.dispose(); disposePointsLabelResources(f.resources); assert.equal(calls.length, 6);
});

test('label mesh material texture and canvas reset failures never skip another independent retirement', t => {
  for (const failAt of ['mesh', 'material', 'texture', 'width', 'height']) {
    const f = fixture(t), { calls, failure } = traceRetirement(f, failAt);
    assert.throws(() => disposePointsLabelResources(f.resources), error => error === failure, failAt);
    assert.deepEqual(calls, ['mesh', 'geometry', 'material', 'texture', 'width', 'height']);
    assert.deepEqual([f.canvas.width, f.canvas.height], [1, 1]); assert.equal(f.viewport.scene.children.length, 0);
    cleared(f.resources); f.labels.dispose(); assert.equal(calls.length, 6);
  }
});

test('partial and empty label resource records retire idempotently without requiring absent handles', () => {
  for (const canvas of [undefined, { width: 100, height: 200 }]) {
    const record = { canvas, texture: undefined, material: undefined, geometry: undefined, mesh: undefined, disposed: false };
    disposePointsLabelResources(record); cleared(record); disposePointsLabelResources(record);
    if (canvas) assert.deepEqual([canvas.width, canvas.height], [1, 1]);
  }
});
