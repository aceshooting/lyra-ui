import { createEngine } from '@aceshooting/lyra-3d/points';
import { DEFAULT_LYRA_3D_STYLE, DEFAULT_ORBIT_CAMERA, projectOrbitPoint } from '@aceshooting/lyra-3d/core';

const WIDTH = 640;
const HEIGHT = 480;
let active;
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const near = (a, b, tolerance = 2) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
const state = (extra = {}) => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });
const data = (extra = {}) => ({ positions: new Float32Array([-80, -40, 0, 80, 40, 0]), ...extra });
const axes = () => [
  { axis: 'x', min: -120, max: 120, label: 'Horizontal', ticks: [{ value: -60, label: '-60' }, { value: 60, label: '60' }], grid: true },
  { axis: 'y', min: -100, max: 100, label: 'Vertical', ticks: [{ value: -60, label: '-60' }, { value: 60, label: '60' }], grid: true },
];

async function until(predicate, message, timeout = 10000) {
  const deadline = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error(message);
    await wait(20);
  }
}

export function cleanupPoints() {
  const record = active;
  active = undefined;
  if (!record) return;
  cancelAnimationFrame(record.frameHandle);
  for (const [type, listener] of record.listeners) record.container.removeEventListener(type, listener, true);
  record.engine.dispose();
  record.container.remove();
}

async function mount(input = data(), overrides = {}) {
  cleanupPoints();
  const container = document.createElement('div');
  container.style.cssText = `position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px`;
  document.body.replaceChildren(container);
  const engine = createEngine();
  const record = {
    engine, container, width: WIDTH, height: HEIGHT, input, state: state(), frameNumber: 0,
    calls: { hover: [], pick: [], camera: [], lost: [], restored: 0, rendering: [] },
    trusted: { down: 0, move: 0, up: 0 }, listeners: [], checkpoints: {}, pointerId: undefined,
  };
  active = record;
  const countFrame = () => {
    if (active !== record) return;
    record.frameNumber += 1;
    record.frameHandle = requestAnimationFrame(countFrame);
  };
  record.frameHandle = requestAnimationFrame(countFrame);
  for (const [type, key] of [['pointerdown', 'down'], ['pointermove', 'move'], ['pointerup', 'up']]) {
    const listener = (event) => {
      if (event.isTrusted) record.trusted[key] += 1;
      if (key === 'down') record.pointerId = event.pointerId;
    };
    container.addEventListener(type, listener, true);
    record.listeners.push([type, listener]);
  }
  record.style = {
    ...DEFAULT_LYRA_3D_STYLE, background: '#000000', foreground: '#ffff00', muted: '#ffffff',
    accent: '#ff0000', focus: '#00ffff', palette: ['#00ff00', '#0000ff'], pointSize: 20,
    lineWidth: 3, fontFamily: 'sans-serif', fontSize: 16, devicePixelRatio: 1, reducedMotion: true, ...overrides,
  };
  engine.setData(input, 0);
  engine.setStyle(record.style);
  engine.setCamera(DEFAULT_ORBIT_CAMERA);
  await engine.mount(container, {
    hover: (item) => record.calls.hover.push(item),
    pick: (item, modifiers) => record.calls.pick.push({ item, ...modifiers }),
    camera: (camera) => record.calls.camera.push({ camera, frame: record.frameNumber }),
    lost: (reason) => record.calls.lost.push(reason),
    restored: () => { record.calls.restored += 1; },
    rendering: (info) => record.calls.rendering.push(info),
  });
  engine.resize(WIDTH, HEIGHT);
  record.canvas = container.querySelector('canvas');
  if (!record.canvas) throw new Error('Points engine did not mount a canvas');
  record.gl = record.canvas.getContext('webgl2');
  if (!record.gl) throw new Error('Points canvas has no WebGL2 context');
  await frame();
  return record;
}

async function pixels(record, nextState = record.state) {
  record.state = nextState;
  record.engine.setState(nextState);
  // Equal state can be a no-op. Explicitly redraw before reading the non-preserved framebuffer.
  record.engine.resize(record.width, record.height);
  return new Promise((resolve) => requestAnimationFrame(() => {
    const width = record.canvas.width;
    const height = record.canvas.height;
    const buffer = new Uint8Array(width * height * 4);
    record.gl.readPixels(0, 0, width, height, record.gl.RGBA, record.gl.UNSIGNED_BYTE, buffer);
    resolve({ buffer, width, height, cssWidth: record.width, cssHeight: record.height });
  }));
}

