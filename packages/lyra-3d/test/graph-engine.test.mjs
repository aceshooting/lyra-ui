import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import { createGraphEngine } from '../dist/graph/engine.js';
import { createGraphTaskKernel } from '../dist/graph/layout-task.js';
import { DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';

const data = () => ({ nodeCount: 2, positions: new Float32Array([-10, 0, 0, 10, 0, 0]), source: new Uint32Array([0]), target: new Uint32Array([1]) });
function harness(services = {}) {
  const jobs = [];
  const events = [];
  const canvas = new EventTarget();
  const captures = new Set();
  Object.assign(canvas, { setPointerCapture: (id) => captures.add(id), hasPointerCapture: (id) => captures.has(id), releasePointerCapture: (id) => captures.delete(id), getBoundingClientRect: () => ({ left: 0, top: 0 }) });
  const viewport = {
    canvas, world: new Group(), pickWorld: new Group(), scene: new Group(), width: 640, height: 480,
    orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(), lost: false, disposed: false,
    setStyle(value) { this.style = resolveLyra3dStyle(value); },
    setOrbit(value) { this.orbit = value; },
    project(point) { return projectOrbitPoint(point, this.orbit, this); },
    invalidate() {}, onFrame(callback) { this.tick = callback; return () => { this.tick = undefined; }; }, pickAt() { return 0; },
    resize(w, h) { this.width = w; this.height = h; }, dispose() { this.disposed = true; },
  };
  const host = { hover() {}, pick() {}, camera(value) { events.push(value); }, lost() {} };
  const engine = createGraphEngine({ ...services, viewport: () => viewport, task(options) {
    const job = { options, stopped: false, updates: [], mode: 'main-thread', stop() { this.stopped = true; }, update(value) { this.updates.push(value); } };
    jobs.push(job); return job;
  } });
  return { engine, viewport, jobs, host, events };
}

test('graph replacement disposes retired resources and ignores late layout outputs', async () => {
  const { engine, viewport, jobs, host } = harness();
  engine.setData(data(), 0); await engine.mount({}, host);
  assert.equal(viewport.world.children.length, 2);
  assert.equal(viewport.pickWorld.children.length, 2);
  let disposed = 0;
  viewport.world.children[0].geometry.addEventListener('dispose', () => disposed++);
  const old = jobs[0];
  engine.setData(data(), 1);
  assert.equal(old.stopped, true); assert.equal(disposed, 1);
  old.options.onOutput({ positions: new Float32Array(6).fill(90), epoch: 0 }, false);
  assert.deepEqual(engine.positionOf(0), { x: -10, y: 0, z: 0 });
  jobs[1].options.onOutput({ positions: new Float32Array([1, 2, 3, 4, 5, 6]), epoch: 0 }, false);
  assert.deepEqual(engine.positionOf(0), { x: 1, y: 2, z: 3 });
  engine.dispose(); engine.dispose();
  assert.equal(jobs[1].stopped, true); assert.equal(viewport.disposed, true);
  assert.equal(viewport.world.children.length, 0);
  jobs[1].options.onOutput({ positions: new Float32Array(6), epoch: 0 }, false);
  assert.equal(engine.positionOf(0), null);
});

test('pin epochs discard queued pre-pin frames; invalid updates and revisions are atomic', async () => {
  const { engine, jobs, host } = harness();
  engine.setData(data(), 0); await engine.mount({}, host);
  const pin = { indices: new Uint32Array([0]), positions: new Float32Array([7, 8, 9]), pinned: new Uint8Array([1]) };
  engine.setPins(pin); pin.positions.fill(0);
  assert.equal(jobs[0].updates[0].update.positions[0], 7);
  jobs[0].options.onOutput({ positions: new Float32Array(6), epoch: 0 }, false);
  assert.deepEqual(engine.positionOf(0), { x: 7, y: 8, z: 9 });
  assert.throws(() => engine.setPins({ ...pin, indices: new Uint32Array([5]) }));
  assert.throws(() => engine.setPins({ indices: new Uint32Array([0, 0]), positions: new Float32Array(6), pinned: new Uint8Array(2) }));
  assert.throws(() => engine.setPins({ ...pin, positions: new Float32Array([NaN, 0, 0]) }));
  assert.throws(() => engine.setData(data(), 0));
  assert.equal(jobs.length, 1);
  assert.deepEqual(engine.positionOf(0), { x: 7, y: 8, z: 9 });
  engine.dispose();
});

test('camera commands remain silent and instance colors reflect owned selection state', async () => {
  const { engine, viewport, host, events } = harness();
  engine.setData(data(), 0); await engine.mount({}, host);
  const before = viewport.world.children[0].instanceColor.array.slice();
  const selected = new Set([0]);
  engine.setState({ selected, dimmed: new Set(), hover: -1, focus: -1 }); selected.clear();
  assert.notDeepEqual(viewport.world.children[0].instanceColor.array, before);
  engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, yaw: 1 }); engine.fit(); engine.focus(0);
  assert.equal(events.length, 0); assert.ok(engine.project(0));
  engine.dispose();
});

