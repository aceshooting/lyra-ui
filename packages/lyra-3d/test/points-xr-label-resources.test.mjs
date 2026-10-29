import assert from 'node:assert/strict';
import test from 'node:test';
import { CanvasTexture, InstancedBufferAttribute, InstancedBufferGeometry, InstancedInterleavedBuffer,
  InterleavedBufferAttribute, Mesh, PerspectiveCamera, Scene, ShaderMaterial, Texture, WebGLRenderer } from 'three';
import { createPointBatch } from '../dist/points/batches.js';
import { admitPointsData } from '../dist/points/data.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { createPointsXrAllocationAccount, createPointsXrLabelLayout, finishPointsXrLabelLayout } from '../dist/points/xr-label-layout.js';
import { createPointsXrLabelResources, disposePointsXrLabelResources } from '../dist/points/xr-label-resources.js';
import { preparePointsXrLabels } from '../dist/points/xr-labels.js';
import { FakeCanvas, installFakeBrowser } from './fake-browser.mjs';
import { createLabelFixture } from './points-xr-label-fixture.mjs';

const recordKeys = ['canvas', 'disposed', 'geometries', 'materials', 'meshes', 'texture'];
const state = () => ({ selected: new Set(), dimmed: new Set([1]), hover: -1, focus: -1 });
const input = () => ({ positions: new Float32Array([-.2, 0, -2, .2, .1, -2.5]), sizes: new Float32Array([6, 12]),
  labels: ['first', 'second'], axes: [{ axis: 'x', min: -1, max: 1, label: 'axis', ticks: [{ value: 0, label: 'tick' }] }] });
const metrics = { left: 1, right: 7, ascent: 4, descent: 3 };
function groups(owner, pass, visit = () => {}) {
  owner.beginGroups(pass);
  for (;;) {
    const step = owner.nextGroup();
    if (step.kind === 'done') break;
    if (step.kind === 'group') visit(step.group);
  }
  owner.endGroups();
}
function layoutFor(data, style, visual, account) {
  const identity = Object.freeze({}), owner = createPointsXrLabelLayout(data, style, visual, identity, account);
  while (!owner.stepIndex().done) { /* Advance bounded work. */ }
  groups(owner, 'fonts'); groups(owner, 'readiness');
  groups(owner, 'measure', group => owner.acceptMetrics(group, metrics));
  while (!owner.stepPack().done) { /* Advance bounded work. */ }
  while (!owner.stepFill().done) { /* Advance bounded work. */ }
  groups(owner, 'paint', group => { owner.paintRun(group); });
  return finishPointsXrLabelLayout(owner, identity);
}
function clearRecord(record) {
  assert.equal(record.disposed, true);
  for (const key of recordKeys) if (key !== 'disposed') assert.equal(record[key], undefined, key);
}
function fixture(t, { renderer: needsRenderer = false } = {}) {
  const data = admitPointsData(input()), style = resolveLyra3dStyle(), visual = state();
  const account = createPointsXrAllocationAccount(), layout = layoutFor(data, style, visual, account);
  const points = createPointBatch(data); points.paint(style, visual); points.resize(640, 480);
  const canvas = new FakeCanvas({ context2d: true }); canvas.width = canvas.height = 1024;
  let resources, browser, renderer, savedSelf;
  if (needsRenderer) {
    browser = installFakeBrowser(); savedSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
    Object.defineProperty(globalThis, 'self', { configurable: true, value: { requestAnimationFrame, cancelAnimationFrame } });
    const target = document.createElement('canvas'); renderer = new WebGLRenderer({ canvas: target, context: target.getContext('webgl2') });
    renderer.setSize(640, 480, false);
  }
  t.after(() => {
    try { if (resources) disposePointsXrLabelResources(resources); } finally {
      try { points.dispose(); renderer?.dispose(); renderer?.getContext().state.lose(); } finally {
        if (browser) { browser.restore(); if (savedSelf) Object.defineProperty(globalThis, 'self', savedSelf); else delete globalThis.self; }
      }
    }
  });
  return { data, style, visual, account, layout, points, canvas, renderer,
    create() { resources = createPointsXrLabelResources(layout, points.resources, canvas, account); return resources; } };
}