function pixelAt(image, point) {
  if (!point) throw new Error('Expected a visible projected point');
  const x = Math.max(0, Math.min(image.width - 1, Math.floor(point.x * image.width / image.cssWidth)));
  const y = Math.max(0, Math.min(image.height - 1, image.height - 1 - Math.floor(point.y * image.height / image.cssHeight)));
  const offset = (y * image.width + x) * 4;
  return [...image.buffer.subarray(offset, offset + 4)];
}
const black = (pixel) => pixel.slice(0, 3).every((value) => value < 15);
const green = (pixel) => pixel[1] > 180 && pixel[0] < 40 && pixel[2] < 40;
const blue = (pixel) => pixel[2] > 180 && pixel[0] < 40 && pixel[1] < 40;
const red = (pixel) => pixel[0] > 180 && pixel[1] < 40 && pixel[2] < 40;
const cyan = (pixel) => pixel[0] < 40 && pixel[1] > 180 && pixel[2] > 180;
const yellow = (pixel) => pixel[0] > 180 && pixel[1] > 180 && pixel[2] < 40;
function yellowPixels(image) {
  let count = 0;
  for (let index = 0; index < image.buffer.length; index += 4) {
    if (image.buffer[index] > 100 && image.buffer[index + 1] > 100 && image.buffer[index + 2] < 50) count += 1;
  }
  return count;
}
function yellowInRect(image, left, top, right, bottom) {
  let count = 0;
  for (let y = Math.ceil(top); y < Math.min(image.cssHeight, bottom); y += 1) {
    for (let x = Math.ceil(left); x < Math.min(image.cssWidth, right); x += 1) {
      if (yellow(pixelAt(image, { x, y }))) count += 1;
    }
  }
  return count;
}
const shifted = (point, x, y = 0) => ({ x: point.x + x, y: point.y + y });
function worldScreen(point) {
  return projectOrbitPoint(point, DEFAULT_ORBIT_CAMERA, { width: WIDTH, height: HEIGHT });
}