test('shared task adapter retains identical layout state across transferred output buffers and pin epochs', () => {
  const input = { type: 'start', data: { ...data(), pinned: new Uint8Array(2) } };
  const worker = createGraphTaskKernel(input);
  const fallback = createGraphTaskKernel(input);
  const first = worker.step();
  const received = structuredClone(first.output, { transfer: [first.output.positions.buffer] });
  assert.deepEqual(received, fallback.step().output);
  const update = { type: 'pins', update: { indices: new Uint32Array([0]), positions: new Float32Array([3, 4, 5]), pinned: new Uint8Array([1]) } };
  worker.update(update); fallback.update(update);
  const next = worker.step();
  assert.equal(next.output.epoch, 1); assert.deepEqual(next, fallback.step());
  assert.deepEqual([...next.output.positions.slice(0, 3)], [3, 4, 5]);
});

test('synchronous mount callbacks cannot resurrect a disposed engine', async () => {
  let released = 0;
  let engine;
  engine = createGraphEngine({ viewport(_container, host) {
    host.rendering({ software: false });
    return { dispose() { released++; } };
  } });
  await engine.mount({}, { hover() {}, pick() {}, camera() {}, lost() {}, rendering() { engine.dispose(); } });
  assert.equal(released, 1);
  assert.equal(engine.positionOf(0), null);
  await assert.rejects(engine.mount({}, {}));
});


test('drag moves at node depth, cancellation restores its original pin and replacement releases capture', async () => {
  const { engine, viewport, jobs, host } = harness();
  engine.setData({ ...data(), positions: new Float32Array([-10, 0, 100, 10, 0, 0]), pinned: new Uint8Array(2) }, 0);
  await engine.mount({}, host);
  const pointer = (type, x, y) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, button: 0, isPrimary: true, clientX: x, clientY: y, shiftKey: false, ctrlKey: false, metaKey: false });
    viewport.canvas.dispatchEvent(event);
  };
  const before = engine.project(0);
  pointer('pointerdown', before.x, before.y);
  pointer('pointermove', before.x + 20, before.y + 10);
  const moved = engine.project(0);
  assert.ok(Math.abs(moved.x - before.x - 20) < 0.001);
  assert.ok(Math.abs(moved.y - before.y - 10) < 0.001);
  assert.equal(jobs[0].updates.at(-1).update.pinned[0], 1);
  pointer('pointercancel', before.x + 20, before.y + 10);
  assert.deepEqual(engine.positionOf(0), { x: -10, y: 0, z: 100 });
  assert.equal(jobs[0].updates.at(-1).update.pinned[0], 0);
  pointer('pointerdown', before.x, before.y);
  assert.equal(viewport.canvas.hasPointerCapture(1), true);
  engine.setData(data(), 1);
  assert.equal(viewport.canvas.hasPointerCapture(1), false);
  engine.dispose();
});


