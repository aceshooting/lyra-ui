import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, OrthographicCamera, PerspectiveCamera } from 'three';
import { createLineBatch, createPointBatch } from '../dist/points/batches.js';
import { admitPointsData } from '../dist/points/data.js';
import { disposeLineBatchResources, disposePointBatchResources } from '../dist/points/resources.js';

const pointKeys = ['disposed', 'geometry', 'material', 'mesh', 'pick', 'pickMaterial'];
const lineKeys = ['disposed', 'geometry', 'material', 'mesh'];
const input = () => admitPointsData({ positions: new Float32Array([-2, 3, 4, 5, -6, 7]),
  sizes: new Float32Array([8, 12]), labels: ['first', 'second'], categories: new Uint16Array([0, 1]) });
const endpoints = () => new Float32Array([-2, 3, 4, 5, -6, 7]);
function own(t, batch) {
  t.after(() => { try { batch.dispose(); } catch { /* Keep later test cleanup independent. */ } });
  return batch;
}
function assertCleared(resources, keys) {
  assert.equal(resources.disposed, true);
  for (const key of keys) if (key !== 'disposed') assert.equal(resources[key], undefined, key);
}
function countDispose(resource, calls, name) {
  resource.addEventListener('dispose', () => calls.push(name));
}

test('point and line batches expose exact resource records without semantic input or batch methods', t => {
  const data = input(), points = own(t, createPointBatch(data)), line = own(t, createLineBatch(endpoints()));
  const point = points.resources, stroke = line.resources;
  assert.deepEqual(Object.keys(point).sort(), pointKeys); assert.deepEqual(Object.keys(stroke).sort(), lineKeys);
  for (const record of [point, stroke]) {
    assert.equal(Object.getPrototypeOf(record), Object.prototype); assert.equal(record.disposed, false);
    assert.equal(Object.values(record).includes(data), false);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(record))) assert.equal(Object.hasOwn(descriptor, 'value'), true);
  }
  assert.equal(point.mesh, points.mesh); assert.equal(point.pick, points.pick);
  assert.equal(point.geometry, points.mesh.geometry); assert.equal(point.geometry, points.pick.geometry);
  assert.equal(point.material, points.mesh.material); assert.equal(point.pickMaterial, points.pick.material);
  assert.equal(point.geometry.getAttribute('pointPosition').array, data.positions, 'actual geometry retains its required position buffer');
  assert.equal(stroke.mesh, line.mesh); assert.equal(stroke.geometry, line.mesh.geometry); assert.equal(stroke.material, line.mesh.material);
  disposePointBatchResources(point); disposeLineBatchResources(stroke);
  assertCleared(point, pointKeys); assertCleared(stroke, lineKeys);
});

test('point retirement clears ownership first and independently removes both meshes and disposes shared geometry once', t => {
  const batch = own(t, createPointBatch(input())), resources = batch.resources;
  const mesh = batch.mesh, pick = batch.pick, geometry = mesh.geometry, material = mesh.material, pickMaterial = pick.material;
  const scene = new Group(), pickScene = new Group(); scene.add(mesh); pickScene.add(pick);
  const first = new Error('Controlled visible mesh removal failure'), calls = [];
  const remove = mesh.removeFromParent.bind(mesh), removePick = pick.removeFromParent.bind(pick);
  const dispose = material.dispose.bind(material), disposePick = pickMaterial.dispose.bind(pickMaterial), disposeGeometry = geometry.dispose.bind(geometry);
  mesh.removeFromParent = () => { assertCleared(resources, pointKeys); calls.push('mesh'); remove(); throw first; };
  pick.removeFromParent = () => { assertCleared(resources, pointKeys); calls.push('pick'); removePick(); throw new Error('Controlled pick removal failure'); };
  material.dispose = () => { assertCleared(resources, pointKeys); assert.equal(mesh.parent, null); assert.equal(pick.parent, null); calls.push('material'); dispose(); throw new Error('Controlled material failure'); };
  pickMaterial.dispose = () => { calls.push('pick-material'); disposePick(); throw new Error('Controlled pick material failure'); };
  geometry.dispose = () => { calls.push('geometry'); disposeGeometry(); };
  assert.throws(() => disposePointBatchResources(resources), error => error === first);
  assert.deepEqual(calls, ['mesh', 'pick', 'material', 'pick-material', 'geometry']);
  assert.equal(scene.children.length, 0); assert.equal(pickScene.children.length, 0);
  disposePointBatchResources(resources); batch.dispose();
  assert.equal(calls.length, 5); assertCleared(resources, pointKeys);
});

