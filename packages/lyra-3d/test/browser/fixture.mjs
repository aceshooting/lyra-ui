import { InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry } from 'three';
import {
  LYRA_3D_CONTRACT,
  Lyra3dUnsupportedError,
  createLyra3dViewport,
  createPickColors,
  createPickMaterial,
  fitOrbitCamera,
  normalizeOrbitCamera,
  startLyra3dTask,
} from '@aceshooting/lyra-3d/core';
import { countingKernel } from './kernel.mjs';
import { cleanupViewport, viewportCases, viewportPointerCases, viewportPointerCheckpoint } from './viewport.mjs';

import { cleanupGraph, graphCases, graphPointerCases, graphPointerCheckpoint } from './graph.mjs';
import { cleanupGraphSpatial, graphSpatialCases } from './graph-spatial.mjs';
import { cleanupGraphSpatialCurves, graphSpatialCurveCases } from './graph-spatial-curves.browser.mjs';
import { cleanupPoints, pointsCases, pointsPointerCases, pointsPointerCheckpoint, pointsGpuCases } from './points.mjs';
import { cleanupPanorama, panoramaCases, panoramaPointerCases, panoramaPointerCheckpoint } from './panorama.mjs';
import { cleanupModel, modelCases } from './model.mjs';
import { cleanupModelAsync, modelAsyncCases, runModelAsyncCase } from './model-async.mjs';

const WIDTH = 480;
const HEIGHT = 320;
const BACKGROUND = 'rgb(10, 20, 30)';
const POSITIONS = [
  { x: -80, y: -40, z: 0 },
  { x: 0, y: 0, z: 0 },
  { x: 90, y: 50, z: 20 },
];

function style(overrides = {}) {
  return {
    background: BACKGROUND,
    foreground: '#ffffff',
    muted: '#888888',
    accent: '#ff0000',
    focus: '#00ff00',
    palette: ['#ff8800', '#0088ff', '#88ff00'],
    fontFamily: 'sans-serif',
    fontSize: 12,
    pointSize: 6,
    lineWidth: 1,
    devicePixelRatio: 1,
    reducedMotion: false,
    forcedColors: false,
    ...overrides,
  };
}

function recordingHost() {
  const calls = { hover: [], pick: [], camera: [], lost: [], rendering: [], restored: 0 };
  return {
    calls,
    host: {
      hover: (item) => calls.hover.push(item),
      pick: (item, modifiers) => calls.pick.push({ item, ...modifiers }),
      camera: (camera) => calls.camera.push({ camera, frame: frames }),
      lost: (reason, detail) => calls.lost.push({ reason, detail }),
      rendering: (info) => calls.rendering.push(info),
      restored: () => (calls.restored += 1),
    },
  };
}

