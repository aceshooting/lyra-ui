import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, PerspectiveCamera, Scene } from 'three';
import { createGraphDataPreparationWork } from '../dist/graph/data-preparation.js';
import {
  createGraphPresentationSnapshotWork, createGraphPresentationWork, readGraphPresentationCandidate,
  prepareGraphPresentationRetirement, prepareGraphPresentationViewRetirement,
} from '../dist/graph/presentation-work.js';
import { commitGraphPresentationSwap } from '../dist/graph/presentation-roots.js';
import { DEFAULT_ORBIT_CAMERA } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const invalidState = error => error?.name === 'InvalidStateError';
const emptyState = () => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });
function drain(work, budget = 4096) {
  try {
    for (let calls = 0; calls < 100000; calls++) {
      const step = work.step(budget);
      assert.ok(Number.isSafeInteger(step.operations) && step.operations > 0 && step.operations <= budget);
      if (step.done) { assert.ok(step.value); return step.value; }
      assert.equal(step.value, undefined);
    }
    assert.fail('Preparation did not finish');
  } finally { work.dispose(); }
}
function finishLease(lease, budget = 4096) {
  let operations = 0;
  for (let calls = 0; calls < 1000; calls++) {
    const step = lease.step(budget);
    assert.ok(Number.isSafeInteger(step.operations) && step.operations > 0 && step.operations <= budget);
    operations += step.operations;
    if (step.done) { assert.equal(lease.done, true); return operations; }
    assert.equal(lease.done, false);
  }
  assert.fail('Retirement did not finish');
}
function triangle(alpha) {
  return { positions: new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0]),
    normals: new Float32Array([0, 0, 1]), color: [0.2, 0.4, 0.6, alpha] };
}
function canvasFactory(nullContext = false) {
  const records = [];
  const create = () => {
    let width = 300, height = 150;
    const writes = [], values = {};
    const reset = () => Object.assign(values, { font: '10px sans-serif', textBaseline: 'alphabetic',
      textAlign: 'start', fillStyle: '#000000', globalAlpha: 1 });
    reset();
    const context = { setTransform() {}, clearRect() {}, fillText() {} };
    for (const key of Object.keys(values)) Object.defineProperty(context, key, {
      get() { return values[key]; }, set(value) { values[key] = value; },
    });
    const canvas = {
      get width() { return width; }, set width(value) { width = value; writes.push(['width', value]); reset(); },
      get height() { return height; }, set height(value) { height = value; writes.push(['height', value]); reset(); },
      getContext(kind) { assert.equal(kind, '2d'); return nullContext ? null : context; },
    };
    records.push({ canvas, writes }); return canvas;
  };
  return { create, records };
}
function fixture({ spatial = false, firstOwner = true, world = false, nullContext = false, revocable = false } = {}) {
  const raw = {
    nodeCount: 3, source: new Uint32Array([0, 1]), target: new Uint32Array([spatial ? 0 : 1, 2]),
    positions: new Float32Array([-30, 5, -10, 40, -5, 12, 0, 35, -8]), pinned: new Uint8Array([1, 0, 1]),
    sizes: new Float32Array([12, 8, 16]), directed: new Uint8Array([1, 0]), particlesPerEdge: 1,
    labels: ['left', 'right', 'top'], edgeLabels: ['first', 'second'], nodeLabels: 'always', withEdgeLabels: true,
    ...(spatial ? { spatialAppearance: { sizeUnits: world ? 'world' : 'css', edgeCurvatures: new Float32Array([0, 0.25]),
      edgeWidths: new Float32Array([2, 3]), nodeMeshes: [triangle(0.5), null, triangle(0.8)], dimmedOpacity: 0.4 } } : {}),
  };
  let prepared = drain(createGraphDataPreparationWork(raw));
  let presentation = drain(createGraphPresentationSnapshotWork({
    presentation: { style: { pointSize: 8, lineWidth: 2, fontSize: 16, accent: 'rgba(255, 128, 0, 0.5)' },
      state: { selected: new Set([0]), dimmed: new Set([2]), hover: 3, focus: 1 } },
    inheritedStyle: resolveLyra3dStyle(), inheritedState: emptyState(),
  }));
  const revokers = [];
  const wrap = value => {
    if (!revocable) return value;
    const proxy = Proxy.revocable(value, {}); revokers.push(proxy.revoke); return proxy.proxy;
  };
  if (revocable) {
    prepared = wrap({ ...prepared, data: wrap(prepared.data), start: wrap(prepared.start) });
    presentation = wrap({ ...presentation, style: wrap(presentation.style), state: wrap(presentation.state) });
  }
  const canvas = canvasFactory(nullContext);
  const input = wrap({ prepared, presentation, width: 640, height: 480,
    orbit: { ...DEFAULT_ORBIT_CAMERA, yaw: 0.3, pitch: -0.2, target: { ...DEFAULT_ORBIT_CAMERA.target } },
    fittedDistance: 500, revision: 3, firstOwner, dependencies: wrap({}) });
  const work = createGraphPresentationWork(input, canvas.create);
  const handle = drain(work), record = readGraphPresentationCandidate(handle);
  return { handle, record, input, prepared, presentation, work, canvas, revokers };
}
function views(record) { return [record.primary, record.fitted].filter(Boolean); }
function owners(record) {
  return [...views(record).flatMap(view => [view.ordinary ?? view.composite, view.decorations]),
    ...(record.shared ? [record.shared.edges, record.shared.nodes] : [])];
}
function rootGroups(record) {
  return [record.roots, record.slots, ...views(record).map(view => view.roots)]
    .flatMap(roots => [roots.world, roots.pick, roots.overlay]);
}
function ownerMeshes(owner) {
  const r = owner.resources;
  if (r.nodes) return [r.nodes, r.nodePick, r.edges, r.edgePick];
  if (r.arrows) return [r.arrows, r.arrowPick, r.particles, ...(r.labelMesh ? [r.labelMesh] : [])];
  return [r.mesh, ...(r.pick ? [r.pick] : []), ...(r.customPick ? [r.customPick] : [])];
}
function nativeObjects(owner) {
  const r = owner.resources, result = [];
  for (const mesh of ownerMeshes(owner)) {
    result.push(mesh.geometry, mesh.material);
    if (mesh.isInstancedMesh) result.push(mesh);
  }
  if (r.texture) result.push(r.texture);
  if (r.labelTexture) result.push(r.labelTexture);
  return [...new Set(result)];
}
function eligibleMeshes(record) {
  const meshes = new Set();
  for (const root of [record.roots, ...views(record).map(view => view.roots)]) {
    for (const key of ['world', 'pick', 'overlay']) root[key].traverse(object => { if (object.geometry) meshes.add(object); });
  }
  return meshes;
}
function nativeInventory(list, eligible) {
  const cpuBackings = new Set(), gpuAttributes = new Set(), textures = new Set(), canvases = new Set();
  const add = attribute => { if (attribute) cpuBackings.add(attribute.array.buffer); };
  for (const owner of list) {
    const r = owner.resources;
    for (const mesh of ownerMeshes(owner)) {
      const attributes = [...Object.values(mesh.geometry.attributes), mesh.geometry.index,
        ...(mesh.isInstancedMesh ? [mesh.instanceMatrix, mesh.instanceColor] : [])].filter(Boolean);
      for (const attribute of attributes) { add(attribute); if (eligible.has(mesh)) gpuAttributes.add(attribute); }
    }
    if (r.texture) { textures.add(r.texture); if (ArrayBuffer.isView(r.texture.image?.data)) cpuBackings.add(r.texture.image.data.buffer); }
    if (r.labelTexture) textures.add(r.labelTexture);
    if (r.canvas) canvases.add(r.canvas);
  }
  return { cpuBackings, gpuAttributes, textures, canvases };
}
function assertStorage(storage, expected) {
  for (const key of ['cpuBackings', 'gpuAttributes', 'textures', 'canvases']) assert.deepEqual(new Set(storage[key]), expected[key], key);
  assert.equal(storage.cpuBytes, [...expected.cpuBackings].reduce((sum, buffer) => sum + buffer.byteLength, 0));
  assert.equal(storage.gpuAttributeBytes, [...expected.gpuAttributes].reduce((sum, attribute) => sum + attribute.array.byteLength, 0));
  assert.equal(storage.gpuTextureBytes, [...expected.textures].reduce((sum, texture) => sum + (ArrayBuffer.isView(texture.image?.data)
    ? texture.image.data.byteLength : texture.image.width * texture.image.height * 4), 0));
  assert.equal(storage.canvasBackingEstimateBytes, [...expected.canvases].reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0));
}
function assertEmptyStorage(storage) {
  assertStorage(storage, { cpuBackings: new Set(), gpuAttributes: new Set(), textures: new Set(), canvases: new Set() });
}
function observe(list) {
  const expected = new Set(list.flatMap(nativeObjects)), counts = new Map(), events = [];
  for (const object of expected) object.addEventListener('dispose', () => {
    counts.set(object, (counts.get(object) ?? 0) + 1); events.push(object);
  });
  return { expected, counts, events, assertAll() {
    assert.equal(counts.size, expected.size);
    for (const object of expected) assert.equal(counts.get(object), 1, object.type);
  } };
}
function assertCanvasesReset(canvas, records) {
  for (const resource of records) {
    const entry = canvas.records.find(item => item.canvas === resource.canvas);
    assert.ok(entry); assert.deepEqual(entry.writes.slice(-2), [['width', 1], ['height', 1]]);
    assert.equal(entry.writes.filter(([key, value]) => key === 'width' && value === 1).length, 1);
    assert.equal(entry.writes.filter(([key, value]) => key === 'height' && value === 1).length, 1);
  }
}
function assertDisposed(list) { for (const owner of list) assert.equal(owner.resources.disposed, true); }
function teardown(value) {
  if (!value) return;
  try {
    const record = readGraphPresentationCandidate(value.handle);
    for (const lease of record.pendingRetirements) if (!lease.done) lease.dispose();
    prepareGraphPresentationRetirement(value.handle).dispose();
  } catch (error) { if (!invalidState(error)) throw error; }
}
function nativeBytes(list) {
  return list.flatMap(ownerMeshes).map(mesh => [...Object.values(mesh.geometry.attributes), mesh.geometry.index,
    ...(mesh.isInstancedMesh ? [mesh.instanceMatrix, mesh.instanceColor] : [])].filter(Boolean)
    .map(attribute => Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength).toString('hex')));
}
function viewFor(value, view) {
  return { width: 640, height: 480, orbit: view.orbit, style: value.presentation.style };
}
function thrown(action, expected) {
  let failed = false;
  try { action(); } catch (error) { failed = true; assert.equal(Object.is(error, expected), true); }
  assert.equal(failed, true);
}