export const pointsCases = {
  async 'points-css-diameter-disk-pick'() {
    const record = await mount(data({
      positions: new Float32Array([-90, -60, 0, 90, 60, 180, 0, 100, 0]),
      sizes: new Float32Array([12, 36, 0]),
    }));
    const image = await pixels(record);
    const [small, large, hidden] = [0, 1, 2].map((item) => record.engine.project(item));
    const samples = [pixelAt(image, shifted(small, 4)), pixelAt(image, shifted(small, 8)),
      pixelAt(image, shifted(large, 15)), pixelAt(image, shifted(large, 21))];
    const picked = [record.engine.pick(small.x + 4, small.y), record.engine.pick(small.x + 8, small.y),
      record.engine.pick(large.x + 15, large.y), record.engine.pick(large.x + 21, large.y),
      record.engine.pick(large.x + 16, large.y + 16), record.engine.pick(hidden.x, hidden.y)];
    return { passed: green(samples[0]) && black(samples[1]) && green(samples[2]) && black(samples[3]) &&
      JSON.stringify(picked) === '[0,null,1,null,null,null]' && record.calls.rendering.length === 1,
    samples, picked, software: record.calls.rendering[0]?.software };
  },

  async 'points-default-size-dpr-pick'() {
    const record = await mount(data(), { pointSize: 16, devicePixelRatio: 2 });
    record.width = 320; record.height = 240;
    record.container.style.width = '320px'; record.container.style.height = '240px';
    record.engine.resize(record.width, record.height);
    const image = await pixels(record);
    const point = record.engine.project(0);
    const inside = pixelAt(image, shifted(point, 5));
    const outside = pixelAt(image, shifted(point, 11));
    return { passed: image.width === 640 && image.height === 480 && green(inside) && black(outside) &&
      record.engine.pick(point.x + 5, point.y) === 0 && record.engine.pick(point.x + 11, point.y) === null,
    inside, outside, drawingBuffer: [image.width, image.height] };
  },

  async 'points-stable-row-id-pick'() {
    const positions = new Float32Array(257 * 3);
    for (let row = 0; row < 257; row += 1) positions.set([1_000_000, 0, 0], row * 3);
    positions.set([-80, 0, 0], 0); positions.set([80, 0, 0], 256 * 3);
    const record = await mount({ positions });
    await pixels(record);
    const ids = [0, 256].map((row) => { const point = record.engine.project(row); return record.engine.pick(point.x, point.y); });
    return { passed: JSON.stringify(ids) === '[0,256]' && record.engine.pick(4, 4) === null, ids };
  },

  async 'points-category-and-state-colors'() {
    const record = await mount(data({ categories: new Uint16Array([0, 1]) }));
    const first = record.engine.project(0); const second = record.engine.project(1);
    const initial = await pixels(record);
    const selected = pixelAt(await pixels(record, state({ selected: new Set([0]) })), first);
    const focused = pixelAt(await pixels(record, state({ focus: 0 })), first);
    const hovered = pixelAt(await pixels(record, state({ hover: 0 })), first);
    const dimmed = pixelAt(await pixels(record, state({ dimmed: new Set([0]) })), first);
    record.engine.setStyle({ ...record.style, forcedColors: true });
    const forced = await pixels(record, state({ dimmed: new Set([0, 1]) }));
    return { passed: green(pixelAt(initial, first)) && blue(pixelAt(initial, second)) && red(selected) &&
      cyan(focused) && red(hovered) && dimmed[1] > 20 && dimmed[1] < 220 &&
      yellow(pixelAt(forced, first)) && yellow(pixelAt(forced, second)) && record.engine.pick(first.x, first.y) === 0,
    selected, focused, hovered, dimmed, forced: [pixelAt(forced, first), pixelAt(forced, second)] };
  },

  async 'points-2d-3d-projection-quiet-camera'() {
    const input = data({ positions: new Float32Array([-80, 0, 0, 80, 0, 200]) });
    const record = await mount(input);
    const spatial = record.engine.project(1);
    record.engine.setData({ ...input, mode: '2d' }, 1);
    record.engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, yaw: 0.8, pitch: 0.4, target: { x: 0, y: 0, z: 120 } });
    await pixels(record);
    const flat = [record.engine.project(0), record.engine.project(1)];
    const flatPosition = record.engine.positionOf(1);
    const focused = record.engine.focus(1, 300);
    await pixels(record);
    const centered = record.engine.project(1);
    const fitted = record.engine.fit(24);
    await pixels(record);
    const fittedPoints = [record.engine.project(0), record.engine.project(1)];
    record.engine.setData(input, 2);
    record.engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, yaw: 0.4, pitch: 0.2 });
    await pixels(record);
    const rotated = record.engine.project(1);
    return { passed: spatial.x > flat[1].x + 20 && near(flat[0].x + flat[1].x, WIDTH, 0.1) && flatPosition.z === 0 &&
      focused.yaw === 0 && focused.pitch === 0 && focused.target.z === 0 && focused.distance === 300 &&
      near(centered.x, WIDTH / 2, 0.1) && near(centered.y, HEIGHT / 2, 0.1) && fitted.yaw === 0 && fitted.pitch === 0 &&
      fittedPoints.every((point) => point && point.x >= 24 && point.x <= WIDTH - 24) &&
      Math.abs(rotated.x - spatial.x) > 10 && record.engine.positionOf(1).z === 200 && record.calls.camera.length === 0,
    spatial, flat, focused, fitted, rotated, cameraEvents: record.calls.camera.length };
  },

  async 'points-segments-axes-label-pixels'() {
    const input = data({ positions: new Float32Array([-80, 40, 0, 80, 40, 0]) });
    const record = await mount(input);
    const midpoint = worldScreen({ x: 0, y: 40, z: 0 });
    const baseline = await pixels(record);
    record.engine.setData({ ...input, segments: new Uint32Array([0, 1]) }, 1);
    const linked = await pixels(record);
    const line = pixelAt(linked, midpoint);
    const segmentPick = record.engine.pick(midpoint.x, midpoint.y);
    record.engine.setData({ ...input, labels: ['<plain label>', 'Target'] }, 2);
    const labelled = await pixels(record);
    record.engine.setData({ ...input, axes: axes() }, 3);
    const axisImage = await pixels(record);
    const axisSample = worldScreen({ x: -90, y: 0, z: 0 });
    const axisInk = pixelAt(axisImage, axisSample);
    const axisPick = record.engine.pick(axisSample.x, axisSample.y);
    const axisEnd = worldScreen({ x: 120, y: 0, z: 0 });
    // The axis line stops at axisEnd; this region can contain its text but no axis geometry.
    const axisLabelPixels = yellowInRect(axisImage, axisEnd.x + 5, axisEnd.y - 12, axisEnd.x + 150, axisEnd.y + 12);
    record.engine.setData(input, 4);
    const cleared = await pixels(record);
    return { passed: black(pixelAt(baseline, midpoint)) && line.slice(0, 3).every((value) => value > 180) &&
      segmentPick === null && yellowPixels(labelled) > 10 && yellow(axisInk) && axisPick === null &&
      axisLabelPixels > 5 && yellowPixels(cleared) === 0 &&
      record.container.querySelector('img,script,button') === null,
    line, segmentPick, pointLabelPixels: yellowPixels(labelled), axisInk, axisPick, axisLabelPixels, clearedPixels: yellowPixels(cleared) };
  },

  async 'points-2d-hides-depth-axis'() {
    const input = data({ axes: [{ axis: 'z', min: -100, max: 100, label: 'Depth', ticks: [] }] });
    const record = await mount(input);
    const spatial = await pixels(record);
    record.engine.setData({ ...input, mode: '2d' }, 1);
    const flat = await pixels(record);
    return { passed: yellowPixels(spatial) > 5 && yellowPixels(flat) === 0,
      spatialLabelPixels: yellowPixels(spatial), flatLabelPixels: yellowPixels(flat) };
  },

  async 'points-context-restore'() {
    const record = await mount(data({ labels: ['Node', 'Target'], segments: new Uint32Array([0, 1]), axes: axes() }));
    await pixels(record);
    const extension = record.gl.getExtension('WEBGL_lose_context');
    if (!extension) return { passed: true, skipped: 'WEBGL_lose_context unavailable' };
    extension.loseContext();
    await until(() => record.calls.lost.includes('context-lost'), 'Points did not report context loss');
    const lostPick = record.engine.pick(320, 240);
    await wait(100);
    extension.restoreContext();
    await until(() => record.calls.restored === 1, 'Points did not report context restoration');
    const restored = await pixels(record);
    const point = record.engine.project(0);
    const picked = record.engine.pick(point.x, point.y);
    return { passed: lostPick === null && picked === 0 && green(pixelAt(restored, shifted(point, 0, -5))) &&
      yellowPixels(restored) > 20 && record.calls.lost.length === 1 && record.calls.restored === 1,
    lostPick, picked, labelPixels: yellowPixels(restored), lost: record.calls.lost, restored: record.calls.restored };
  },

  async 'points-dispose-quiet'() {
    const record = await mount(data({ labels: ['Node', 'Target'], axes: axes() }));
    await pixels(record);
    const before = JSON.stringify(record.calls);
    const hasReleaseExtension = record.gl.getExtension('WEBGL_lose_context') !== null;
    record.engine.dispose(); record.engine.dispose();
    record.engine.setStyle(record.style);
    record.engine.setState(state({ focus: 0 }));
    record.engine.setCamera({ ...DEFAULT_ORBIT_CAMERA, yaw: 1 });
    await frame(); await frame();
    if (hasReleaseExtension) await until(() => record.gl.isContextLost(), 'Points disposal did not release context');
    return { passed: !record.canvas.isConnected && record.engine.positionOf(0) === null && record.engine.project(0) === null &&
      record.engine.pick(320, 240) === null && JSON.stringify(record.calls) === before &&
      (!hasReleaseExtension || record.gl.isContextLost()),
    contextLost: record.gl.isContextLost(), releaseExtension: hasReleaseExtension, callsQuiet: JSON.stringify(record.calls) === before };
  },
};