test('particle frames retain base matrices until layout, camera, size or style changes', async () => {
  const { engine, viewport, host } = harness();
  engine.setData({ ...data(), directed: new Uint8Array([1]), particlesPerEdge: 2 }, 0);
  await engine.mount({}, host);
  viewport.tick(0);
  const nodes = viewport.world.children[0];
  const arrows = viewport.world.children[2];
  const version = nodes.instanceMatrix.version;
  const arrowVersion = arrows.instanceMatrix.version;
  viewport.tick(100);
  assert.equal(nodes.instanceMatrix.version, version);
  assert.equal(arrows.instanceMatrix.version, arrowVersion);
  engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, yaw: 0.5 }); viewport.tick(200);
  assert.ok(nodes.instanceMatrix.version > version);
  assert.ok(arrows.instanceMatrix.version > arrowVersion);
  const afterCamera = nodes.instanceMatrix.version;
  engine.resize(800, 600); viewport.tick(300);
  assert.ok(nodes.instanceMatrix.version > afterCamera);
  engine.dispose();
});


test('renderer coordinate admission and pin bounds are inclusive and atomic', async () => {
  const { engine, jobs, host } = harness();
  const limit = 10_000_000;
  engine.setData({ ...data(), positions: new Float32Array([-limit, 0, limit, limit, 0, -limit]) }, 0);
  await engine.mount({}, host);
  assert.deepEqual(engine.positionOf(0), { x: -limit, y: 0, z: limit });
  const before = engine.positionOf(0);
  assert.throws(() => engine.setData({ ...data(), positions: new Float32Array([limit + 1, 0, 0, 0, 0, 0]) }, 1), /world range/u);
  assert.equal(jobs.length, 1); assert.equal(jobs[0].stopped, false);
  assert.deepEqual(engine.positionOf(0), before);
  assert.throws(() => engine.setPins({ indices: new Uint32Array([0, 1]), positions: new Float32Array([1, 2, 3, -limit - 1, 0, 0]), pinned: new Uint8Array([0, 1]) }), /world range/u);
  assert.deepEqual(engine.positionOf(0), before); assert.equal(jobs[0].updates.length, 0);
  engine.setPins({ indices: new Uint32Array([0]), positions: new Float32Array([limit, -limit, limit]), pinned: new Uint8Array([1]) });
  assert.deepEqual(engine.positionOf(0), { x: limit, y: -limit, z: limit });
  engine.setData(data(), 1); assert.equal(jobs.length, 2);
  engine.dispose();
});

test('an out-of-range layout frame stops its task without exposing unrenderable positions', async () => {
  const { engine, jobs, host } = harness();
  const losses = []; host.lost = (...args) => losses.push(args);
  engine.setData(data(), 0); await engine.mount({}, host);
  jobs[0].options.onOutput({ positions: new Float32Array([10_000_001, 0, 0, 10, 0, 0]), epoch: 0 }, false);
  assert.equal(jobs[0].stopped, true); assert.equal(losses.length, 1); assert.equal(losses[0][0], 'error');
  assert.deepEqual(engine.positionOf(0), { x: -10, y: 0, z: 0 });
  jobs[0].options.onOutput({ positions: new Float32Array(6), epoch: 0 }, false);
  assert.deepEqual(engine.positionOf(0), { x: -10, y: 0, z: 0 });
  assert.equal(losses.length, 1);
  engine.setData(data(), 1); assert.equal(jobs.length, 2);
  engine.dispose();
});

test('spatial appearance preserves node/edge IDs and invalid replacements retain current resources', async () => {
  const { engine, viewport, host, jobs } = harness();
  const input = { ...data(), sizes: new Float32Array([30, 30]), directed: new Uint8Array([1]), spatialAppearance: { sizeUnits: 'world', nodeShapes: new Uint8Array([1, 2]), edgeWidths: new Float32Array([2]) } };
  engine.setData(input, 0); await engine.mount({}, host);
  const edge = viewport.pickWorld.children.find((mesh) => mesh.geometry.getAttribute('stroke'));
  const nodes = viewport.pickWorld.children.find((mesh) => mesh.geometry.getAttribute('nodeShape'));
  const composite = viewport.world.children.find((mesh) => mesh.geometry.getAttribute('payload0'));
  assert.ok(composite); assert.equal(viewport.world.children.some((mesh) => mesh.geometry.getAttribute('stroke') || mesh.geometry.getAttribute('nodeShape')), false);
  assert.ok(edge && nodes); assert.equal(edge.geometry.instanceCount, 2); assert.equal(nodes.geometry.getAttribute('nodeShape').getX(1), 2);
  const pick = viewport.pickWorld.children.find((mesh) => mesh.geometry === nodes.geometry); assert.equal(pick.renderOrder, 1);
  const old = jobs[0]; assert.throws(() => engine.setData({ ...input, spatialAppearance: { nodeShapes: new Uint8Array([4, 0]) } }, 1));
  assert.equal(old.stopped, false); assert.equal(viewport.world.children.includes(composite), true);
  engine.setState({ selected: new Set([0, 2]), dimmed: new Set(), hover: -1, focus: -1 });
  assert.equal(nodes.geometry.getAttribute('nodeFlags').getX(0), 1); assert.equal(edge.geometry.getAttribute('stroke').getX(0), 4);
  engine.setData(data(), 1); assert.equal(old.stopped, true); assert.equal(nodes.parent, null); engine.dispose();
});