for (const [name, spatial, firstOwner, total] of [
  ['ordinary primary', false, false, 11], ['ordinary dual', false, true, 16],
  ['spatial primary', true, false, 13], ['spatial dual', true, true, 18],
]) {
  test(name + ' retirement releases every native identity once in the exact fixed count', () => {
    for (const budget of [1, 7, 4096]) {
      const value = fixture({ spatial, firstOwner }), record = value.record, list = owners(record), observed = observe(list);
      const expected = nativeInventory(list, eligibleMeshes(record)), groups = [record.roots, record.slots, ...views(record).map(view => view.roots)];
      const canvases = list.map(owner => owner.resources).filter(resource => resource.canvas);
      const compositeNatives = spatial ? views(record).flatMap(view => nativeObjects(view.composite)) : [];
      const atlas = record.shared?.edges.resources.texture;
      let lease;
      try {
        lease = prepareGraphPresentationRetirement(value.handle);
        assert.throws(() => readGraphPresentationCandidate(value.handle), invalidState);
        assert.equal(lease.done, false); assertStorage(lease.storage, expected);
        value.work.dispose(); assert.equal(observed.counts.size, 0);
        assert.equal(finishLease(lease, budget), total); observed.assertAll(); assertDisposed(list);
        assertEmptyStorage(lease.storage); assertCanvasesReset(value.canvas, canvases);
        for (const roots of groups) for (const key of ['world', 'pick', 'overlay']) assert.equal(roots[key].parent, null);
        if (spatial) {
          assert.ok(observed.events.indexOf(atlas) > Math.max(...compositeNatives.map(object => observed.events.indexOf(object))));
        }
        lease.dispose(); lease.dispose(); observed.assertAll(); assert.throws(() => lease.step(0), invalidState);
      } finally { lease?.dispose(); teardown(value); }
    }
  });
}