function client(record, point) {
  const rect = record.canvas.getBoundingClientRect();
  return { x: rect.left + point.x, y: rect.top + point.y };
}
async function prepareDrag(mode, shift = false) {
  const record = await mount(data({ mode }));
  await pixels(record);
  record.originalPoint = record.engine.project(0);
  return {
    setup: { start: client(record, { x: 320, y: 420 }), end: client(record, { x: 410, y: 385 }) },
    action: 'drag', button: 'left', modifiers: shift ? ['Shift'] : [], steps: 12,
  };
}

export function pointsPointerCheckpoint(name, action = 'moved') {
  if (!active || action !== 'moved') throw new Error(`Unknown points checkpoint ${name}:${action}`);
  active.checkpoints.moved = {
    captured: active.canvas.hasPointerCapture(active.pointerId), point: active.engine.project(0),
  };
  return active.checkpoints;
}

function trustedDrag(record) {
  return record.trusted.down > 0 && record.trusted.move > 0 && record.trusted.up > 0 &&
    record.checkpoints.moved?.captured === true && !record.canvas.hasPointerCapture(record.pointerId) &&
    record.calls.pick.length === 0;
}
function cameraPerFrame(record) {
  return new Set(record.calls.camera.map((entry) => entry.frame)).size === record.calls.camera.length;
}
async function verifyPan(setup, primary2d = false) {
  const record = active;
  await pixels(record);
  const latest = record.calls.camera.at(-1)?.camera;
  const point = record.engine.project(0);
  const dx = setup.setup.end.x - setup.setup.start.x;
  const dy = setup.setup.end.y - setup.setup.start.y;
  const passed = trustedDrag(record) && cameraPerFrame(record) && latest && near(latest.yaw, 0, 1e-8) &&
    near(latest.pitch, 0, 1e-8) && near(latest.target.z, 0, 1e-8) &&
    near(point.x - record.originalPoint.x, dx, 2) && near(point.y - record.originalPoint.y, dy, 2);
  return { passed: Boolean(passed), camera: latest, point, original: record.originalPoint, trusted: record.trusted,
    ...(primary2d && !passed ? { expectedUnimplemented: '2D primary drag needs the shared viewport primary-pan seam' } : {}) };
}