test('line retirement preserves its first error while independently disposing geometry and material', t => {
  const batch = own(t, createLineBatch(endpoints())), resources = batch.resources, mesh = batch.mesh;
  const geometry = mesh.geometry, material = mesh.material, scene = new Group(), calls = [];
  scene.add(mesh); const first = new Error('Controlled line removal failure');
  const remove = mesh.removeFromParent.bind(mesh), disposeGeometry = geometry.dispose.bind(geometry), disposeMaterial = material.dispose.bind(material);
  mesh.removeFromParent = () => { assertCleared(resources, lineKeys); calls.push('mesh'); remove(); throw first; };
  geometry.dispose = () => { assertCleared(resources, lineKeys); assert.equal(mesh.parent, null); calls.push('geometry'); disposeGeometry(); throw new Error('Controlled line geometry failure'); };
  material.dispose = () => { assertCleared(resources, lineKeys); assert.equal(mesh.parent, null); calls.push('material'); disposeMaterial(); };
  assert.throws(() => disposeLineBatchResources(resources), error => error === first);
  assert.deepEqual(calls, ['mesh', 'geometry', 'material']); assert.equal(scene.children.length, 0);
  disposeLineBatchResources(resources); batch.dispose(); assert.equal(calls.length, 3); assertCleared(resources, lineKeys);
});

test('ordinary batch disposal uses the same idempotent records and clears draw hooks before reentrant cleanup', t => {
  const points = own(t, createPointBatch(input())), line = own(t, createLineBatch(endpoints()));
  const point = points.resources, stroke = line.resources, calls = [];
  const pointGeometry = points.mesh.geometry, pointMaterial = points.mesh.material, pickMaterial = points.pick.material;
  const lineGeometry = line.mesh.geometry, lineMaterial = line.mesh.material;
  let oldHooks = 0;
  const oldHook = () => { oldHooks++; };
  for (const mesh of [points.mesh, points.pick, line.mesh]) { mesh.onBeforeRender = oldHook; mesh.onAfterRender = oldHook; }
  const assertHooksCleared = () => {
    for (const mesh of [points.mesh, points.pick]) {
      assert.notEqual(mesh.onBeforeRender, oldHook); assert.notEqual(mesh.onAfterRender, oldHook);
      mesh.onBeforeRender(); mesh.onAfterRender();
    }
  };
  pointMaterial.addEventListener('dispose', () => {
    assertCleared(point, pointKeys); assertHooksCleared(); disposePointBatchResources(point); points.dispose();
  });
  lineGeometry.addEventListener('dispose', () => {
    assertCleared(stroke, lineKeys); assert.notEqual(line.mesh.onBeforeRender, oldHook); assert.notEqual(line.mesh.onAfterRender, oldHook);
    line.mesh.onBeforeRender(); line.mesh.onAfterRender(); disposeLineBatchResources(stroke); line.dispose();
  });
  countDispose(pointGeometry, calls, 'point-geometry'); countDispose(pointMaterial, calls, 'point-material'); countDispose(pickMaterial, calls, 'pick-material');
  countDispose(lineGeometry, calls, 'line-geometry'); countDispose(lineMaterial, calls, 'line-material');
  points.dispose(); line.dispose(); points.dispose(); line.dispose();
  assert.deepEqual(calls.sort(), ['line-geometry', 'line-material', 'pick-material', 'point-geometry', 'point-material']);
  assert.equal(oldHooks, 0); assertCleared(point, pointKeys); assertCleared(stroke, lineKeys);
});

test('resource-only pick hook preserves inline and cropped camera sizes without the batch receiver', t => {
  let batch = createPointBatch(input()); const resources = batch.resources;
  t.after(() => disposePointBatchResources(resources));
  batch.resize(768, 432);
  const hook = batch.pick.onBeforeRender, material = batch.pick.material;
  const sizes = batch.mesh.geometry.getAttribute('pointSize').array.slice(); batch = undefined;
  const camera = new PerspectiveCamera(); camera.setViewOffset(768, 432, 383, 217, 2, 3);
  hook.call(undefined, null, null, camera);
  assert.deepEqual(material.uniforms.viewportSize.value.toArray(), [2, 3]); assert.equal(material.uniformsNeedUpdate, true);
  camera.clearViewOffset(); hook.call(undefined, null, null, camera);
  assert.deepEqual(material.uniforms.viewportSize.value.toArray(), [768, 432]);
  hook.call(undefined, null, null, new OrthographicCamera());
  assert.deepEqual(material.uniforms.viewportSize.value.toArray(), [768, 432]);
  assert.deepEqual(resources.geometry.getAttribute('pointSize').array, sizes);
});