for (const [name, spatial, retirePrimary] of [
  ['ordinary fitted', false, false], ['ordinary former primary', false, true],
  ['spatial fitted', true, false], ['spatial former primary', true, true],
]) {
  test(name + ' unused-view retirement transfers pending natives and preserves selected owners', () => {
    for (const budget of [1, 7, 4096]) {
      const value = fixture({ spatial }), record = value.record;
      if (retirePrimary) { commitGraphPresentationSwap(record.fittedSwap); record.selectedView = record.fitted; }
      const name = retirePrimary ? 'primary' : 'fitted', unused = record[name], selected = record.selectedView;
      const unusedOwners = [unused.ordinary ?? unused.composite, unused.decorations], selectedOwners = [selected.ordinary ?? selected.composite, selected.decorations];
      const eligible = eligibleMeshes(record), expected = nativeInventory(unusedOwners, eligible), observed = observe(unusedOwners);
      const selectedBefore = nativeBytes(selectedOwners), beforeCpu = record.storage.cpuBytes;
      const beforeGpu = record.storage.gpuAttributeBytes, beforeTexture = record.storage.gpuTextureBytes;
      let lease;
      try {
        lease = prepareGraphPresentationViewRetirement(value.handle, name);
        assert.equal(readGraphPresentationCandidate(value.handle), record); assert.equal(record[name], undefined);
        assert.equal(record.fittedSwap, undefined); assert.equal(record.selectedView, selected); assert.ok(record.pendingRetirements.includes(lease));
        assertStorage(lease.storage, expected); assert.ok(lease.storage.cpuBytes > 0);
        assert.ok(beforeCpu - record.storage.cpuBytes >= lease.storage.cpuBytes);
        assert.equal(beforeGpu - record.storage.gpuAttributeBytes, lease.storage.gpuAttributeBytes);
        assert.equal(beforeTexture - record.storage.gpuTextureBytes, lease.storage.gpuTextureBytes);
        assert.throws(() => prepareGraphPresentationRetirement(value.handle), invalidState);
        assert.equal(readGraphPresentationCandidate(value.handle), record);
        assert.equal(finishLease(lease, budget), 5); observed.assertAll(); assertDisposed(unusedOwners); assertEmptyStorage(lease.storage);
        for (const owner of selectedOwners) assert.equal(owner.resources.disposed, false);
        if (spatial) {
          assert.equal(record.shared.nodes.resources.disposed, false); assert.equal(record.shared.edges.resources.disposed, false);
          assert.equal(expected.textures.has(record.shared.edges.resources.texture), false);
          for (const buffer of [...record.shared.nodes.ownedBuffers, ...record.shared.edges.ownedBuffers]) assert.equal(expected.cpuBackings.has(buffer), false);
          selected.composite.batch.update(viewFor(value, selected));
        } else selected.ordinary.batch.updateTransforms(viewFor(value, selected), value.prepared.data.positions, selected.revision);
        assert.deepEqual(nativeBytes(selectedOwners), selectedBefore);
        assertCanvasesReset(value.canvas, [unused.decorations.resources]);
        assert.equal(finishLease(prepareGraphPresentationRetirement(value.handle), budget), spatial ? 13 : 11);
      } finally { lease?.dispose(); teardown(value); }
    }
  });
}