/** Setups describe trusted driver actions; verify never synthesizes pointer input. */
export const pointsPointerCases = {
  'points-orbit-3d': () => prepareDrag('3d'),
  async 'points-orbit-3d:verify'() {
    const record = active;
    await pixels(record);
    const latest = record.calls.camera.at(-1)?.camera;
    return { passed: Boolean(trustedDrag(record) && cameraPerFrame(record) && latest && Math.abs(latest.yaw) > 0.1 &&
      Math.abs(latest.pitch) > 0.01 && near(latest.target.x, 0, 1e-8) && near(latest.target.y, 0, 1e-8)),
    camera: latest, cameraEvents: record.calls.camera.length, trusted: record.trusted };
  },
  'points-pan-3d-shift': () => prepareDrag('3d', true),
  'points-pan-3d-shift:verify': (setup) => verifyPan(setup),
  'points-pan-2d-shift': () => prepareDrag('2d', true),
  'points-pan-2d-shift:verify': (setup) => verifyPan(setup),
  'points-pan-2d-primary': () => prepareDrag('2d'),
  'points-pan-2d-primary:verify': (setup) => verifyPan(setup, true),
  async 'points-hover-click'() {
    const record = await mount();
    await pixels(record);
    return { action: 'hover-click', setup: {
      hover: client(record, record.engine.project(0)), click: client(record, record.engine.project(1)),
      empty: client(record, { x: 6, y: 6 }),
    } };
  },
  async 'points-hover-click:verify'() {
    const record = active;
    await pixels(record);
    const picks = record.calls.pick;
    return { passed: record.trusted.down >= 4 && record.trusted.up >= 4 && record.calls.hover.includes(0) &&
      picks.some((entry) => entry.item === 1 && !entry.shift && !entry.double) &&
      picks.some((entry) => entry.item === 1 && entry.double) &&
      picks.some((entry) => entry.item === null && entry.shift && !entry.double) && record.calls.camera.length === 0,
    picks, hover: record.calls.hover, trusted: record.trusted };
  },
};

/** Optional hardware-only functional capacity probe; this is not a frame-rate benchmark. */
export const pointsGpuCases = {
  async 'points-gpu-100k-stable-ids'() {
    const positions = new Float32Array(100_000 * 3);
    for (let row = 0; row < 100_000; row += 1) positions.set([1_000_000, 0, 0], row * 3);
    positions.set([-80, 0, 0], 0); positions.set([80, 0, 0], 99_999 * 3);
    const record = await mount({ positions });
    if (record.calls.rendering[0]?.software !== false) return { passed: true, skipped: 'Hardware WebGL required for optional 100k case' };
    await pixels(record);
    const ids = [0, 99_999].map((row) => { const point = record.engine.project(row); return record.engine.pick(point.x, point.y); });
    return { passed: JSON.stringify(ids) === '[0,99999]', count: 100_000, ids, software: false };
  },
};