test('label native records contain only resources and independent wrappers over borrowed and interleaved arrays', t => {
  const f = fixture(t), r = f.create();
  assert.deepEqual(Object.keys(r).sort(), recordKeys); assert.equal(Object.getPrototypeOf(r), Object.prototype);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(r))) assert.ok(Object.hasOwn(descriptor, 'value'));
  assert.equal(r.disposed, false); assert.equal(r.canvas, f.canvas); assert.ok(r.texture instanceof CanvasTexture);
  assert.equal(r.texture.image, f.canvas); assert.equal(r.geometries.length, 2); assert.equal(r.meshes.length, 2);
  assert.ok(r.materials.length >= 1 && r.materials.length <= 2);
  const [point, axis] = r.geometries, original = f.points.resources.geometry;
  for (const [name, originalName, size] of [['labelAnchor', 'pointPosition', 3], ['labelRadius', 'pointSize', 1]]) {
    const attribute = point.getAttribute(name), borrowed = original.getAttribute(originalName);
    assert.ok(attribute instanceof InstancedBufferAttribute); assert.equal(attribute.itemSize, size);
    assert.notEqual(attribute, borrowed); assert.equal(attribute.array, borrowed.array);
  }
  assert.equal(axis.getAttribute('labelAnchor').array, f.layout.axisAnchors);
  assert.equal(axis.getAttribute('labelRadius'), undefined);
  for (const [index, geometry] of r.geometries.entries()) {
    assert.ok(geometry instanceof InstancedBufferGeometry); assert.equal(geometry.instanceCount, 2);
    const interleaved = geometry.getAttribute('labelRect').data;
    assert.ok(interleaved instanceof InstancedInterleavedBuffer); assert.equal(interleaved.stride, 9); assert.equal(interleaved.meshPerAttribute, 1);
    assert.equal(interleaved.array.buffer, f.layout.instanceData.buffer); assert.equal(interleaved.array.byteOffset, index * 2 * 9 * 4);
    for (const [name, size, offset] of [['labelRect', 4, 0], ['labelUv', 4, 4], ['labelDim', 1, 8]]) {
      const attribute = geometry.getAttribute(name); assert.ok(attribute instanceof InterleavedBufferAttribute);
      assert.equal(attribute.data, interleaved); assert.equal(attribute.itemSize, size); assert.equal(attribute.offset, offset);
    }
    assert.equal(geometry.getAttribute('normal'), undefined); assert.equal(geometry.getAttribute('uv'), undefined);
    assert.equal(geometry.getAttribute('position').array.byteLength + geometry.index.array.byteLength, 60);
    assert.deepEqual([...geometry.getAttribute('position').array], [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    assert.ok(geometry.index.array instanceof Uint16Array);
    assert.equal(r.meshes[index].geometry, geometry); assert.ok(r.meshes[index] instanceof Mesh);
  }
  assert.notEqual(point.getAttribute('position'), axis.getAttribute('position'));
  assert.equal(point.getAttribute('position').array, axis.getAttribute('position').array);
  assert.notEqual(point.index, axis.index); assert.equal(point.index.array, axis.index.array);
  assert.notEqual(point.getAttribute('labelRect').data, axis.getAttribute('labelRect').data);
  for (const material of r.materials) {
    assert.ok(material instanceof ShaderMaterial);
    assert.ok(Object.values(material.uniforms).some(uniform => uniform.value === r.texture));
  }
  assert.equal(f.account.usedBytes, f.layout.ownedBufferBytes + 60);
});

test('unused label disposal leaves inline GPU attribute ownership and rendering intact', t => {
  const f = fixture(t, { renderer: true }), inline = new Scene(), candidate = new Scene(), camera = new PerspectiveCamera(70, 4 / 3, .01, 100);
  inline.add(f.points.mesh); f.renderer.render(inline, camera);
  const gl = f.renderer.getContext().state, baseline = { ...f.renderer.info.memory };
  const r = f.create(); candidate.add(...r.meshes); f.renderer.render(candidate, camera);
  assert.ok(f.renderer.info.memory.geometries > baseline.geometries);
  const position = f.points.mesh.geometry.getAttribute('pointPosition'), size = f.points.mesh.geometry.getAttribute('pointSize');
  disposePointsXrLabelResources(r); clearRecord(r);
  assert.deepEqual(f.renderer.info.memory, baseline); assert.equal(f.points.resources.disposed, false);
  const uploads = gl.callsOf('bufferData').length, draws = gl.callsOf('drawElementsInstanced').length;
  f.renderer.render(inline, camera);
  assert.equal(gl.callsOf('bufferData').length, uploads, 'Inline buffers must not require replacement uploads');
  assert.ok(gl.callsOf('drawElementsInstanced').length > draws);
  assert.equal(f.points.mesh.geometry.getAttribute('pointPosition'), position); assert.equal(f.points.mesh.geometry.getAttribute('pointSize'), size);
  assert.equal(f.points.mesh.parent, inline); assert.equal(candidate.children.length, 0);
});