let frames = 0;
const countFrames = () => {
  frames += 1;
  requestAnimationFrame(countFrames);
};
requestAnimationFrame(countFrames);

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const settle = async (count = 2) => {
  for (let index = 0; index < count; index += 1) await nextFrame();
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const near = (actual, expected, tolerance = 2) => Math.abs(actual - expected) <= tolerance;

/** Mounts a viewport with three spheres and their id-colored pick copies. */
function mountScene(styleOverrides = {}) {
  const container = document.createElement('div');
  container.style.cssText = `position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px`;
  document.body.replaceChildren(container);
  const { host, calls } = recordingHost();
  const viewport = createLyra3dViewport(container, host, { wheelZoom: () => true });
  viewport.setStyle(style(styleOverrides));
  viewport.resize(WIDTH, HEIGHT);
  const geometry = new SphereGeometry(12, 16, 12);
  const visible = new InstancedMesh(geometry, new MeshBasicMaterial({ color: 0xffffff }), POSITIONS.length);
  const pick = new InstancedMesh(geometry, createPickMaterial(), POSITIONS.length);
  const matrix = new Matrix4();
  POSITIONS.forEach((point, index) => {
    matrix.makeTranslation(point.x, point.y, point.z);
    visible.setMatrixAt(index, matrix);
    pick.setMatrixAt(index, matrix);
  });
  pick.instanceColor = new InstancedBufferAttribute(createPickColors(POSITIONS.length), 3);
  viewport.world.add(visible);
  viewport.pickWorld.add(pick);
  viewport.setOrbit(fitOrbitCamera({ min: { x: -120, y: -80, z: -40 }, max: { x: 120, y: 80, z: 40 } }, { width: WIDTH, height: HEIGHT }));
  viewport.renderNow();
  return { container, viewport, calls };
}

function centerPixel(viewport) {
  const gl = viewport.renderer.getContext();
  const pixel = new Uint8Array(4);
  viewport.renderNow();
  // A corner far from every sphere shows the clear color.
  gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return [...pixel];
}

function screenPoints(viewport) {
  return POSITIONS.map((point) => {
    const projected = viewport.project(point);
    return { x: projected.x, y: projected.y };
  });
}

let active;
const cleanup = () => {
  const old = active;
  active = undefined;
  let failed = false;
  let failure;
  for (const release of [() => old?.viewport.dispose(), cleanupViewport, cleanupGraph, cleanupGraphSpatial, cleanupGraphSpatialCurves, cleanupPoints, cleanupPanorama, cleanupModel, cleanupModelAsync]) {
    try { release(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  }
  if (failed) throw failure;
};

const cases = {
  async 'mount-and-report'() {
    const scene = (active = mountScene());
    const gl = scene.viewport.renderer.getContext();
    return {
      passed: scene.container.querySelector('canvas') === scene.viewport.canvas &&
        gl instanceof WebGL2RenderingContext &&
        scene.calls.rendering.length === 1 &&
        typeof scene.calls.rendering[0].software === 'boolean' &&
        LYRA_3D_CONTRACT === 1,
      software: scene.calls.rendering[0]?.software,
      renderer: gl.getParameter(gl.RENDERER),
    };
  },
  async 'clear-color'() {
    const scene = (active = mountScene());
    const pixel = centerPixel(scene.viewport);
    return { passed: near(pixel[0], 10) && near(pixel[1], 20) && near(pixel[2], 30) && pixel[3] === 255, pixel };
  },
  async 'gpu-pick'() {
    const scene = (active = mountScene());
    const points = screenPoints(scene.viewport);
    const picked = points.map(({ x, y }) => scene.viewport.pickAt(x, y));
    const empty = scene.viewport.pickAt(4, 4);
    const outside = scene.viewport.pickAt(-1, 10);
    const pixel = centerPixel(scene.viewport);
    return {
      passed: JSON.stringify(picked) === '[0,1,2]' && empty === null && outside === null && near(pixel[0], 10),
      picked,
      empty,
    };
  },
  async 'context-restore'() {
    const scene = (active = mountScene());
    const gl = scene.viewport.renderer.getContext();
    const extension = gl.getExtension('WEBGL_lose_context');
    if (!extension) return { passed: true, skipped: 'WEBGL_lose_context unavailable' };
    const point = screenPoints(scene.viewport)[1];
    extension.loseContext();
    for (let attempt = 0; attempt < 100 && scene.calls.lost.length === 0; attempt += 1) await wait(20);
    const lostReported = scene.calls.lost.length === 1 && scene.calls.lost[0].reason === 'context-lost' && scene.viewport.lost;
    const pickWhileLost = scene.viewport.pickAt(point.x, point.y);
    extension.restoreContext();
    for (let attempt = 0; attempt < 250 && scene.calls.restored === 0; attempt += 1) await wait(20);
    await settle();
    const pixel = centerPixel(scene.viewport);
    const picked = scene.viewport.pickAt(point.x, point.y);
    return {
      passed: lostReported && pickWhileLost === null && scene.calls.restored === 1 && !scene.viewport.lost &&
        near(pixel[0], 10) && near(pixel[1], 20) && near(pixel[2], 30) && picked === 1,
      lost: scene.calls.lost,
      restored: scene.calls.restored,
      pixel,
      picked,
    };
  },
  async resize() {
    const scene = (active = mountScene({ devicePixelRatio: 2 }));
    scene.viewport.resize(320, 200);
    const canvas = scene.viewport.canvas;
    const sized = canvas.width === 640 && canvas.height === 400 && scene.viewport.width === 320;
    scene.viewport.resize(Number.NaN, 0);
    return {
      passed: sized && scene.viewport.width === 320 && scene.viewport.height === 1 && canvas.height === 2,
      width: canvas.width,
      height: canvas.height,
    };
  },
  async 'reduced-motion'() {
    const scene = (active = mountScene({ reducedMotion: true }));
    const target = normalizeOrbitCamera({ yaw: 1, pitch: 0.3, distance: 200, target: { x: 10, y: 0, z: 0 } });
    scene.viewport.transitionTo(target);
    const immediate = JSON.stringify(scene.viewport.orbit) === JSON.stringify(target);
    await settle();
    const reducedCalls = scene.calls.camera.length;
    scene.viewport.setStyle(style({ reducedMotion: false }));
    const animated = normalizeOrbitCamera({ yaw: -1, pitch: 0, distance: 400, target: { x: 0, y: 0, z: 0 } });
    scene.viewport.transitionTo(animated);
    await settle(2);
    const midway = JSON.stringify(scene.viewport.orbit) !== JSON.stringify(animated);
    await wait(500);
    await settle();
    const arrived = JSON.stringify(scene.viewport.orbit) === JSON.stringify(animated);
    const perFrame = new Set(scene.calls.camera.map((call) => call.frame)).size === scene.calls.camera.length;
    return { passed: immediate && reducedCalls === 1 && midway && arrived && perFrame, reducedCalls, calls: scene.calls.camera.length };
  },
  async 'silent-camera-replacement'() {
    const scene = (active = mountScene({ reducedMotion: true }));
    const transition = normalizeOrbitCamera({ ...scene.viewport.orbit, yaw: 0.5 });
    const replacement = normalizeOrbitCamera({ ...scene.viewport.orbit, yaw: -0.5 });
    scene.viewport.transitionTo(transition);
    scene.viewport.setOrbit(replacement);
    scene.viewport.renderNow();
    await settle();
    return {
      passed: scene.calls.camera.length === 0 && JSON.stringify(scene.viewport.orbit) === JSON.stringify(replacement),
      calls: scene.calls.camera.length,
    };
  },
  async 'worker-task'() {
    const outputs = [];
    let resolveDone;
    const done = new Promise((resolve) => (resolveDone = resolve));
    const task = startLyra3dTask({
      input: { steps: 30 },
      kernel: countingKernel,
      worker: () => new Worker(new URL('./kernel.worker.mjs', import.meta.url), { type: 'module' }),
      onOutput(output, isDone) {
        outputs.push({ count: output[0], isFloat: output instanceof Float32Array });
        if (isDone) resolveDone();
      },
    });
    await Promise.race([done, wait(10000)]);
    task.stop();
    return {
      passed: task.mode === 'worker' && outputs.at(-1)?.count === 30 && outputs.every((entry) => entry.isFloat),
      mode: task.mode,
      outputs: outputs.length,
    };
  },
  async 'worker-fallback'() {
    const run = (worker) => new Promise((resolve) => {
      const outputs = [];
      const task = startLyra3dTask({
        input: { steps: 20, stepMs: 2 },
        kernel: countingKernel,
        worker,
        onOutput(output, isDone) {
          outputs.push(output[0]);
          if (isDone) resolve({ mode: task.mode, last: outputs.at(-1), outputs: outputs.length });
        },
      });
      setTimeout(() => resolve({ mode: task.mode, timeout: true, outputs: outputs.length }), 10000);
    });
    const throwing = await run(() => {
      throw new Error('blocked by policy');
    });
    const missing = await run(() => new Worker(new URL('./missing.worker.mjs', location.href), { type: 'module' }));
    return {
      passed: throwing.mode === 'main-thread' && throwing.last === 20 && missing.mode === 'main-thread' && missing.last === 20,
      throwing,
      missing,
    };
  },
  async unsupported() {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, attributes) {
      return type === 'webgl2' || type === 'webgl' ? null : original.call(this, type, attributes);
    };
    let error;
    try {
      createLyra3dViewport(document.body, recordingHost().host);
    } catch (caught) {
      error = caught;
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
    return {
      passed: error instanceof Lyra3dUnsupportedError && error.code === 'webgl-unavailable' && document.querySelector('canvas') === null,
      error: String(error),
    };
  },
  async 'software-detected'() {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, attributes) {
      return attributes?.failIfMajorPerformanceCaveat ? null : original.call(this, type, attributes);
    };
    let scene;
    try {
      scene = active = mountScene();
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
    return { passed: scene.calls.rendering.length === 1 && scene.calls.rendering[0].software === true && scene.viewport.software };
  },
  async dispose() {
    const scene = mountScene();
    const gl = scene.viewport.renderer.getContext();
    scene.viewport.dispose();
    scene.viewport.dispose();
    scene.viewport.invalidate();
    await settle();
    scene.viewport.canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    await settle();
    return {
      passed: scene.viewport.disposed && scene.viewport.canvas.isConnected === false && gl.isContextLost() &&
        scene.calls.hover.length === 0 && scene.calls.lost.length === 0 && scene.viewport.pickAt(10, 10) === null,
      contextLost: gl.isContextLost(),
    };
  },
};

/**
 * Opt-in frame-rate measurement, run only by the GPU configuration: software rasterizers in CI
 * cannot meet a frame-rate target, so default runs never assert one.
 */
const performanceCases = {
  async 'frame-rate'() {
    const count = 10000;
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:0;top:0;width:960px;height:600px';
    document.body.replaceChildren(container);
    const { host, calls } = recordingHost();
    const viewport = createLyra3dViewport(container, host);
    active = { viewport, calls };
    viewport.setStyle(style());
    viewport.resize(960, 600);
    const mesh = new InstancedMesh(new SphereGeometry(1.5, 8, 6), new MeshBasicMaterial({ color: 0xffffff }), count);
    const matrix = new Matrix4();
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963, radius = 6 * Math.sqrt(index);
      matrix.makeTranslation(Math.cos(angle) * radius, Math.sin(angle) * radius, ((index % 200) - 100) * 2);
      mesh.setMatrixAt(index, matrix);
    }
    viewport.world.add(mesh);
    viewport.setOrbit(fitOrbitCamera({ min: { x: -620, y: -620, z: -200 }, max: { x: 620, y: 620, z: 200 } }, { width: 960, height: 600 }));
    let rendered = 0;
    viewport.onFrame(() => {
      rendered += 1;
      viewport.setOrbit({ ...viewport.orbit, yaw: viewport.orbit.yaw + 0.01 });
    });
    await settle(30);
    rendered = 0;
    const start = performance.now();
    await wait(3000);
    const fps = (rendered * 1000) / (performance.now() - start);
    return { passed: fps >= 55 && !viewport.software, fps: Number(fps.toFixed(1)), software: viewport.software };
  },
};

/** Pointer cases: the runner drives real mouse input between setup and verify. */
const pointerCases = {
  async orbit() {
    const scene = (active = mountScene());
    return { setup: { start: { x: WIDTH / 2, y: HEIGHT - 20 }, end: { x: WIDTH / 2 + 120, y: HEIGHT - 60 } }, yaw: scene.viewport.orbit.yaw };
  },
  async 'orbit:verify'(setup) {
    const { viewport, calls } = active;
    await settle();
    const frameSet = new Set(calls.camera.map((call) => call.frame));
    return {
      passed: Math.abs(viewport.orbit.yaw - setup.yaw) > 0.5 && calls.camera.length > 0 && frameSet.size === calls.camera.length && calls.pick.length === 0,
      yaw: viewport.orbit.yaw,
      notifications: calls.camera.length,
    };
  },
  async 'hover-click'() {
    const scene = (active = mountScene());
    const [first, second] = screenPoints(scene.viewport);
    return { setup: { hover: first, click: second, empty: { x: 6, y: 6 } } };
  },
  async 'hover-click:verify'() {
    const { calls } = active;
    await settle();
    const hovered = calls.hover.includes(0);
    const clicks = calls.pick.map((entry) => `${entry.item}:${entry.shift}:${entry.double}`);
    return {
      passed: hovered && clicks.includes('1:false:false') && clicks.includes('1:false:true') && clicks.includes('null:true:false'),
      hover: calls.hover,
      clicks,
    };
  },
};

Object.assign(cases, Object.fromEntries(modelAsyncCases.map(name => [`model-async:${name}`, async () => ({ model: await runModelAsyncCase(name), passed: true })])));
Object.assign(cases, viewportCases, graphCases, graphSpatialCases, graphSpatialCurveCases, pointsCases, panoramaCases, modelCases);
Object.assign(performanceCases, pointsGpuCases);
Object.assign(pointerCases, viewportPointerCases, graphPointerCases, pointsPointerCases, panoramaPointerCases);

window.fixture = {
  async run(name) {
    try {
      cleanup();
      return { name, ...(await (cases[name] ?? performanceCases[name])()) };
    } catch (error) {
      return { name, passed: false, error: String(error?.stack ?? error) };
    } finally {
      cleanup();
    }
  },
  async setup(name) {
    cleanup();
    return pointerCases[name]();
  },
  graphCheckpoint: graphPointerCheckpoint,
  pointsCheckpoint: pointsPointerCheckpoint,
  panoramaCheckpoint: panoramaPointerCheckpoint,
  performanceCaseNames: Object.keys(performanceCases),
  checkpoint(name) {
    return viewportPointerCheckpoint(name);
  },
  async verify(name, setup) {
    try {
      return { name, ...(await pointerCases[`${name}:verify`](setup)) };
    } catch (error) {
      return { name, passed: false, error: String(error?.stack ?? error) };
    } finally {
      cleanup();
    }
  },
  caseNames: Object.keys(cases),
  pointerCaseNames: Object.keys(pointerCases).filter((name) => !name.includes(':')),
};
window.ready = true;
