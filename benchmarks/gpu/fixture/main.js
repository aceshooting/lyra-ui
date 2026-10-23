import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-ui/components/lr-graph.js';
import '@aceshooting/lyra-ui/components/lr-embedding-explorer.js';

const stage = document.querySelector('#stage');

// Count WebGL draw calls so a frame the engine did not draw can never pass as a rendered frame.
const draws = { count: 0 };
let inputObservation;
for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
  const original = WebGL2RenderingContext.prototype[name];
  WebGL2RenderingContext.prototype[name] = function (...args) { draws.count += 1; return original.apply(this, args); };
}
const WIDTH = 1280, HEIGHT = 800;

// Deterministic data, so every run and machine renders the same scene.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function ball(count, radius, next) {
  const x = new Float32Array(count), y = new Float32Array(count), z = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const u = next() * 2 - 1, theta = next() * Math.PI * 2, distance = radius * Math.cbrt(next()), ring = Math.sqrt(1 - u * u);
    x[index] = distance * ring * Math.cos(theta);
    y[index] = distance * ring * Math.sin(theta);
    z[index] = distance * u;
  }
  return { x, y, z };
}

const ids = (prefix, count) => Object.freeze(Array.from({ length: count }, (_, index) => `${prefix}${index}`));
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function until(read, timeoutMs, code) {
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (performance.now() > deadline) throw new Error(code);
    await frame();
  }
}

function renderer() {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return { webgl2: false, vendor: null, renderer: null };
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const result = {
    webgl2: true,
    vendor: String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR)),
    renderer: String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
  };
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return result;
}

let active;
const fallbacks = [];

function mount(element) {
  stage.replaceChildren();
  fallbacks.length = 0;
  element.addEventListener('lr-engine-fallback', (event) => fallbacks.push(event.detail));
  stage.append(element);
  active = element;
}

/** Pinned positions keep the force layout out of the measurement: this is rendering throughput. */
async function graph({ nodes, edges, unpinned = false }) {
  const next = random(7);
  const { x, y, z } = ball(nodes, 600, next);
  const source = new Uint32Array(edges), target = new Uint32Array(edges);
  for (let index = 0; index < edges; index += 1) {
    source[index] = index % nodes;
    target[index] = (source[index] + 1 + Math.floor(next() * (nodes - 1))) % nodes;
  }
  const element = document.createElement('lr-graph');
  element.style.cssText = `inline-size:${WIDTH}px;block-size:${HEIGHT}px`;
  element.width = WIDTH; element.height = HEIGHT; element.view = '3d'; element.engine = 'webgl';
  element.nodeLabels = 'none';
  element.camera = { yaw: 0, pitch: 0.3, distance: 1900, target: { x: 0, y: 0, z: 0 } };
  const started = performance.now();
  element.graphColumns = Object.freeze({ ids: ids('n', nodes), ...(unpinned ? {} : { x, y, z }), source, target });
  mount(element);
  await until(() => {
    const host = element.shadowRoot?.querySelector('[data-webgl-host]');
    const canvas = host?.querySelector('canvas:not([data-graph-labels])');
    return !!host && !host.hidden && !!canvas && canvas.width > 0;
  }, 60000, 'GRAPH_NOT_READY');
  await frame(); await frame();
  return { mountMs: performance.now() - started, fallbacks: [...fallbacks] };
}

async function points({ count }) {
  const { x, y, z } = ball(count, 1, random(11));
  const element = document.createElement('lr-embedding-explorer');
  element.style.cssText = `inline-size:${WIDTH}px`;
  element.engine = 'webgl';
  const started = performance.now();
  element.pointColumns = Object.freeze({ ids: ids('p', count), x, y, z });
  mount(element);
  await until(() => {
    const ready = element.shadowRoot?.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false';
    const canvas = element.shadowRoot?.querySelector('[part="engine"] canvas');
    return ready && !!canvas && canvas.width > 0;
  }, 60000, 'POINTS_NOT_READY');
  await frame(); await frame();
  return { mountMs: performance.now() - started, fallbacks: [...fallbacks] };
}

