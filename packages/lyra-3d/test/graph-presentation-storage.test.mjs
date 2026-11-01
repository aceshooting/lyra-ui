import assert from 'node:assert/strict';
import test from 'node:test';
import { InstancedBufferGeometry } from 'three';
import { createGraphSpatialNodes } from '../dist/graph/spatial-nodes.js';
import { createGraphSpatialEdges } from '../dist/graph/spatial-edges.js';
import { createGraphEngine } from '../dist/graph/engine.js';
import { installFakeBrowser } from './fake-browser.mjs';
import { triangleMesh } from './graph-node-mesh-fixtures.mjs';

const scene = () => ({ nodeCount: 2, positions: new Float32Array([-40, 0, 0, 40, 0, 0]), source: new Uint32Array([0]), target: new Uint32Array([1]), spatialAppearance: {} });
const host = () => ({ hover() {}, pick() {}, camera() {}, lost() {} });

test('node and edge inventories include all retained private typed backing', () => {
  const appearance = { nodeShapes: new Uint8Array([0, 1]), expandable: new Uint8Array([0, 1]), nodeColors: new Float32Array(8).fill(1) };
  const nodes = createGraphSpatialNodes({ nodeCount: 2, sizes: new Float32Array([20, 20]), categories: new Uint16Array([0, 1]), spatialAppearance: appearance });
  const edges = createGraphSpatialEdges({ ...scene(), directed: new Uint8Array([1]) });
  try {
    assert.equal(typeof nodes.allocationBuffers, 'function'); assert.equal(typeof edges.allocationBuffers, 'function');
    const nodeBuffers = nodes.allocationBuffers(), edgeBuffers = edges.allocationBuffers();
    assert.equal(new Set(nodeBuffers).size, nodeBuffers.length);
    assert.equal(nodeBuffers.reduce((total, buffer) => total + buffer.byteLength, 0), 50);
    // Two anchors, one pattern row, two offsets, validity/partial masks, and a 2048-float dash atlas.
    assert.equal(edgeBuffers.reduce((total, buffer) => total + buffer.byteLength, 0), 24 + 4 + 8 + 1 + 1 + 8192);
  } finally { nodes.dispose(); edges.dispose(); }
});

for (const seam of ['labelCanvas', 'storage']) test(`internal ${seam} reentry cannot overlap a third presentation generation`, async t => {
  const browser = installFakeBrowser(), live = new Set(), tasks = [];
  const add = InstancedBufferGeometry.prototype.setAttribute, dispose = InstancedBufferGeometry.prototype.dispose;
  const descriptors = new Map(['setAttribute', 'dispose'].map(key => [key, Object.getOwnPropertyDescriptor(InstancedBufferGeometry.prototype, key)]));
  let peak = 0, nested = false, armed = false, engine;
  InstancedBufferGeometry.prototype.setAttribute = function (...args) { live.add(this); peak = Math.max(peak, live.size); return add.apply(this, args); };
  InstancedBufferGeometry.prototype.dispose = function (...args) { live.delete(this); return dispose.apply(this, args); };
  const reenter = () => {
    if (!armed || nested) return; nested = true;
    assert.throws(() => engine.setNodeMeshes([triangleMesh(), null]), { name: 'AbortError' });
  };
  engine = createGraphEngine({ labelCanvas() { if (seam === 'labelCanvas') reenter(); return document.createElement('canvas'); }, storage() { if (seam === 'storage') reenter(); },
    task() { const task = { mode: 'main-thread', stopped: false, update() {}, stop() { this.stopped = true; } }; tasks.push(task); return task; } });
  t.after(() => { try { engine.dispose(); } finally { for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(InstancedBufferGeometry.prototype, key, descriptor); else Reflect.deleteProperty(InstancedBufferGeometry.prototype, key); } browser.restore(); } });
  engine.setData({ ...scene(), labels: ['Alpha', 'Beta'] }, 1); await engine.mount(browser.container, host());
  const initial = live.size, position = engine.positionOf(0); peak = initial; armed = true;
  engine.setNodeMeshes([triangleMesh(), null]);
  assert.equal(nested, true); assert.ok(peak <= initial + 4, `only one detached set is live; observed ${peak - initial}`);
  assert.equal(live.size, initial); assert.deepEqual(engine.positionOf(0), position);
  assert.equal(tasks.length, 1); assert.equal(tasks[0].stopped, false, 'precommit refusal preserves the active solver');
  armed = false;
  assert.doesNotThrow(() => engine.setNodeMeshes([triangleMesh(), null]));
  assert.doesNotThrow(() => engine.setNodeMeshes(undefined));
  assert.doesNotThrow(() => engine.setData(scene(), 2));
});

test('application input reentry before resource allocation preserves the newer data revision', () => {
  const engine = createGraphEngine();
  try {
    engine.setData(scene(), 0);
    let nested = false;
    const input = { ...scene(), positions: new Float32Array([-999, 0, 0, 999, 0, 0]) };
    Object.defineProperty(input, 'labels', { enumerable: true, get() {
      if (!nested) { nested = true; engine.setData({ ...scene(), positions: new Float32Array([-222, 0, 0, 222, 0, 0]) }, 2); }
      return undefined;
    } });
    engine.setData(input, 1);
    assert.deepEqual(engine.positionOf(0), { x: -222, y: 0, z: 0 });
    assert.throws(() => engine.setData(scene(), 2), /revision/u);
  } finally { engine.dispose(); }
});