test('a release failure drains every remaining fixed native owner before rethrowing', () => {
  for (const boundary of ['geometry', 'mesh-removal', 'group-removal', 'canvas-width', 'canvas-height']) {
    const value = fixture({ spatial: true }), record = value.record, list = owners(record), observed = observe(list), failure = new Error('native release failed');
    const groups = rootGroups(record), canvases = list.map(owner => owner.resources).filter(resource => resource.canvas);
    if (boundary === 'geometry') record.primary.composite.resources.geometry.addEventListener('dispose', () => { throw failure; });
    else if (boundary === 'mesh-removal') record.primary.composite.resources.mesh.addEventListener('removed', () => { throw failure; });
    else if (boundary === 'group-removal') record.slots.world.addEventListener('removed', () => { throw failure; });
    else {
      const key = boundary === 'canvas-width' ? 'width' : 'height', canvas = record.primary.decorations.resources.canvas;
      const descriptor = Object.getOwnPropertyDescriptor(canvas, key);
      Object.defineProperty(canvas, key, { ...descriptor, set(value) { descriptor.set.call(this, value); if (value === 1) throw failure; } });
    }
    const lease = prepareGraphPresentationRetirement(value.handle);
    try {
      let failed = false;
      for (let calls = 0; calls < 20 && !failed; calls++) try { lease.step(1); } catch (error) { assert.equal(error, failure); failed = true; }
      assert.equal(failed, true); assert.equal(lease.done, true); observed.assertAll(); assertDisposed(list); assertEmptyStorage(lease.storage);
      for (const group of groups) assert.equal(group.parent, null);
      assertCanvasesReset(value.canvas, canvases);
      lease.dispose(); observed.assertAll(); assert.throws(() => lease.step(0), invalidState);
    } finally { lease.dispose(); teardown(value); }
  }
});