test('spatial camera frames update uniforms only; positions and paint have separate invalidations', async () => {
  const { engine, viewport, host } = harness();
  engine.setData({ ...data(), directed: new Uint8Array([1]), spatialAppearance: { edgeColors: new Float32Array([1, 0, 0, 0.5]) } }, 0); await engine.mount({}, host);
  const edge = viewport.pickWorld.children.find((mesh) => mesh.geometry.getAttribute('stroke'));
  const nodes = viewport.pickWorld.children.find((mesh) => mesh.geometry.getAttribute('nodeShape'));
  const composite = viewport.world.children.find((mesh) => mesh.geometry.getAttribute('payload0'));
  const versions = () => [edge.geometry.getAttribute('edgeStart'), edge.geometry.getAttribute('stroke'), nodes.geometry.getAttribute('nodePosition'), nodes.geometry.getAttribute('nodeFill'), composite.geometry.getAttribute('payload0')].map((a) => a.version);
  viewport.tick(0); const before = versions();
  for (const camera of [{ ...DEFAULT_ORBIT_CAMERA, distance: 900 }, { ...DEFAULT_ORBIT_CAMERA, target: { x: 30, y: 0, z: 0 } }, { ...DEFAULT_ORBIT_CAMERA, yaw: 0.01 }]) {
    engine.setCamera(camera); viewport.tick(1); assert.deepEqual(versions(), before, JSON.stringify(camera));
  }
  assert.equal(composite.material.uniforms.lyraView.value.w, Math.max(0.5, 500 * 4 + 1e4));
  engine.resize(320, 200); viewport.tick(2); assert.deepEqual(versions(), before);
  assert.deepEqual(composite.material.uniforms.viewWindow.value.toArray(), [0, 0, 320, 200]);
  engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, yaw: 1 }); viewport.tick(3);
  assert.deepEqual(versions().slice(0, 4), before.slice(0, 4)); assert.ok(versions()[4] > before[4], 'translucent strokes re-sort after a material turn');
  const turned = versions();
  const fill = nodes.geometry.getAttribute('nodeFill').array.slice();
  const stroke = edge.geometry.getAttribute('stroke').array.slice();
  engine.setPins({ indices: new Uint32Array([0]), positions: new Float32Array([7, 8, 9]), pinned: new Uint8Array([1]) }); viewport.tick(4);
  const moved = versions();
  for (const index of [0, 2, 4]) assert.ok(moved[index] > turned[index], 'pinning uploads endpoints, node positions and composite positions');
  for (const index of [1, 3]) assert.equal(moved[index], turned[index], 'position changes leave stroke and fill uploads intact');
  assert.deepEqual(Array.from(nodes.geometry.getAttribute('nodePosition').array), [7, 8, 9, 10, 0, 0]);
  assert.deepEqual(Array.from(edge.geometry.getAttribute('edgeStart').array), [7, 8, 9, 7, 8, 9]);
  assert.deepEqual(nodes.geometry.getAttribute('nodeFill').array, fill);
  assert.deepEqual(edge.geometry.getAttribute('stroke').array, stroke);
  const payload = composite.geometry.getAttribute('payload0'), kind = composite.geometry.getAttribute('payload4');
  const drawnNode = Array.from({ length: composite.geometry.instanceCount }, (_, row) => row)
    .find(row => kind.getW(row) >= 0 && payload.getX(row) === 7 && payload.getY(row) === 8 && payload.getZ(row) === 9);
  assert.notEqual(drawnNode, undefined, 'the final draw payload contains the pinned node');
  const flags = nodes.geometry.getAttribute('nodeFlags'), drawFlags = composite.geometry.getAttribute('payload1');
  const flagVersion = flags.version, drawFlagVersion = drawFlags.version;
  const pinned = versions(); engine.setState({ selected: new Set([0]), dimmed: new Set(), hover: -1, focus: -1 });
  assert.deepEqual(versions(), pinned, 'selection preserves geometry, endpoints, stroke and base fill');
  assert.ok(flags.version > flagVersion); assert.deepEqual([flags.getX(0), flags.getX(1)], [1, 0]);
  assert.ok(drawFlags.version > drawFlagVersion); assert.equal(drawFlags.getY(drawnNode), 1, 'the selected ring flag reaches the final draw payload');
  assert.deepEqual(nodes.geometry.getAttribute('nodeFill').array, fill);
  engine.dispose();
});

