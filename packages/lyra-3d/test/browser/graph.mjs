import { createEngine } from '@aceshooting/lyra-3d/graph';
import { DEFAULT_LYRA_3D_STYLE, DEFAULT_ORBIT_CAMERA } from '@aceshooting/lyra-3d/core';

const WIDTH = 640;
const HEIGHT = 480;
let active;
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, message, timeout = 10000) {
  const deadline = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error(message);
    await wait(20);
  }
}
const state = (selected = []) => ({ selected: new Set(selected), dimmed: new Set(), hover: -1, focus: -1 });
const data = (extra = {}) => ({
  nodeCount: 2, positions: new Float32Array([-80, 0, 100, 80, 0, 100]),
  source: new Uint32Array([0]), target: new Uint32Array([1]),
  sizes: new Float32Array([20, 20]), directed: new Uint8Array([1]),
  ...extra,
});

export function cleanupGraph() {
  active?.engine.dispose();
  active?.container.remove();
  active = undefined;
}
async function mount(input = data(), extraStyle = {}) {
  cleanupGraph();
  const container = document.createElement('div');
  container.style.cssText = `position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px`;
  document.body.replaceChildren(container);
  const engine = createEngine();
  const calls = { camera: [], pick: [], hover: [], lost: [], restored: 0, rendering: [] };
  const record = { engine, container, calls, input, selected: [], pointerId: undefined, checkpoints: {} };
  active = record;
  engine.setData(input, 0);
  engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, background: '#000000', foreground: '#ffff00',
    muted: '#ffffff', accent: '#ff0000', focus: '#00ffff', palette: ['#00ff00'],
    pointSize: 20, lineWidth: 2, reducedMotion: true, ...extraStyle });
  engine.setCamera(DEFAULT_ORBIT_CAMERA);
  await engine.mount(container, {
    hover: (item) => calls.hover.push(item),
    pick: (item, modifiers) => calls.pick.push({ item, ...modifiers }),
    camera: (camera) => calls.camera.push(camera),
    lost: (reason) => calls.lost.push(reason),
    restored: () => { calls.restored += 1; },
    rendering: (info) => calls.rendering.push(info),
  });
  engine.resize(WIDTH, HEIGHT);
  record.canvas = container.querySelector('canvas');
  if (!record.canvas) throw new Error('Graph engine did not mount a canvas');
  record.gl = record.canvas.getContext('webgl2');
  if (!record.gl) throw new Error('Graph canvas has no WebGL2 context');
  record.canvas.addEventListener('pointerdown', (event) => { record.pointerId = event.pointerId; }, true);
  // Engine capture listeners can stop propagation on the target; an ancestor observes trusted downs first.
  container.addEventListener('pointerdown', (event) => { record.pointerId = event.pointerId; }, true);
  await nextFrame();
  return record;
}
async function pixels(record, selected = record.selected) {
  record.selected = selected;
  record.engine.setState(state(selected));
  return new Promise((resolve) => requestAnimationFrame(() => {
    const result = new Uint8Array(WIDTH * HEIGHT * 4);
    record.gl.readPixels(0, 0, WIDTH, HEIGHT, record.gl.RGBA, record.gl.UNSIGNED_BYTE, result);
    resolve(result);
  }));
}
const near = (a, b, epsilon = 0.02) => Math.abs(a - b) <= epsilon;
function pixelAt(buffer, point) {
  const x = Math.max(0, Math.min(WIDTH - 1, Math.round(point.x)));
  const y = Math.max(0, Math.min(HEIGHT - 1, HEIGHT - 1 - Math.round(point.y)));
  return [...buffer.slice((y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 4)];
}
function yellowPixels(buffer) {
  let count = 0;
  for (let i = 0; i < buffer.length; i += 4) if (buffer[i] > 100 && buffer[i + 1] > 100 && buffer[i + 2] < 50) count += 1;
  return count;
}
function findArrowPick(record) {
  const target = record.engine.project(1);
  // Pick reads floor(x/y) + 0.5 pixel centers. The six-sided cone is only
  // 2.51px wide at its base; sample the 1.5px row outside the 1px shaft.
  for (let x = target.x - 17; x <= target.x - 11; x += 0.5) {
    for (let dy = 1; dy <= 3; dy += 0.5) if (record.engine.pick(x, target.y + dy) === 2) return { x, y: target.y + dy };
  }
  return null;
}

export const graphCases = {
  async 'graph-render-label-arrow-pick'() {
    const record = await mount();
    const baseline = await pixels(record);
    const arrow = findArrowPick(record);
    record.engine.setData(data({ directed: new Uint8Array([0]) }), 1);
    await pixels(record);
    const withoutArrow = arrow ? record.engine.pick(arrow.x, arrow.y) : undefined;
    record.engine.setData(data({ labels: ['<plain label>', 'Target'], edgeLabels: ['Directed edge'], nodeLabels: 'always', withEdgeLabels: true }), 2);
    const painted = await pixels(record);
    const points = [record.engine.project(0), record.engine.project(1)];
    return { passed: yellowPixels(baseline) === 0 && yellowPixels(painted) > 10 && arrow !== null && withoutArrow === null &&
      points.every((point, index) => record.engine.pick(point.x, point.y) === index) && record.calls.rendering.length === 1,
    labelPixels: yellowPixels(painted), arrow, withoutArrow, software: record.calls.rendering[0]?.software };
  },
  async 'graph-selection-camera-parity'() {
    const record = await mount();
    const point = record.engine.project(0);
    const before = pixelAt(await pixels(record), point);
    const after = pixelAt(await pixels(record, [0]), point);
    record.engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, yaw: 0.4 });
    const focused = record.engine.focus(1, 300);
    await pixels(record);
    const center = record.engine.project(1);
    const fitted = record.engine.fit(24);
    await pixels(record);
    return { passed: before[1] > before[0] && after[0] > after[1] && record.calls.camera.length === 0 &&
      near(center.x, WIDTH / 2) && near(center.y, HEIGHT / 2) && focused.distance === 300 && fitted.distance > 0 &&
      [0, 1].every((item) => { const p = record.engine.project(item); return p && p.x >= 0 && p.x <= WIDTH && p.y >= 0 && p.y <= HEIGHT; }),
    before, after, center, cameraEvents: record.calls.camera.length };
  },
  async 'graph-context-restore-dispose'() {
    const record = await mount(data({ labels: ['Node', 'Target'], nodeLabels: 'always' }));
    const extension = record.gl.getExtension('WEBGL_lose_context');
    if (!extension) return { passed: true, skipped: 'WEBGL_lose_context unavailable' };
    extension.loseContext();
    await until(() => record.calls.lost.includes('context-lost'), 'Graph did not report context loss');
    const lostPick = record.engine.pick(320, 240);
    await wait(100);
    extension.restoreContext();
    await until(() => record.calls.restored === 1, 'Graph did not report context restoration');
    const painted = await pixels(record);
    const point = record.engine.project(0);
    const restoredPick = record.engine.pick(point.x, point.y);
    const lostCalls = record.calls.lost.length;
    record.engine.dispose(); record.engine.dispose();
    await until(() => record.gl.isContextLost(), 'Graph disposal did not release WebGL context');
    await wait(40);
    return { passed: lostPick === null && restoredPick === 0 && yellowPixels(painted) > 0 && !record.canvas.isConnected &&
      record.engine.positionOf(0) === null && record.calls.lost.length === lostCalls,
    restoredPick, labelPixels: yellowPixels(painted), contextLost: record.gl.isContextLost() };
  },
  async 'graph-real-worker-progress-replacement'() {
    const NativeWorker = globalThis.Worker;
    if (typeof NativeWorker !== 'function') return { passed: false, error: 'This case requires native module workers' };
    const workers = [];
    const terminated = new Set();
    const outputs = new Set();
    class TrackedWorker extends NativeWorker {
      constructor(...args) {
        super(...args); workers.push(this);
        this.addEventListener('message', (event) => { if (event.data?.type === 'output') outputs.add(this); });
      }
      terminate() { terminated.add(this); return super.terminate(); }
    }
    globalThis.Worker = TrackedWorker;
    try {
      const record = await mount(data({ positions: new Float32Array([-80, 0, 0, 80, 0, 0]), pinned: new Uint8Array(2), options: { maxSteps: 1000, cooling: 1, minAlpha: 0, stableSteps: 1000 } }));
      await until(() => outputs.size > 0 && Math.abs(record.engine.positionOf(0).x + 80) > 0.1, 'Native worker layout did not advance');
      record.engine.setData(data({ positions: new Float32Array([-25, 20, 0, 25, 20, 0]) }), 1);
      await pixels(record);
      await wait(100);
      const replacement = record.engine.positionOf(0);
      record.engine.dispose();
      return { passed: workers.length >= 2 && outputs.size > 0 && terminated.size === workers.length && replacement.x === -25 && replacement.y === 20,
        workers: workers.length, outputs: outputs.size, terminated: terminated.size, replacement };
    } finally { cleanupGraph(); globalThis.Worker = NativeWorker; }
  },
  async 'graph-main-thread-fallback-progress'() {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
    try {
      Object.defineProperty(globalThis, 'Worker', { configurable: true, value: undefined });
      const record = await mount(data({ positions: new Float32Array([-80, 0, 0, 80, 0, 0]), pinned: new Uint8Array(2) }));
      await until(() => Math.abs(record.engine.positionOf(0).x + 80) > 0.1, 'Fallback layout did not advance');
      return { passed: record.calls.lost.length === 0 && Number.isFinite(record.engine.positionOf(0).x), position: record.engine.positionOf(0) };
    } finally { cleanupGraph(); if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else delete globalThis.Worker; }
  },
};