test('all falsy originating release failures survive later cleanup failures', () => {
  for (const failure of [undefined, null, 0, false, '']) {
    const value = fixture(), record = value.record, list = owners(record), observed = observe(list);
    const groups = rootGroups(record);
    record.primary.ordinary.resources.nodes.geometry.addEventListener('dispose', () => { throw failure; });
    record.primary.ordinary.resources.edges.geometry.addEventListener('dispose', () => { throw new Error('later cleanup failed'); });
    const lease = prepareGraphPresentationRetirement(value.handle);
    try {
      thrown(() => finishLease(lease, 4096), failure);
      assert.equal(lease.done, true); observed.assertAll(); assertDisposed(list); assertEmptyStorage(lease.storage);
      for (const group of groups) assert.equal(group.parent, null);
      lease.dispose(); observed.assertAll();
    } finally { lease.dispose(); teardown(value); }
  }
});

test('quiesce failure consumes semantic authority and still quiesces and releases all owners', () => {
  const value = fixture({ spatial: true }), record = value.record, list = owners(record), observed = observe(list);
  const groups = rootGroups(record);
  const quiesced = new Set(), failure = new Error('quiesce failed');
  const expected = list.filter(owner => typeof owner.batch.quiesce === 'function');
  for (const owner of expected) {
    const original = owner.batch.quiesce;
    owner.batch.quiesce = function () {
      assert.throws(() => readGraphPresentationCandidate(value.handle), invalidState);
      quiesced.add(owner); original.call(this);
      if (owner === expected[0]) throw failure;
    };
  }
  try {
    thrown(() => prepareGraphPresentationRetirement(value.handle), failure);
    assert.equal(quiesced.size, expected.length); observed.assertAll(); assertDisposed(list);
    for (const group of groups) assert.equal(group.parent, null);
    assert.throws(() => readGraphPresentationCandidate(value.handle), invalidState);
    assert.throws(() => prepareGraphPresentationRetirement(value.handle), invalidState);
  } finally { teardown(value); }
});

test('release callbacks reject stepping reentry and recursive disposal stays exact once', () => {
  const value = fixture(), list = owners(value.record), observed = observe(list);
  const geometry = value.record.primary.ordinary.resources.nodes.geometry;
  const lease = prepareGraphPresentationRetirement(value.handle); let callbacks = 0;
  geometry.addEventListener('dispose', () => {
    callbacks++; assert.throws(() => lease.step(0), invalidState);
    assert.throws(() => prepareGraphPresentationRetirement(value.handle), invalidState);
    lease.dispose(); lease.dispose();
  });
  try {
    lease.dispose(); assert.equal(callbacks, 1); assert.equal(lease.done, true); observed.assertAll(); assertDisposed(list);
    assertEmptyStorage(lease.storage); lease.dispose(); observed.assertAll();
  } finally { lease.dispose(); teardown(value); }
});