test('label retirement clears ownership first and attempts every resource after an earlier failure', t => {
  for (const failAt of ['mesh0', 'geometry0', 'material0', 'texture', 'width', 'height']) {
  const f = fixture(t), r = f.create(), scene = new Scene(); scene.add(...r.meshes);
  const calls = [], restores = [], first = new Error(`Controlled ${failAt} failure`), second = new Error('Controlled later material failure');
  const expected = [];
  const wrap = (object, method, name) => {
    const error = name === failAt ? first : failAt === 'geometry0' && name === 'material0' ? second : undefined;
    const original = object[method]; expected.push(name);
    object[method] = function (...args) { clearRecord(r); calls.push(name); const result = original.apply(this, args); if (error) throw error; return result; };
    restores.push(() => { object[method] = original; });
  };
  r.meshes.forEach((mesh, index) => wrap(mesh, 'removeFromParent', `mesh${index}`));
  [...new Set(r.geometries)].forEach((geometry, index) => wrap(geometry, 'dispose', `geometry${index}`));
  [...new Set(r.materials)].forEach((material, index) => wrap(material, 'dispose', `material${index}`));
  wrap(r.texture, 'dispose', 'texture');
  for (const dimension of ['width', 'height']) {
    let value = f.canvas[dimension]; expected.push(dimension);
    Object.defineProperty(f.canvas, dimension, { configurable: true, get: () => value, set(next) { clearRecord(r); value = next; calls.push(dimension); assert.equal(next, 1); if (dimension === failAt) throw first; } });
    restores.push(() => Object.defineProperty(f.canvas, dimension, { configurable: true, writable: true, value }));
  }
  try {
    assert.throws(() => disposePointsXrLabelResources(r), error => error === first);
    assert.deepEqual(calls, expected); assert.equal(scene.children.length, 0); clearRecord(r);
    disposePointsXrLabelResources(r); assert.deepEqual(calls, expected);
  } finally { for (const restore of restores.reverse()) restore(); }
  }
});

test('reentrant label retirement neutralizes hooks and retires shared handles once', t => {
  const f = fixture(t), r = f.create(), meshes = [...r.meshes], calls = new Map(); let staleDraws = 0;
  const stale = () => { staleDraws++; };
  for (const mesh of meshes) { mesh.onBeforeRender = stale; mesh.onAfterRender = stale; }
  for (const resource of new Set([...r.geometries, ...r.materials, r.texture])) resource.addEventListener('dispose', () => {
    clearRecord(r); calls.set(resource, (calls.get(resource) ?? 0) + 1);
    for (const mesh of meshes) { assert.notEqual(mesh.onBeforeRender, stale); assert.notEqual(mesh.onAfterRender, stale); mesh.onBeforeRender(); mesh.onAfterRender(); }
    disposePointsXrLabelResources(r);
  });
  const expected = new Set([...r.geometries, ...r.materials, r.texture]);
  disposePointsXrLabelResources(r); disposePointsXrLabelResources(r);
  assert.equal(calls.size, expected.size); assert.equal([...calls.values()].every(count => count === 1), true);
  assert.equal(staleDraws, 0); assert.deepEqual([f.canvas.width, f.canvas.height], [1, 1]);
});

