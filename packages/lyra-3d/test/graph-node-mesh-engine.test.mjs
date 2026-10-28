import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphEngine } from '../dist/graph/engine.js';
import { installFakeBrowser } from './fake-browser.mjs';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';

const data = () => ({ nodeCount: 2, positions: new Float32Array([-40, 0, 0, 40, 0, 0]), source: new Uint32Array([0]), target: new Uint32Array([1]), spatialAppearance: {} });
const host = () => ({ hover() {}, pick() {}, camera() {}, lost() {} });

test('custom presentation replaces and resets without restarting layout or consuming a data revision', async t => {
  const browser = installFakeBrowser(), tasks = [];
  const engine = createGraphEngine({ task(options) { const task = { mode: 'main-thread', update() {}, stop() {} }; tasks.push(options); return task; } });
  t.after(() => { try { engine.dispose(); } finally { browser.restore(); } });
  assert.equal(typeof engine.setNodeMeshes, 'function');
  engine.setData(data(), 1); await engine.mount(browser.container, host());
  const before = engine.positionOf(0), taskCount = tasks.length;
  engine.setNodeMeshes([triangleMesh(), null]);
  engine.setAppearance({ nodeLabels: 'none' });
  assert.deepEqual(engine.positionOf(0), before); assert.equal(tasks.length, taskCount);
  engine.setNodeMeshes(undefined);
  assert.equal(tasks.length, taskCount);
  assert.doesNotThrow(() => engine.setData(data(), 2));
});

test('bad custom mesh replacements preserve current data and layout ownership', async t => {
  const browser = installFakeBrowser();
  const engine = createGraphEngine();
  t.after(() => { try { engine.dispose(); } finally { browser.restore(); } });
  assert.equal(typeof engine.setNodeMeshes, 'function');
  engine.setData(data(), 1); await engine.mount(browser.container, host());
  engine.setNodeMeshes([triangleMesh(), null]);
  const before = engine.positionOf(0), invalid = triangleMesh(); invalid.positions[0] = Infinity;
  assert.throws(() => engine.setNodeMeshes([invalid, null]));
  assert.deepEqual(engine.positionOf(0), before);
  assert.doesNotThrow(() => engine.setNodeMeshes(undefined));
});

test('legacy nonspatial graphs refuse custom meshes while ordinary graphs remain compatible', () => {
  const engine = createGraphEngine();
  try {
    assert.equal(typeof engine.setNodeMeshes, 'function');
    engine.setData({ nodeCount: 1, positions: new Float32Array(3), source: new Uint32Array(), target: new Uint32Array() }, 1);
    assert.throws(() => engine.setNodeMeshes([triangleMesh()]));
  } finally { engine.dispose(); }
});

test('glow preference supports pre-mount configuration, false cancellation and idempotent disposal', async () => {
  const engine = createGraphEngine();
  assert.equal(typeof engine.setGlow, 'function');
  await engine.setGlow(true); await engine.setGlow(false);
  await assert.rejects(engine.setGlow('true'), TypeError);
  engine.dispose(); engine.dispose(); await engine.setGlow(false);
});

test('initial custom scene construction verifies and reports physical allocation ownership', async t => {
  const browser = installFakeBrowser(), snapshots = [];
  const engine = createGraphEngine({ storage: value => snapshots.push(value) });
  t.after(() => { try { engine.dispose(); } finally { browser.restore(); } });
  engine.setData({ ...data(), spatialAppearance: { nodeMeshes: [triangleMesh(), null] } }, 1);
  await engine.mount(browser.container, host());
  assert.equal(snapshots.length, 1);
  const snapshot = snapshots[0];
  assert.ok(snapshot.candidateCpuBytes > 0 && snapshot.candidateGpuAttributeBytes > 0);
  assert.ok(snapshot.peakCpuBytes <= snapshot.previousCpuBytes + snapshot.candidateCpuBytes);
  assert.ok(snapshot.customAccountedBytes > 0 && snapshot.customAccountedBytes <= 96 * 1024 * 1024);
});

test('a custom data construction failure preserves the old scene, task, camera and revision', async t => {
  const browser = installFakeBrowser(), tasks = [];
  let fail = false;
  const engine = createGraphEngine({
    labelCanvas() { if (fail) throw Error('synthetic label construction failure'); return document.createElement('canvas'); },
    task(options) { const task = { options, stopped: false, mode: 'main-thread', update() {}, stop() { this.stopped = true; } }; tasks.push(task); return task; },
  });
  t.after(() => { try { engine.dispose(); } finally { browser.restore(); } });
  engine.setData(data(), 1); await engine.mount(browser.container, host());
  const position = engine.positionOf(0), task = tasks[0];
  const replacement = { ...data(), labels: ['Alpha', 'Beta'], positions: new Float32Array([-100, 20, 10, 100, 20, 10]),
    spatialAppearance: { nodeMeshes: [triangleMesh(), null] } };
  fail = true;
  assert.throws(() => engine.setData(replacement, 2), /synthetic label construction failure/u);
  assert.deepEqual(engine.positionOf(0), position);
  assert.equal(task.stopped, false);
  assert.equal(tasks.length, 1);
  fail = false;
  assert.doesNotThrow(() => engine.setData(replacement, 2));
  assert.deepEqual(engine.positionOf(0), { x: -100, y: 20, z: 10 });
});

test('valid custom geometry refused by expanded scene capacity reports a budget reason atomically', () => {
  const engine = createGraphEngine();
  try {
    engine.setData(data(), 1);
    const curved = 124_999, count = curved + 14;
    const curvature = new Float32Array(count); curvature.fill(1, 0, curved);
    // Existing edge-only admission accepts 1,999,998 primitives. Adding the two ordinary node
    // slots and one valid custom triangle exceeds the mixed-scene ceiling by exactly one.
    const oversized = { ...data(), source: new Uint32Array(count), target: new Uint32Array(count).fill(1),
      spatialAppearance: { edgeCurvatures: curvature, nodeMeshes: [triangleMesh(), null] } };
    assert.throws(() => engine.setData(oversized, 2), error => {
      assert.equal(Object.getOwnPropertyDescriptor(error, 'reason')?.value, 'budget');
      return true;
    });
    assert.deepEqual(engine.positionOf(0), { x: -40, y: 0, z: 0 });
    assert.doesNotThrow(() => engine.setData(data(), 2));
  } finally { engine.dispose(); }
});