test('both composite settling timers are quiesced and their saved callbacks remain inert', () => {
  const value = fixture({ spatial: true, world: true }), record = value.record;
  const composites = views(record).map(view => view.composite), list = owners(record);
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout, callbacks = [], cleared = new Set();
  let lease, invalidated = 0;
  try {
    globalThis.setTimeout = callback => { const token = { index: callbacks.length }; callbacks.push({ callback, token }); return token; };
    globalThis.clearTimeout = token => { cleared.add(token); };
    for (const view of views(record)) view.composite.batch.update({ ...viewFor(value, view),
      orbit: { ...view.orbit, yaw: view.orbit.yaw + 0.001 }, invalidate() { invalidated++; } });
    assert.equal(callbacks.length, 2);
    const before = nativeBytes(list); lease = prepareGraphPresentationRetirement(value.handle);
    assert.equal(cleared.size, 2); assert.equal(composites.every(owner => !owner.resources.disposed), true);
    for (const entry of callbacks) entry.callback();
    assert.equal(invalidated, 0); assert.deepEqual(nativeBytes(list), before);
    finishLease(lease, 1);
    for (const entry of callbacks) entry.callback();
    assert.equal(invalidated, 0);
  } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; lease?.dispose(); teardown(value); }
});

test('native submission hooks and retirement survive revocation of all semantic inputs', () => {
  for (const spatial of [false, true]) {
    const value = fixture({ spatial, revocable: true }), list = owners(value.record), nativeRecords = list.map(owner => owner.resources);
    const meshes = list.flatMap(ownerMeshes), before = nativeBytes(list), observed = observe(list);
    const lease = prepareGraphPresentationRetirement(value.handle);
    value.record = undefined; value.input = undefined; value.prepared = undefined; value.presentation = undefined;
    for (const revoke of value.revokers) revoke();
    const camera = new PerspectiveCamera(); camera.setViewOffset(640, 480, 10, 20, 1, 1);
    try {
      for (const mesh of meshes) mesh.onBeforeRender({}, new Scene(), camera, mesh.geometry, mesh.material, null);
      const attributes = new Set(meshes.flatMap(mesh => [...Object.values(mesh.geometry.attributes), mesh.geometry.index,
        ...(mesh.isInstancedMesh ? [mesh.instanceMatrix, mesh.instanceColor] : [])].filter(Boolean)));
      for (const attribute of attributes) attribute.onUploadCallback();
      assert.deepEqual(nativeBytes(list), before);
      finishLease(lease, 1); observed.assertAll(); assert.equal(nativeRecords.every(resource => resource.disposed), true);
      assertEmptyStorage(lease.storage);
    } finally { lease.dispose(); teardown(value); }
  }
});

test('pending native storage shrinks monotonically and includes context-null canvases', () => {
  const value = fixture({ nullContext: true }), list = owners(value.record), observed = observe(list);
  const eligible = eligibleMeshes(value.record);
  const lease = prepareGraphPresentationRetirement(value.handle);
  try {
    assert.equal(lease.storage.canvases.size, 2); assert.equal(lease.storage.textures.size, 0);
    assert.ok(lease.storage.canvasBackingEstimateBytes > 0); assert.ok(lease.storage.cpuBytes > 0);
    let previous = lease.storage;
    for (let calls = 0; calls < 20; calls++) {
      const before = { cpuBytes: previous.cpuBytes, gpuAttributeBytes: previous.gpuAttributeBytes,
        gpuTextureBytes: previous.gpuTextureBytes, canvasBackingEstimateBytes: previous.canvasBackingEstimateBytes };
      const previousSets = Object.fromEntries(['cpuBackings', 'gpuAttributes', 'textures', 'canvases'].map(key => [key, new Set(previous[key])]));
      const step = lease.step(1), current = lease.storage;
      assert.equal(step.operations, 1);
      for (const key of Object.keys(before)) assert.ok(current[key] <= before[key], key);
      for (const key of Object.keys(previousSets)) for (const object of current[key]) assert.ok(previousSets[key].has(object), key);
      assertStorage(current, nativeInventory(list.filter(owner => !owner.resources.disposed), eligible));
      previous = current;
      if (step.done) break;
    }
    assert.equal(lease.done, true); assertEmptyStorage(lease.storage); observed.assertAll();
    assertCanvasesReset(value.canvas, list.map(owner => owner.resources).filter(resource => resource.canvas));
  } finally { lease.dispose(); teardown(value); }
});