test('appearance transactions preserve positions, pins, task, revision and selection', async () => {
  const { engine, viewport, host, jobs } = harness();
  engine.setData({ ...data(), spatialAppearance: { nodeShapes: new Uint8Array([0, 0]) } }, 0); await engine.mount({}, host);
  engine.setPins({ indices: new Uint32Array([0]), positions: new Float32Array([7, 8, 9]), pinned: new Uint8Array([1]) });
  engine.setState({ selected: new Set([0]), dimmed: new Set(), hover: -1, focus: -1 });
  const job = jobs[0], old = viewport.world.children[0]; let disposed = 0; old.geometry.addEventListener('dispose', () => disposed++);
  engine.setAppearance({ spatialAppearance: { nodeShapes: new Uint8Array([2, 1]) }, nodeLabels: 'none' });
  assert.deepEqual(engine.positionOf(0), { x: 7, y: 8, z: 9 }); assert.equal(jobs.length, 1); assert.equal(job.stopped, false); assert.equal(disposed, 1);
  const nodes = viewport.pickWorld.children.find((mesh) => mesh.geometry.hasAttribute('nodeShape'));
  assert.equal(nodes.geometry.getAttribute('nodeShape').getX(0), 2); assert.equal(nodes.geometry.getAttribute('nodeFlags').getX(0), 1);
  assert.throws(() => engine.setAppearance({ positions: new Float32Array(6) }), /appearance/);
  assert.throws(() => engine.setAppearance({ spatialAppearance: { nodeShapes: new Uint8Array([3, 0]) } }));
  assert.equal(viewport.pickWorld.children.includes(nodes), true); assert.equal(job.stopped, false);
  engine.setData(data(), 1); assert.equal(job.stopped, true); engine.dispose();
});

test('appearance resource failure retains the prior scene and accepts a later retry', async () => {
  const canvas = new EventTarget(); const view = { canvas, world: new Group(), pickWorld: new Group(), scene: new Group(), width: 640, height: 480, orbit: DEFAULT_ORBIT_CAMERA, style: resolveLyra3dStyle(),
    setStyle(v) { this.style = resolveLyra3dStyle(v); }, setOrbit(v) { this.orbit = v; }, project(p) { return projectOrbitPoint(p, this.orbit, this); }, invalidate() {}, onFrame() { return () => {}; }, dispose() {} };
  const engine = createGraphEngine({ viewport: () => view, task: () => ({ stop() {}, update() {}, mode: 'main-thread' }), labelCanvas() { throw new Error('label resource failed'); } });
  engine.setData({ ...data(), spatialAppearance: {} }, 0); await engine.mount({}, { hover() {}, pick() {}, camera() {}, lost() {} });
  const original = view.world.children[0]; let disposed = 0; original.geometry.addEventListener('dispose', () => disposed++);
  assert.throws(() => engine.setAppearance({ labels: ['a', 'b'] }), /label resource failed/);
  assert.equal(view.world.children[0], original); assert.equal(disposed, 0); assert.deepEqual(engine.positionOf(0), { x: -10, y: 0, z: 0 });
  engine.setAppearance({ nodeLabels: 'none', spatialAppearance: { nodeShapes: new Uint8Array([1, 1]) } });
  assert.equal(disposed, 1); engine.dispose();
});