test('engine teardown continues through a throwing geometry destructor and releases its viewport', async t => {
  const browser = installFakeBrowser(), engine = createGraphEngine();
  const descriptor = Object.getOwnPropertyDescriptor(InstancedBufferGeometry.prototype, 'dispose');
  const original = InstancedBufferGeometry.prototype.dispose;
  let disposed = 0, fail = true;
  t.after(() => { if (descriptor) Object.defineProperty(InstancedBufferGeometry.prototype, 'dispose', descriptor); else Reflect.deleteProperty(InstancedBufferGeometry.prototype, 'dispose'); try { engine.dispose(); } finally { browser.restore(); } });
  engine.setData({ ...scene(), spatialAppearance: { nodeMeshes: [triangleMesh(), null] } }, 1);
  await engine.mount(browser.container, host());
  const context = browser.gl;
  InstancedBufferGeometry.prototype.dispose = function (...args) {
    disposed++; if (fail) { fail = false; throw Error('synthetic geometry disposal failure'); }
    return original.apply(this, args);
  };
  assert.throws(() => engine.dispose(), /synthetic geometry disposal failure/u);
  assert.ok(disposed >= 4);
  assert.equal(browser.container.children.length, 0);
  assert.equal(context.loseContextCalls, 1);
  assert.equal(browser.pendingFrames(), 0);
  assert.doesNotThrow(() => engine.dispose());
});

for (const action of ['replace', 'dispose']) test(`task stop ${action} reentry cannot revive or overwrite a staged replacement`, async t => {
  const browser = installFakeBrowser(), live = new Set(), tasks = [];
  const prototype = InstancedBufferGeometry.prototype;
  const descriptors = new Map(['setAttribute', 'dispose'].map(key => [key, Object.getOwnPropertyDescriptor(prototype, key)]));
  const add = prototype.setAttribute, release = prototype.dispose;
  let peak = 0, armed = false, entered = false, nestedError, engine;
  prototype.setAttribute = function (...args) { live.add(this); peak = Math.max(peak, live.size); return add.apply(this, args); };
  prototype.dispose = function (...args) { live.delete(this); return release.apply(this, args); };
  engine = createGraphEngine({ task() {
    const task = { mode: 'main-thread', stopped: false, update() {}, stop() {
      this.stopped = true;
      if (!armed || entered) return; entered = true;
      if (action === 'dispose') engine.dispose();
      else try { engine.setData({ ...scene(), positions: new Float32Array([-222, 0, 0, 222, 0, 0]), spatialAppearance: { nodeMeshes: [triangleMesh(), null] } }, 3); }
      catch (error) { nestedError = error; }
    } }; tasks.push(task); return task;
  } });
  t.after(() => { try { engine.dispose(); } finally { for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(prototype, key, descriptor); else Reflect.deleteProperty(prototype, key); } browser.restore(); } });
  engine.setData(scene(), 1); await engine.mount(browser.container, host());
  const initial = live.size; peak = initial; armed = true;
  assert.doesNotThrow(() => engine.setData({ ...scene(), positions: new Float32Array([-100, 0, 0, 100, 0, 0]), spatialAppearance: { nodeMeshes: [triangleMesh(), null] } }, 2));
  assert.equal(entered, true); assert.ok(peak <= initial + 4, 'only current plus one prepared owner may be live');
  if (action === 'dispose') {
    assert.equal(engine.positionOf(0), null); assert.equal(live.size, 0); assert.equal(browser.container.children.length, 0);
    assert.equal(tasks.length, 1);
  } else {
    assert.equal(nestedError?.name, 'AbortError'); assert.deepEqual(engine.positionOf(0), { x: -100, y: 0, z: 0 }); assert.equal(live.size, 4);
    assert.equal(tasks[0].stopped, true); assert.equal(tasks.at(-1).stopped, false, 'accepted publication has a current solver');
    assert.throws(() => engine.setData(scene(), 2), /revision/u);
    armed = false; assert.doesNotThrow(() => engine.setData(scene(), 3)); assert.equal(tasks.at(-1).stopped, false);
  }
});

test('published replacement cleanup reports one engine failure after coherent task and drag ownership', async t => {
  const browser = installFakeBrowser(), tasks = [], failures = [];
  const prototype = InstancedBufferGeometry.prototype, descriptor = Object.getOwnPropertyDescriptor(prototype, 'dispose'), original = prototype.dispose;
  let fail = true, engine;
  engine = createGraphEngine({ task() { const task = { mode: 'main-thread', stopped: false, update() {}, stop() { this.stopped = true; } }; tasks.push(task); return task; } });
  t.after(() => { if (descriptor) Object.defineProperty(prototype, 'dispose', descriptor); else Reflect.deleteProperty(prototype, 'dispose'); try { engine.dispose(); } finally { browser.restore(); } });
  engine.setData(scene(), 1);
  await engine.mount(browser.container, { ...host(), lost(reason) { failures.push(reason); engine.dispose(); } });
  prototype.dispose = function (...args) { if (fail) { fail = false; throw Error('synthetic retired owner failure'); } return original.apply(this, args); };
  assert.doesNotThrow(() => engine.setData({ ...scene(), spatialAppearance: { nodeMeshes: [triangleMesh(), null] } }, 2));
  assert.equal(failures.length, 0, 'publication returns before fallback notification reenters the engine');
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(failures, ['error']);
  assert.equal(engine.positionOf(0), null); assert.equal(browser.container.children.length, 0);
  assert.ok(tasks.every(task => task.stopped)); assert.equal(browser.pendingFrames(), 0);
  assert.doesNotThrow(() => engine.dispose());
});