test('unknown and consumed candidate handles reject without retiring another owner', () => {
  const value = fixture({ firstOwner: false }), list = owners(value.record), observed = observe(list);
  let lease;
  try {
    for (const handle of [undefined, null, {}, Object.freeze({})]) {
      assert.throws(() => readGraphPresentationCandidate(handle), { name: 'TypeError' });
      assert.throws(() => prepareGraphPresentationRetirement(handle), { name: 'TypeError' });
      assert.throws(() => prepareGraphPresentationViewRetirement(handle, 'fitted'), { name: 'TypeError' });
    }
    assert.equal(observed.counts.size, 0); assert.equal(readGraphPresentationCandidate(value.handle), value.record);
    lease = prepareGraphPresentationRetirement(value.handle);
    assert.throws(() => readGraphPresentationCandidate(value.handle), invalidState);
    assert.throws(() => prepareGraphPresentationRetirement(value.handle), invalidState);
    assert.throws(() => prepareGraphPresentationViewRetirement(value.handle, 'primary'), invalidState);
    lease.dispose(); observed.assertAll();
  } finally { lease?.dispose(); teardown(value); }
});

test('attached roots and selected views reject retirement before semantic mutation', () => {
  const value = fixture({ spatial: true }), record = value.record, list = owners(record), observed = observe(list);
  try {
    assert.throws(() => prepareGraphPresentationViewRetirement(value.handle, 'primary'), invalidState);
    for (const key of ['world', 'pick', 'overlay']) {
      const parent = new Group(); parent.add(record.roots[key]);
      assert.throws(() => prepareGraphPresentationRetirement(value.handle), invalidState);
      assert.equal(readGraphPresentationCandidate(value.handle), record); assert.equal(record.pendingRetirements.length, 0);
      parent.remove(record.roots[key]);
      parent.add(record.fitted.roots[key]);
      assert.throws(() => prepareGraphPresentationViewRetirement(value.handle, 'fitted'), invalidState);
      assert.ok(record.fitted); assert.ok(record.fittedSwap); assert.equal(record.pendingRetirements.length, 0);
      parent.remove(record.fitted.roots[key]);
    }
    assert.equal(observed.counts.size, 0); assert.equal(record.selectedView, record.primary);
    prepareGraphPresentationViewRetirement(value.handle, 'fitted').dispose();
    assert.ok(record.primary); assert.equal(record.fitted, undefined);
    prepareGraphPresentationRetirement(value.handle).dispose(); observed.assertAll();
  } finally { teardown(value); }
});

test('retirement budgets preserve progress and done checks precede budget validation', () => {
  const value = fixture({ firstOwner: false }), list = owners(value.record), observed = observe(list);
  const lease = prepareGraphPresentationRetirement(value.handle);
  try {
    for (const budget of [0, -1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => lease.step(budget), { name: 'RangeError' });
      assert.equal(lease.done, false); assert.equal(observed.counts.size, 0);
    }
    const first = lease.step(1); assert.equal(first.operations, 1); assert.equal(first.done, false);
    assert.equal(finishLease(lease, 7), 10); assertEmptyStorage(lease.storage); observed.assertAll();
    assert.throws(() => lease.step(0), invalidState); assert.throws(() => lease.step(1), invalidState);
    lease.dispose(); lease.dispose(); observed.assertAll();
  } finally { lease.dispose(); teardown(value); }
});