test('appearance replacement retains an active drag and its cancel pin restoration', async () => {
  const { engine, viewport, jobs, host } = harness();
  engine.setData({ ...data(), pinned: new Uint8Array(2), spatialAppearance: {} }, 0); await engine.mount({}, host);
  const pointer = (type, x, y) => { const event = new Event(type, { cancelable: true }); Object.assign(event, { pointerId: 1, button: 0, isPrimary: true, clientX: x, clientY: y, shiftKey: false }); viewport.canvas.dispatchEvent(event); };
  const start = engine.project(0); pointer('pointerdown', start.x, start.y); pointer('pointermove', start.x + 20, start.y);
  const moved = engine.positionOf(0); engine.setAppearance({ spatialAppearance: { nodeShapes: new Uint8Array([1, 2]) } });
  assert.deepEqual(engine.positionOf(0), moved); assert.equal(viewport.canvas.hasPointerCapture(1), true); assert.equal(jobs.length, 1);
  pointer('pointermove', start.x + 40, start.y); assert.ok(engine.positionOf(0).x > moved.x);
  pointer('pointercancel', start.x + 40, start.y); assert.deepEqual(engine.positionOf(0), { x: -10, y: 0, z: 0 });
  assert.equal(jobs[0].updates.at(-1).update.pinned[0], 0); engine.dispose();
});

test('appearance admission cannot overwrite reentrant disposal or newer topology before mount', () => {
  const first = harness(); first.engine.setData({ ...data(), spatialAppearance: {} }, 0);
  first.engine.setAppearance(new Proxy({}, { ownKeys() { first.engine.dispose(); return []; } }));
  assert.equal(first.engine.positionOf(0), null);
  const second = harness(); second.engine.setData({ ...data(), spatialAppearance: {} }, 0);
  const appearance = Object.defineProperty({}, 'nodeShapes', { get() { second.engine.setData({ ...data(), positions: new Float32Array([99, 0, 0, 10, 0, 0]), spatialAppearance: {} }, 1); return new Uint8Array([2, 2]); } });
  second.engine.setAppearance({ spatialAppearance: appearance });
  assert.equal(second.engine.positionOf(0).x, 99);
  second.engine.setData({ ...data(), spatialAppearance: {} }, 2); assert.equal(second.engine.positionOf(0).x, -10); second.engine.dispose();
});


test('appearance resource callbacks cannot resurrect a disposed engine', async () => {
  let engine;
  const fixture = harness({ labelCanvas() { engine.dispose(); return { getContext() { return null; } }; } }); engine = fixture.engine;
  engine.setData({ ...data(), spatialAppearance: {} }, 0); await engine.mount({}, fixture.host);
  engine.setAppearance({ labels: ['a', 'b'] });
  assert.equal(engine.positionOf(0), null); assert.equal(fixture.viewport.world.children.length, 0); assert.equal(fixture.viewport.pickWorld.children.length, 0);
  assert.equal(fixture.jobs[0].stopped, true);
});


test('appearance replacement without label objects does not add an undefined scene child', async (t) => {
  const errors = [];
  t.mock.method(console, 'error', (...args) => { errors.push(args.map(String).join(' ')); });
  const { engine, viewport, host, jobs } = harness();
  try {
    engine.setData({ ...data(), spatialAppearance: {} }, 0); await engine.mount({}, host);
    const before = engine.positionOf(0), task = jobs[0];
    assert.equal(viewport.scene.children.length, 0);
    for (const nodeLabels of ['none', 'always', 'none']) {
      engine.setAppearance({ nodeLabels, spatialAppearance: { nodeShapes: new Uint8Array([1, 2]) } });
      assert.equal(viewport.scene.children.length, 0);
      assert.deepEqual(engine.positionOf(0), before);
      assert.equal(jobs.length, 1); assert.equal(jobs[0], task); assert.equal(task.stopped, false);
      assert.equal(viewport.world.children.length > 0, true);
    }
    assert.deepEqual(errors, []);
  } finally { engine.dispose(); }
});