test('partial atlas geometry material and mesh construction retires acquired candidates and releases quad charges', t => {
  for (const failAt of ['atlas', 'geometry', 'material', 'mesh']) {
    const f = fixture(t), baseline = f.account.usedBytes, failure = new Error(`Controlled ${failAt} construction failure`);
    const geometries = new Set(), materials = new Set(), textures = new Set(), disposed = new Set(); let meshCount = 0, materialAttempts = 0;
    const indices = new WeakMap(), previousIndex = Object.getOwnPropertyDescriptor(InstancedBufferGeometry.prototype, 'index');
    const previousValues = Object.getOwnPropertyDescriptor(ShaderMaterial.prototype, 'setValues');
    const previousUpdate = Object.getOwnPropertyDescriptor(CanvasTexture.prototype, 'needsUpdate');
    const methodDescriptors = [[InstancedBufferGeometry.prototype, 'setAttribute'], [Mesh.prototype, 'updateMorphTargets'],
      [InstancedBufferGeometry.prototype, 'dispose'], [ShaderMaterial.prototype, 'dispose'], [CanvasTexture.prototype, 'dispose']]
      .map(([prototype, name]) => [prototype, name, Object.getOwnPropertyDescriptor(prototype, name)]);
    const update = Object.getOwnPropertyDescriptor(Texture.prototype, 'needsUpdate').set;
    const originals = { attribute: InstancedBufferGeometry.prototype.setAttribute, morph: Mesh.prototype.updateMorphTargets,
      values: ShaderMaterial.prototype.setValues, geometry: InstancedBufferGeometry.prototype.dispose,
      material: ShaderMaterial.prototype.dispose, texture: CanvasTexture.prototype.dispose };
    // Capture geometry acquisition before any later material or atlas operation can fail.
    Object.defineProperty(InstancedBufferGeometry.prototype, 'index', { configurable: true,
      get() { return indices.get(this); }, set(value) { geometries.add(this); indices.set(this, value); } });
    InstancedBufferGeometry.prototype.setAttribute = function (...args) {
      if (failAt === 'geometry' && geometries.size === 2) throw failure;
      return originals.attribute.apply(this, args);
    };
    ShaderMaterial.prototype.setValues = function (...args) {
      materialAttempts++; if (failAt === 'material') throw failure;
      const result = originals.values.apply(this, args); materials.add(this); return result;
    };
    Object.defineProperty(CanvasTexture.prototype, 'needsUpdate', { configurable: true,
      set(value) { if (failAt === 'atlas') throw failure; update.call(this, value); textures.add(this); } });
    Mesh.prototype.updateMorphTargets = function (...args) {
      if (this.material instanceof ShaderMaterial && this.geometry instanceof InstancedBufferGeometry) {
        meshCount++;
        if (failAt === 'mesh' && meshCount === 2) throw failure;
      }
      return originals.morph.apply(this, args);
    };
    for (const [prototype, key] of [[InstancedBufferGeometry.prototype, 'geometry'], [ShaderMaterial.prototype, 'material'], [CanvasTexture.prototype, 'texture']]) {
      prototype.dispose = function (...args) { disposed.add(this); return originals[key].apply(this, args); };
    }
    try {
      assert.throws(() => f.create(), error => error === failure);
      if (failAt === 'geometry' || failAt === 'mesh') assert.equal(geometries.size, 2);
      if (failAt === 'material') { assert.equal(materialAttempts, 1); assert.equal(materials.size, 0); }
      for (const resource of [...geometries, ...materials, ...textures]) assert.ok(disposed.has(resource), 'Every acquired candidate must retire');
      assert.equal(f.account.usedBytes, baseline); assert.deepEqual([f.canvas.width, f.canvas.height], [1, 1]);
      assert.equal(f.points.resources.disposed, false); assert.equal(disposed.has(f.points.mesh.geometry), false);
    } finally {
      for (const [prototype, name, descriptor] of methodDescriptors) {
        if (descriptor) Object.defineProperty(prototype, name, descriptor); else delete prototype[name];
      }
      for (const geometry of geometries) Object.defineProperty(geometry, 'index', { configurable: true, writable: true, value: indices.get(geometry) });
      if (previousIndex) Object.defineProperty(InstancedBufferGeometry.prototype, 'index', previousIndex); else delete InstancedBufferGeometry.prototype.index;
      if (previousValues) Object.defineProperty(ShaderMaterial.prototype, 'setValues', previousValues); else delete ShaderMaterial.prototype.setValues;
      if (previousUpdate) Object.defineProperty(CanvasTexture.prototype, 'needsUpdate', previousUpdate); else delete CanvasTexture.prototype.needsUpdate;
    }
  }
});

test('ten unused prepared-label cycles return renderer resources and allocation ownership to baseline', async t => {
  const f = await createLabelFixture(t), renderer = f.record.viewport.renderer;
  const data = admitPointsData(input()), style = resolveLyra3dStyle(), visual = state(), points = createPointBatch(data);
  points.paint(style, visual); t.after(() => points.dispose());
  const camera = new PerspectiveCamera(70, 4 / 3, .01, 100), baseline = { ...renderer.info.memory }, originalContexts = f.record.viewports.length;
  for (let cycle = 0; cycle < 10; cycle++) {
    const account = createPointsXrAllocationAccount(), scene = new Scene();
    const job = preparePointsXrLabels({ identity: Object.freeze({}), data, style, state: visual, pointResources: points.resources,
      ownerDocument: f.record.container.ownerDocument, container: f.record.container, maxTextureSize: 4096, account,
      validate: () => null, schedule(task) { const id = setTimeout(task, 0); return () => clearTimeout(id); }, report(error) { throw error; } });
    const prepared = await job.done, r = prepared.resources;
    assert.equal(prepared.validate(), null); assert.ok(prepared.layout); assert.ok(prepared.profile); assert.ok(account.usedBytes > 0);
    scene.add(...r.meshes); renderer.render(scene, camera); assert.ok(renderer.info.memory.geometries > baseline.geometries);
    prepared.dispose(); prepared.dispose(); job.cancel(); clearRecord(r);
    assert.equal(prepared.layout, undefined); assert.equal(prepared.profile, undefined); assert.equal(prepared.resources, undefined);
    assert.equal(prepared.validate(), 'aborted'); assert.throws(() => prepared.move(), { name: 'InvalidStateError' });
    assert.equal(account.usedBytes, 0); assert.equal(account.transferredBytes, 0); assert.ok(account.peakBytes <= 8388608);
    assert.deepEqual(renderer.info.memory, baseline); assert.equal(scene.children.length, 0);
  }
  assert.equal(f.record.viewports.length, originalContexts); assert.equal(f.attempts.length, 0); assert.equal(points.resources.disposed, false);
});