function engineElement() {
  const canvas = active?.shadowRoot?.querySelector('[data-webgl-host] canvas:not([data-graph-labels]), [part="engine"] canvas');
  if (!canvas) throw new Error('NO_ENGINE_CANVAS');
  return canvas;
}

function engineCanvas() {
  const rect = engineElement().getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

// One synthetic primary-button drag step per frame: the engine orbits (and must redraw) every frame.
function pointer(canvas, type, x, y) {
  canvas.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y, bubbles: true, composed: true }));
}

/**
 * Records animation-frame intervals for `durationMs`. With `orbit`, the graph camera turns every
 * frame (a camera write schedules exactly one engine frame); with `drag`, a pointer drag turns it.
 */
async function frames({ durationMs, orbit, drag }) {
  const intervals = [], firstDraw = draws.count;
  let last, yaw = 0, seenDraws = draws.count, drawnFrames = 0;
  const end = performance.now() + durationMs;
  const canvas = drag ? engineElement() : null, box = canvas?.getBoundingClientRect();
  const centerX = box ? box.x + box.width / 2 : 0, centerY = box ? box.y + box.height / 2 : 0;
  let step = 0;
  if (canvas) pointer(canvas, 'pointerdown', centerX, centerY);
  await new Promise((resolve) => {
    const tick = (now) => {
      if (last !== undefined) intervals.push(now - last);
      last = now;
      if (draws.count !== seenDraws) { drawnFrames += 1; seenDraws = draws.count; }
      if (orbit) {
        yaw += 0.01;
        active.camera = { yaw, pitch: 0.3, distance: 1900, target: { x: 0, y: 0, z: 0 } };
      }
      if (canvas) { step += 1; pointer(canvas, 'pointermove', centerX + 200 * Math.sin(step / 30), centerY + 80 * Math.cos(step / 45)); }
      if (now < end) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
  if (canvas) pointer(canvas, 'pointerup', centerX, centerY);
  return { intervals, drawnFrames, drawCalls: draws.count - firstDraw, fallbacks: [...fallbacks] };
}

function clearInputObservation() {
  inputObservation?.inputSurface.removeEventListener('pointermove', inputObservation.listener, true);
  for (const [name, original] of inputObservation?.drawMethods ?? []) WebGL2RenderingContext.prototype[name] = original;
  inputObservation = undefined;
}

function armInputObservation() {
  clearInputObservation();
  const canvas = engineElement();
  const inputSurface = canvas.parentElement;
  if (!inputSurface) throw new Error('NO_ENGINE_INPUT_SURFACE');
  const observation = { canvas, inputSurface, inputAt: null, drawAt: null, listener: null };
  observation.listener = event => {
    if (event.isTrusted && event.buttons === 1 && event.composedPath().includes(canvas) && observation.inputAt === null) observation.inputAt = performance.now();
  };
  // Graph node dragging stops same-target listeners; capture on its owning surface first.
  inputSurface.addEventListener('pointermove', observation.listener, true);
  observation.drawMethods = new Map();
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
    const original = WebGL2RenderingContext.prototype[name];
    observation.drawMethods.set(name, original);
    WebGL2RenderingContext.prototype[name] = function (...args) {
      const result = original.apply(this, args);
      if (observation.canvas === this.canvas && observation.inputAt !== null && observation.drawAt === null) observation.drawAt = performance.now();
      return result;
    };
  }
  inputObservation = observation;
}

async function readInputObservation() {
  try {
    await until(() => inputObservation && inputObservation.drawAt !== null, 5000, 'INPUT_DRAW_NOT_OBSERVED');
    return { inputAt: inputObservation.inputAt, drawAt: inputObservation.drawAt,
      inputToDrawMs: inputObservation.drawAt - inputObservation.inputAt };
  } finally { clearInputObservation(); }
}

async function dispose() {
  clearInputObservation();
  active?.remove(); active = undefined; stage.replaceChildren(); fallbacks.length = 0;
  await frame(); await frame();
}

window.__gpuBenchmark = Object.freeze({ renderer, graph, points, engineCanvas, frames,
  armInputObservation, readInputObservation, dispose, readFallbacks: () => [...fallbacks] });