async function preparePointer(free = false) {
  let record;
  const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  try {
    if (free) Object.defineProperty(globalThis, 'Worker', { configurable: true, value: undefined });
    record = await mount(data({ pinned: new Uint8Array([free ? 0 : 1, 1]), options: { charge: 0, linkStrength: 0.03, centerStrength: 0, maxSteps: 1 } }));
  } finally {
    if (free) {
      if (workerDescriptor) Object.defineProperty(globalThis, 'Worker', workerDescriptor);
      else delete globalThis.Worker;
    }
  }
  if (free) await until(() => Math.abs(record.engine.positionOf(0).x + 80) > 0.1, 'Initial free layout step did not complete');
  await pixels(record);
  record.original = record.engine.positionOf(0);
  const start = record.engine.project(0);
  const end = { x: start.x + 40, y: start.y + 25 };
  return { setup: { start, end }, original: record.original };
}
export async function graphPointerCheckpoint(name, action) {
  const record = active;
  const point = record.engine.project(0);
  record.checkpoints.moved = { point, captured: record.canvas.hasPointerCapture(record.pointerId), position: record.engine.positionOf(0) };
  if (action === 'cancel') {
    if (!record.canvas.hasPointerCapture(record.pointerId)) throw new Error('Trusted drag did not capture its pointer');
    record.canvas.releasePointerCapture(record.pointerId);
    // Native lostpointercapture is delivered by the next pointer event; root sends mouse.up next.
  } else if (action === 'replace') {
    record.engine.setData(data({ positions: new Float32Array([-30, 15, 0, 30, 15, 0]) }), 1);
    record.checkpoints.captureAfterReplacement = record.canvas.hasPointerCapture(record.pointerId);
  } else if (action !== 'moved') throw new Error(`Unknown graph checkpoint ${name}:${action}`);
  return record.checkpoints;
}
function movedAsRequested(record, setup) {
  const moved = record.checkpoints.moved;
  return moved?.captured && near(moved.point.x, setup.setup.end.x) && near(moved.point.y, setup.setup.end.y);
}
export const graphPointerCases = {
  'graph-drag-pin': () => preparePointer(true),
  async 'graph-drag-pin:verify'(setup) {
    const record = active;
    // This case mounts a main-thread task: its queued update timer precedes this timer.
    await wait(0);
    await pixels(record);
    const position = record.engine.positionOf(0);
    const held = record.checkpoints.moved.position;
    await wait(100);
    return { passed: movedAsRequested(record, setup) && JSON.stringify(position) === JSON.stringify(held) &&
      JSON.stringify(record.engine.positionOf(0)) === JSON.stringify(held) &&
      !record.canvas.hasPointerCapture(record.pointerId) && record.calls.pick.length === 0,
    position, moved: record.checkpoints.moved };
  },
  'graph-drag-cancel': () => preparePointer(),
  async 'graph-drag-cancel:verify'(setup) {
    const record = active;
    await pixels(record);
    return { passed: movedAsRequested(record, setup) && JSON.stringify(record.engine.positionOf(0)) === JSON.stringify(record.original) &&
      !record.canvas.hasPointerCapture(record.pointerId), position: record.engine.positionOf(0), moved: record.checkpoints.moved };
  },
  'graph-drag-replace': () => preparePointer(),
  async 'graph-drag-replace:verify'(setup) {
    const record = active;
    await pixels(record);
    const position = record.engine.positionOf(0);
    return { passed: movedAsRequested(record, setup) && record.checkpoints.captureAfterReplacement === false &&
      position.x === -30 && position.y === 15 && record.calls.pick.length === 0, position };
  },
  async 'graph-orbit'() {
    const record = await mount();
    return { setup: { start: { x: 320, y: 420 }, end: { x: 420, y: 390 } }, camera: DEFAULT_ORBIT_CAMERA };
  },
  async 'graph-orbit:verify'() {
    const record = active;
    await pixels(record);
    return { passed: record.calls.camera.length > 0 && Math.abs(record.calls.camera.at(-1).yaw) > 0.1 && record.calls.pick.length === 0,
      cameraEvents: record.calls.camera.length, camera: record.calls.camera.at(-1) };
  },
  async 'graph-pick'() {
    const record = await mount();
    return { setup: { start: record.engine.project(0), end: record.engine.project(1) } };
  },
  async 'graph-pick:verify'() {
    const record = active;
    await pixels(record);
    return { passed: record.calls.pick.some((event) => event.item === 0 && !event.double) &&
      record.calls.pick.some((event) => event.item === 1 && event.double), picks: record.calls.pick };
  },
};
