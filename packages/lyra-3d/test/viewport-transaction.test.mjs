import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, Matrix4, Object3D, PerspectiveCamera, Scene, Vector2, Vector3, Vector4 } from 'three';
import { DEFAULT_ORBIT_CAMERA, normalizeOrbitCamera } from '../dist/core/orbit.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { createLyra3dViewport } from '../dist/core/viewport.js';
import { registerViewportTransaction, getViewportTransactionAccess, captureViewportTransaction,
  prepareViewportTransactionInstall, validateViewportTransactionInstall, installViewportTransaction,
  restoreViewportTransaction, unregisterViewportTransaction } from '../dist/core/viewport-transaction.js';
import { registerViewportXr, getViewportXrLifetimeStamp, captureViewportXrPreparation, consumeViewportXrPreparation,
  getViewportXrResources, handoffViewportXr, invalidateViewportXr, unregisterViewportXr,
  releaseViewportXrPreparation } from '../dist/core/viewport-xr.js';
import { createViewportResources, retireViewportExtras, restoreViewportContextMethods } from '../dist/core/viewport-resources.js';
import { installFakeBrowser, pointerEvent } from './fake-browser.mjs';

const invalidState = error => error?.name === 'InvalidStateError';
const aborted = error => error?.name === 'AbortError';
// Literal observations from the existing synchronous viewport. New deferred timing is tested separately.
const CAPTURED = {
  styled: {'style': {'background': {'r': 0.047058823529411764, 'g': 0.13333333333333333, 'b': 0.2196078431372549, 'a': 0.4}, 'foreground': {'r': 0.10588235294117647, 'g': 0.12156862745098039, 'b': 0.1411764705882353, 'a': 1}, 'muted': {'r': 0.4196078431372549, 'g': 0.4470588235294118, 'b': 0.5019607843137255, 'a': 1}, 'accent': {'r': 0.011764705882352941, 'g': 0.3686274509803922, 'b': 0.7764705882352941, 'a': 1}, 'focus': {'r': 0.011764705882352941, 'g': 0.3686274509803922, 'b': 0.7764705882352941, 'a': 1}, 'palette': [{'r': 1, 'g': 0, 'b': 0, 'a': 1}, {'r': 0, 'g': 1, 'b': 0, 'a': 1}], 'fontFamily': 'system-ui, sans-serif', 'fontSize': 12, 'pointSize': 6, 'lineWidth': 1, 'devicePixelRatio': 1.5, 'reducedMotion': true, 'forcedColors': false}, 'renderer': {'pixelRatio': 1.5, 'size': [320, 180], 'clear': {'color': [0.0036765073221525194, 0.015996293361446288, 0.03954623527052923]}, 'clearAlpha': 0.4}, 'canvas': [480, 270], 'camera': {'position': [0, '-0', 500], 'up': [0, 1, 0], 'near': 0.5, 'far': 12000, 'aspect': 1.7777777777777777, 'projection': [1.3579951288348662, 0, 0, 0, 0, 2.414213562373095, 0, 0, 0, 0, -1.0000833368057003, -1, 0, 0, -1.0000416684028501, 0], 'world': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, '-0', 500, 1], 'view': {'enabled': false, 'fullWidth': 320, 'fullHeight': 180, 'offsetX': 10, 'offsetY': 12, 'width': 1, 'height': 1}}},
  resized: {'renderer': {'pixelRatio': 2, 'size': [800, 600], 'clear': {'color': [0, 0, 0]}, 'clearAlpha': 0}, 'canvas': [1600, 1200]},
  forced: {'style': {'background': {'r': 0, 'g': 0, 'b': 0, 'a': 0}, 'foreground': {'r': 0.10588235294117647, 'g': 0.12156862745098039, 'b': 0.1411764705882353, 'a': 1}, 'muted': {'r': 0.4196078431372549, 'g': 0.4470588235294118, 'b': 0.5019607843137255, 'a': 1}, 'accent': {'r': 0.011764705882352941, 'g': 0.3686274509803922, 'b': 0.7764705882352941, 'a': 1}, 'focus': {'r': 0.011764705882352941, 'g': 0.3686274509803922, 'b': 0.7764705882352941, 'a': 1}, 'palette': [{'r': 0.3058823529411765, 'g': 0.4745098039215686, 'b': 0.6549019607843137, 'a': 1}, {'r': 0.9490196078431372, 'g': 0.5568627450980392, 'b': 0.16862745098039217, 'a': 1}, {'r': 0.8823529411764706, 'g': 0.3411764705882353, 'b': 0.34901960784313724, 'a': 1}, {'r': 0.4627450980392157, 'g': 0.7176470588235294, 'b': 0.6980392156862745, 'a': 1}, {'r': 0.34901960784313724, 'g': 0.6313725490196078, 'b': 0.30980392156862746, 'a': 1}, {'r': 0.9294117647058824, 'g': 0.788235294117647, 'b': 0.2823529411764706, 'a': 1}, {'r': 0.6901960784313725, 'g': 0.47843137254901963, 'b': 0.6313725490196078, 'a': 1}, {'r': 1, 'g': 0.615686274509804, 'b': 0.6549019607843137, 'a': 1}], 'fontFamily': 'system-ui, sans-serif', 'fontSize': 12, 'pointSize': 6, 'lineWidth': 1, 'devicePixelRatio': 1, 'reducedMotion': true, 'forcedColors': true}, 'renderer': {'pixelRatio': 1, 'size': [640, 480], 'clear': {'color': [0, 0, 0]}, 'clearAlpha': 0}, 'canvas': [640, 480]},
  unforced: {'style': {'background': {'r': 0, 'g': 0, 'b': 0, 'a': 0}, 'foreground': {'r': 0.10588235294117647, 'g': 0.12156862745098039, 'b': 0.1411764705882353, 'a': 1}, 'muted': {'r': 0.4196078431372549, 'g': 0.4470588235294118, 'b': 0.5019607843137255, 'a': 1}, 'accent': {'r': 0.011764705882352941, 'g': 0.3686274509803922, 'b': 0.7764705882352941, 'a': 1}, 'focus': {'r': 0.011764705882352941, 'g': 0.3686274509803922, 'b': 0.7764705882352941, 'a': 1}, 'palette': [{'r': 0.3058823529411765, 'g': 0.4745098039215686, 'b': 0.6549019607843137, 'a': 1}, {'r': 0.9490196078431372, 'g': 0.5568627450980392, 'b': 0.16862745098039217, 'a': 1}, {'r': 0.8823529411764706, 'g': 0.3411764705882353, 'b': 0.34901960784313724, 'a': 1}, {'r': 0.4627450980392157, 'g': 0.7176470588235294, 'b': 0.6980392156862745, 'a': 1}, {'r': 0.34901960784313724, 'g': 0.6313725490196078, 'b': 0.30980392156862746, 'a': 1}, {'r': 0.9294117647058824, 'g': 0.788235294117647, 'b': 0.2823529411764706, 'a': 1}, {'r': 0.6901960784313725, 'g': 0.47843137254901963, 'b': 0.6313725490196078, 'a': 1}, {'r': 1, 'g': 0.615686274509804, 'b': 0.6549019607843137, 'a': 1}], 'fontFamily': 'system-ui, sans-serif', 'fontSize': 12, 'pointSize': 6, 'lineWidth': 1, 'devicePixelRatio': 1.25, 'reducedMotion': false, 'forcedColors': false}, 'renderer': {'pixelRatio': 1.25, 'size': [640, 480], 'clear': {'color': [0, 0, 0]}, 'clearAlpha': 0}, 'canvas': [800, 600]},
  latest: {'style': {'background': {'r': 0, 'g': 0, 'b': 0, 'a': 0}, 'foreground': {'r': 0.10588235294117647, 'g': 0.12156862745098039, 'b': 0.1411764705882353, 'a': 1}, 'muted': {'r': 0.4196078431372549, 'g': 0.4470588235294118, 'b': 0.5019607843137255, 'a': 1}, 'accent': {'r': 0.011764705882352941, 'g': 0.3686274509803922, 'b': 0.7764705882352941, 'a': 1}, 'focus': {'r': 0.011764705882352941, 'g': 0.3686274509803922, 'b': 0.7764705882352941, 'a': 1}, 'palette': [{'r': 0.3058823529411765, 'g': 0.4745098039215686, 'b': 0.6549019607843137, 'a': 1}, {'r': 0.9490196078431372, 'g': 0.5568627450980392, 'b': 0.16862745098039217, 'a': 1}, {'r': 0.8823529411764706, 'g': 0.3411764705882353, 'b': 0.34901960784313724, 'a': 1}, {'r': 0.4627450980392157, 'g': 0.7176470588235294, 'b': 0.6980392156862745, 'a': 1}, {'r': 0.34901960784313724, 'g': 0.6313725490196078, 'b': 0.30980392156862746, 'a': 1}, {'r': 0.9294117647058824, 'g': 0.788235294117647, 'b': 0.2823529411764706, 'a': 1}, {'r': 0.6901960784313725, 'g': 0.47843137254901963, 'b': 0.6313725490196078, 'a': 1}, {'r': 1, 'g': 0.615686274509804, 'b': 0.6549019607843137, 'a': 1}], 'fontFamily': 'system-ui, sans-serif', 'fontSize': 12, 'pointSize': 6, 'lineWidth': 1, 'devicePixelRatio': 2.5, 'reducedMotion': false, 'forcedColors': false}, 'renderer': {'pixelRatio': 2.5, 'size': [777, 333], 'clear': {'color': [0, 0, 0]}, 'clearAlpha': 0}, 'canvas': [1942, 832]},
  partialTransition: {'orbit': {'yaw': 0.84381103515625, 'pitch': 0.2025146484375, 'distance': 304.6437517565293, 'target': {'x': 2.025146484375, 'y': 2.7001953125, 'z': 3.375244140625}}, 'camera': {'position': [224.99754986455198, -63.97417495431042, 201.70986601491228], 'up': [0.15028300924759572, 0.9795638961428117, 0.13367718767614004], 'near': 0.3046437517565293, 'far': 11218.575007026117, 'aspect': 1.3333333333333333, 'projection': [1.8106601717798214, 0, 0, 0, 0, 2.414213562373095, 0, 0, 0, 0, -1.000054312071628, -1, 0, 0, -0.6093040493463251, 0], 'world': [0.6646201244962542, -1.3877787807814457e-17, -0.7471814305204485, 0, 0.1502830092475957, 0.9795638961428117, 0.13367718767614004, 0, 0.73191195320617, -0.20113322294816163, 0.6510378786064712, 0, 224.99754986455198, -63.97417495431042, 201.70986601491228, 1], 'view': null}},
  finishedTransition: {'orbit': {'yaw': 1.25, 'pitch': 0.3, 'distance': 240, 'target': {'x': 3, 'y': 4, 'z': 5}}, 'camera': {'position': [220.58391227744767, -74.9248495987215, 77.2973500720371], 'up': [0.2804441308303955, 0.955336489125606, 0.0931841296999916], 'near': 0.24, 'far': 10960, 'aspect': 1.3333333333333333, 'projection': [1.8106601717798216, 0, 0, 0, 0, 2.4142135623730954, 0, 0, 0, 0, -1.000043796579487, -1, 0, 0, -0.48001051117907695, 0], 'world': [0.31532236239526834, 2.7755575615628914e-17, -0.9489846193555863, 0, 0.28044413083039554, 0.955336489125606, 0.09318412969999158, 0, 0.9065996344893655, -0.29552020666133966, 0.3012389586334876, 0, 220.58391227744767, -74.9248495987215, 77.2973500720371, 1], 'view': {'enabled': false, 'fullWidth': 640, 'fullHeight': 480, 'offsetX': 10, 'offsetY': 10, 'width': 1, 'height': 1}}},
  restored: {'style': {'background': {'r': 0.06666666666666667, 'g': 0.13333333333333333, 'b': 0.2, 'a': 1}, 'foreground': {'r': 0.10588235294117647, 'g': 0.12156862745098039, 'b': 0.1411764705882353, 'a': 1}, 'muted': {'r': 0.4196078431372549, 'g': 0.4470588235294118, 'b': 0.5019607843137255, 'a': 1}, 'accent': {'r': 0.011764705882352941, 'g': 0.3686274509803922, 'b': 0.7764705882352941, 'a': 1}, 'focus': {'r': 0.011764705882352941, 'g': 0.3686274509803922, 'b': 0.7764705882352941, 'a': 1}, 'palette': [{'r': 0.3058823529411765, 'g': 0.4745098039215686, 'b': 0.6549019607843137, 'a': 1}, {'r': 0.9490196078431372, 'g': 0.5568627450980392, 'b': 0.16862745098039217, 'a': 1}, {'r': 0.8823529411764706, 'g': 0.3411764705882353, 'b': 0.34901960784313724, 'a': 1}, {'r': 0.4627450980392157, 'g': 0.7176470588235294, 'b': 0.6980392156862745, 'a': 1}, {'r': 0.34901960784313724, 'g': 0.6313725490196078, 'b': 0.30980392156862746, 'a': 1}, {'r': 0.9294117647058824, 'g': 0.788235294117647, 'b': 0.2823529411764706, 'a': 1}, {'r': 0.6901960784313725, 'g': 0.47843137254901963, 'b': 0.6313725490196078, 'a': 1}, {'r': 1, 'g': 0.615686274509804, 'b': 0.6549019607843137, 'a': 1}], 'fontFamily': 'system-ui, sans-serif', 'fontSize': 12, 'pointSize': 6, 'lineWidth': 1, 'devicePixelRatio': 1.5, 'reducedMotion': false, 'forcedColors': false}, 'renderer': {'pixelRatio': 1.5, 'size': [321, 123], 'clear': {'color': [0.005605391621829107, 0.015996293361446288, 0.033104766565152086]}, 'clearAlpha': 1}, 'canvas': [481, 184]},
  failure: {'lost': true, 'host': [['host.lost', 'error', 'Rendering failed.']]},
};

function encodeValue(value) {
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(encodeValue);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)]));
}
function cameraSnapshot(value) {
  return encodeValue({ position: value.position.toArray(), up: value.up.toArray(), near: value.near, far: value.far,
    aspect: value.aspect, projection: value.projectionMatrix.toArray(), world: value.matrixWorld.toArray(), view: value.view ? { ...value.view } : null });
}
function rendererSnapshot(viewport) {
  const renderer = viewport.renderer, color = renderer.getClearColor(new Color());
  return { pixelRatio: renderer.getPixelRatio(), size: renderer.getSize(new Vector2()).toArray(),
    clear: { color: [color.r, color.g, color.b].map(encodeValue) }, clearAlpha: renderer.getClearAlpha() };
}
async function turns() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
function deferredViewportValue() {
  let resolve, reject, settled = false;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, get settled() { return settled; }, resolve(value) { if (!settled) { settled = true; resolve(value); } },
    reject(value) { if (!settled) { settled = true; reject(value); } } };
}
function setupViewport(t, options = {}) {
  const browser = installFakeBrowser(), events = [], effects = [], loads = [], watched = [], hooks = {};
  const performanceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance'), originalPerformance = globalThis.performance;
  let time = 1000, viewport, resources, closed = false;
  Object.defineProperty(globalThis, 'performance', { configurable: true, writable: true, value: new Proxy(originalPerformance, {
    get(target, key) { if (key === 'now') return () => time; const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value; },
  }) });
  const module = { createLyra3dGlow(renderer) {
    const id = effects.length + 1;
    events.push(['glow.create', id]);
    const effect = { prepare() { events.push(['glow.prepare', id]); hooks.prepare?.(effect); },
      resize(...args) { events.push(['glow.resize', id, ...args]); hooks.resize?.(effect); },
      render(scene, camera) { events.push(['glow.render', id]); hooks.render?.(effect); renderer.render(scene, camera); },
      dispose() { events.push(['glow.dispose', id]); hooks.dispose?.(effect); } };
    effects.push(effect); return effect;
  } };
  const watch = promise => {
    const observed = promise.then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }));
    watched.push(observed); return observed;
  };
  const close = async () => {
    if (closed) return; closed = true;
    let failed = false, failure;
    const cleanup = action => { try { action(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
    cleanup(() => { browser.gl?.fail.clear(); });
    cleanup(() => viewport?.dispose());
    if (resources?.transferred) {
      cleanup(() => retireViewportExtras(resources)); cleanup(() => viewport.renderer.dispose());
      cleanup(() => viewport.canvas.contexts.at(-1).getExtension('WEBGL_lose_context')?.loseContext());
      cleanup(() => restoreViewportContextMethods(resources));
    }
    for (const load of loads) if (!load.settled) load.resolve(module);
    await turns(); await Promise.all(watched);
    cleanup(() => { if (performanceDescriptor) Object.defineProperty(globalThis, 'performance', performanceDescriptor); else delete globalThis.performance; });
    cleanup(() => browser.restore());
    if (failed) throw failure;
  };
  t.after(close);
  const host = Object.fromEntries(['hover', 'pick', 'camera', 'lost', 'restored', 'rendering'].map(name => [name, (...args) => {
    events.push(['host.' + name, ...args.map(encodeValue)]); hooks[name]?.(...args);
  }]));
  viewport = createLyra3dViewport(browser.container, host, {}, { loadGlow() {
    events.push(['glow.load']); const pending = deferredViewportValue(); loads.push(pending);
    if (!options.manualGlow) pending.resolve(module); return pending.promise;
  } });
  const token = captureViewportXrPreparation(viewport, false); resources = getViewportXrResources(token); releaseViewportXrPreparation(token);
  for (const name of ['setPixelRatio', 'setSize', 'setClearColor', 'render']) {
    const original = viewport.renderer[name];
    viewport.renderer[name] = function (...args) {
      events.push(name === 'render' ? ['renderer.render', args[0] === viewport.pickScene ? 'pick' : 'world', cameraSnapshot(args[1])]
        : ['renderer.' + name, ...args.map(value => value?.isColor ? [value.r, value.g, value.b] : value)]);
      return Reflect.apply(original, this, args);
    };
  }
  viewport.onFrame(value => { events.push(['frame', value, encodeValue(viewport.orbit)]); hooks.frame?.(value); });
  viewport.resize(...(options.size ?? [640, 480])); viewport.renderNow(); events.length = 0;
  return { browser, viewport, events, effects, loads, hooks, resources, watch, turns, close,
    clock(value) { time = value; },
    resolveLoad(index = loads.length - 1) { assert.ok(loads[index]); loads[index].resolve(module); },
    rejectLoad(reason, index = loads.length - 1) { assert.ok(loads[index]); loads[index].reject(reason); },
    lose() { browser.gl.lose(); viewport.canvas.dispatchEvent(new Event('webglcontextlost')); },
    restore() { browser.gl.lost = false; viewport.canvas.dispatchEvent(new Event('webglcontextrestored')); },
  };
}
function prepareInstall(viewport, style, orbit) {
  const access = getViewportTransactionAccess(viewport); assert.ok(access);
  const current = captureViewportTransaction(access);
  return prepareViewportTransactionInstall(access, current, current.lifetime, style, orbit);
}
function installStyle(viewport, raw, orbit) {
  const style = resolveLyra3dStyle(raw), operation = prepareInstall(viewport, style, orbit);
  validateViewportTransactionInstall(operation); installViewportTransaction(operation);
  return { style, operation };
}
function eventCount(fixture, name) { return fixture.events.filter(event => event[0] === name).length; }
function assertRenderer(viewport, expected) {
  assert.deepEqual(rendererSnapshot(viewport), expected.renderer);
  assert.deepEqual([viewport.canvas.width, viewport.canvas.height], expected.canvas);
}
function assertDrawAfterFrame(fixture) {
  const frame = fixture.events.findIndex(event => event[0] === 'frame');
  const draw = fixture.events.findIndex(event => event[0] === 'renderer.render' && event[1] === 'world');
  assert.ok(frame >= 0 && draw > frame, 'frame observers see the camera before world draw');
}
function withoutView(camera) { const result = { ...camera }; delete result.view; return result; }
function beginTransition(fixture) {
  fixture.clock(1000);
  fixture.viewport.transitionTo({ yaw: 1.25, pitch: 0.3, distance: 240, target: { x: 3, y: 4, z: 5 } });
  fixture.clock(1100); fixture.browser.flushFrames(1100);
  assert.deepEqual(encodeValue(fixture.viewport.orbit), CAPTURED.partialTransition.orbit);
  fixture.events.length = 0;
}

const registryInvalidState = error => error?.name === 'InvalidStateError';
const registryOperationError = error => error?.name === 'OperationError';
const registryWriteFields = ['style', 'styleEpoch', 'orbit', 'cameraEpoch', 'transition', 'cameraChanged',
  'pendingReducedMotion', 'pendingEffects', 'glowGeneration', 'pendingRender'];
const registryCounterFields = ['epoch', 'sizeEpoch', 'cameraEpoch', 'styleEpoch', 'glowGeneration'];
function registryOrbit(yaw = .4) {
  return Object.freeze({ yaw, pitch: .2, distance: 240, target: Object.freeze({ x: 1, y: 2, z: 3 }) });
}
function registryCell(overrides = {}) {
  return { active: true, lost: false, failed: false, restoring: false, epoch: 0, sizeEpoch: 0, cameraEpoch: 0, styleEpoch: 0,
    width: 320, height: 180, allocatedWidth: 320, allocatedHeight: 180, style: resolveLyra3dStyle(), orbit: DEFAULT_ORBIT_CAMERA,
    transition: undefined, gesture: undefined, cameraChanged: false, pendingRender: false, pendingEffects: undefined,
    pendingReducedMotion: undefined, glowGeneration: 0, glowRequested: false, glowPending: false, ...overrides };
}
function registryFacts(cell) { return Object.fromEntries(Object.keys(cell).map(key => [key, cell[key]])); }
function registrySameFacts(cell, expected) {
  assert.deepEqual(Object.keys(cell).sort(), Object.keys(expected).sort());
  for (const key of Object.keys(expected)) assert.equal(cell[key], expected[key], key);
}
function registryFixture(t, options = {}) {
  const effects = [], writes = [], raw = registryCell(options.cell), viewport = {};
  const resources = createViewportResources({ renderer: { dispose() { effects.push('renderer.dispose'); }, render() { effects.push('renderer.render'); } },
    canvas: { remove() { effects.push('canvas.remove'); } }, scene: new Scene(), pickScene: new Scene(), camera: new PerspectiveCamera(),
    picker: { dispose() { effects.push('picker.dispose'); } }, restoreContextMethods() { effects.push('context.restore'); } });
  // Transparent test instrumentation observes ordinary own data-property writes; it does not
  // describe admission of consumer proxies or add an observer API to the implementation.
  const cell = options.observeWrites ? new Proxy(raw, { set(target, key, value) {
    writes.push([key, value]); return Reflect.set(target, key, value, target);
  } }) : raw;
  if (options.viewportGetters) for (const key of ['width', 'height', 'orbit', 'style', 'lost', 'disposed']) {
    Object.defineProperty(viewport, key, { configurable: true, get() { assert.fail('Viewport getter must not run: ' + key); } });
  }
  if (options.xr !== false) registerViewportXr(viewport, resources, {});
  if (options.register !== false) registerViewportTransaction(viewport, cell);
  t.after(() => {
    unregisterViewportTransaction(viewport); unregisterViewportXr(viewport);
    try { retireViewportExtras(resources); } finally {
      try { resources.renderer.dispose(); } finally { restoreViewportContextMethods(resources); resources.canvas.remove(); }
    }
  });
  return { viewport, resources, cell, raw, effects, writes,
    get access() { return getViewportTransactionAccess(viewport); },
    capture() { return captureViewportTransaction(getViewportTransactionAccess(viewport)); },
    prepare(style = resolveLyra3dStyle({ background: '#123456', devicePixelRatio: 2 }), trustedOrbit) {
      const access = getViewportTransactionAccess(viewport), snapshot = captureViewportTransaction(access);
      return prepareViewportTransactionInstall(access, snapshot, snapshot.lifetime, style, trustedOrbit);
    } };
}
function registryReplacement(cell, key) {
  if (key === 'style') return resolveLyra3dStyle({ background: '#fedcba' });
  if (key === 'orbit') return registryOrbit(-.75);
  if (key === 'transition') return { from: cell.orbit, to: registryOrbit(), start: 10 };
  if (key === 'gesture') return { id: 9, startX: 0, startY: 0, x: 1, y: 2, moved: false, pan: true };
  if (key === 'pendingEffects') return { ...cell.pendingEffects };
  if (key === 'pendingReducedMotion') return { transition: cell.transition, styleEpoch: cell.styleEpoch };
  return typeof cell[key] === 'boolean' ? !cell[key] : cell[key] + 1;
}
function registryForbidThreeMethods(run) {
  const methods = [[Color.prototype, 'set'], [Color.prototype, 'setRGB'], [Color.prototype, 'setStyle'],
    [Matrix4.prototype, 'set'], [Vector2.prototype, 'set'], [Vector3.prototype, 'set'], [Vector4.prototype, 'set'],
    [PerspectiveCamera.prototype, 'updateProjectionMatrix'], [Object3D.prototype, 'updateMatrixWorld']];
  const saved = [];
  try {
    for (const [target, key] of methods) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key); assert.ok(descriptor);
      saved.push([target, key, descriptor]);
      Object.defineProperty(target, key, { ...descriptor, value() { assert.fail('Installation called Three method: ' + key); } });
    }
    return run();
  } finally { for (const [target, key, descriptor] of saved.reverse()) Object.defineProperty(target, key, descriptor); }
}

test('registry returns one opaque access and rejects duplicate/cross-viewport registration', t => {
  const first = registryFixture(t), second = registryFixture(t);
  assert.ok(first.access); assert.notEqual(first.access, second.access);
  assert.equal(getViewportTransactionAccess(first.viewport), first.access);
  assert.equal(Object.isFrozen(first.access), true); assert.deepEqual(Reflect.ownKeys(first.access), []);
  assert.equal(getViewportTransactionAccess({}), undefined);
  assert.throws(() => registerViewportTransaction(first.viewport, registryCell()), registryInvalidState);
  assert.throws(() => registerViewportTransaction({}, first.cell));
  const snapshot = first.capture();
  assert.throws(() => prepareViewportTransactionInstall(second.access, snapshot, snapshot.lifetime, resolveLyra3dStyle()), TypeError);
  assert.deepEqual(first.effects, []); assert.deepEqual(second.effects, []);
});

test('fabricated access/install/snapshot identities reject TypeError', t => {
  const f = registryFixture(t), snapshot = f.capture(), fake = Object.freeze({});
  assert.throws(() => captureViewportTransaction(fake), TypeError);
  assert.throws(() => prepareViewportTransactionInstall(fake, snapshot, snapshot.lifetime, f.cell.style), TypeError);
  assert.throws(() => prepareViewportTransactionInstall(f.access, Object.freeze({ ...snapshot }), snapshot.lifetime, f.cell.style), TypeError);
  for (const operation of [validateViewportTransactionInstall, installViewportTransaction, restoreViewportTransaction]) assert.throws(() => operation(fake), TypeError);
  assert.deepEqual(f.effects, []);
});

test('undefined/native/closed original XR lifetime refuses capture/preparation', t => {
  const missing = registryFixture(t, { xr: false });
  assert.throws(() => missing.capture(), registryInvalidState);
  const native = registryFixture(t), nativeSnapshot = native.capture();
  consumeViewportXrPreparation(captureViewportXrPreparation(native.viewport, false), false);
  assert.throws(() => native.capture(), registryInvalidState);
  assert.throws(() => prepareViewportTransactionInstall(native.access, nativeSnapshot, nativeSnapshot.lifetime, native.cell.style), registryInvalidState);
  const closed = registryFixture(t), closedSnapshot = closed.capture(); unregisterViewportXr(closed.viewport);
  assert.throws(() => closed.capture(), registryInvalidState);
  assert.throws(() => prepareViewportTransactionInstall(closed.access, closedSnapshot, closedSnapshot.lifetime, closed.cell.style), registryInvalidState);
  const current = registryFixture(t), currentSnapshot = current.capture();
  for (const lifetime of [undefined, Object.freeze({ ...currentSnapshot.lifetime })]) {
    assert.throws(() => prepareViewportTransactionInstall(current.access, currentSnapshot, lifetime, current.cell.style), registryInvalidState);
  }
  assert.deepEqual(missing.effects, []); assert.deepEqual(native.effects, []); assert.deepEqual(closed.effects, []);
});

test('unregister is idempotent and issued access/operations never revive', t => {
  const f = registryFixture(t), access = f.access, snapshot = f.capture(), install = f.prepare(), before = registryFacts(f.cell);
  unregisterViewportTransaction(f.viewport); unregisterViewportTransaction(f.viewport);
  assert.equal(getViewportTransactionAccess(f.viewport), undefined);
  assert.throws(() => captureViewportTransaction(access), registryInvalidState);
  assert.throws(() => prepareViewportTransactionInstall(access, snapshot, snapshot.lifetime, before.style), registryInvalidState);
  for (const operation of [validateViewportTransactionInstall, installViewportTransaction, restoreViewportTransaction]) {
    assert.throws(() => operation(install), registryInvalidState);
  }
  for (const key of registryWriteFields) assert.equal(f.cell[key], before[key]);
  assert.deepEqual(f.effects, []);
});

test('capture owns frozen fixed metadata with no viewport getter calls', t => {
  const f = registryFixture(t, { viewportGetters: true }), snapshot = f.capture(), originalStyle = f.cell.style;
  assert.equal(Object.isFrozen(snapshot), true);
  assert.deepEqual(Object.keys(snapshot).sort(), ['lifetime', 'epoch', 'sizeEpoch', 'cameraEpoch', 'styleEpoch', 'width', 'height', 'orbit', 'style', 'gestureActive'].sort());
  assert.equal(snapshot.lifetime, getViewportXrLifetimeStamp(f.viewport));
  for (const key of ['epoch', 'sizeEpoch', 'cameraEpoch', 'styleEpoch', 'width', 'height']) assert.equal(snapshot[key], f.cell[key]);
  assert.deepEqual(snapshot.orbit, f.cell.orbit); assert.equal(snapshot.style, originalStyle); assert.equal(snapshot.gestureActive, false);
  f.cell.gesture = registryReplacement(f.cell, 'gesture');
  const active = f.capture(); assert.equal(active.gestureActive, true); assert.equal(snapshot.gestureActive, false);
  f.cell.style = resolveLyra3dStyle({ background: '#ffffff' }); f.cell.width = 999;
  assert.equal(snapshot.style, originalStyle); assert.equal(snapshot.width, 320); assert.deepEqual(f.effects, []);
});

test('normal effective size/style/camera/transition operations advance appropriate versions', t => {
  const f = setupViewport(t), access = getViewportTransactionAccess(f.viewport); assert.ok(access);
  const take = () => captureViewportTransaction(access);
  let before = take();
  f.viewport.resize(320, 180); let after = take();
  assert.equal(after.sizeEpoch, before.sizeEpoch + 1); assert.equal(after.cameraEpoch, before.cameraEpoch); assert.equal(after.styleEpoch, before.styleEpoch);
  f.viewport.resize(320, 180); before = take(); assert.equal(before.sizeEpoch, after.sizeEpoch);
  f.viewport.setStyle({ devicePixelRatio: 1.5 }); after = take();
  assert.equal(after.styleEpoch, before.styleEpoch + 1); assert.equal(after.cameraEpoch, before.cameraEpoch); before = after;
  f.viewport.setOrbit(registryOrbit()); after = take(); assert.equal(after.cameraEpoch, before.cameraEpoch + 1); before = after;
  f.clock(1000); f.viewport.transitionTo(registryOrbit(1)); after = take(); assert.equal(after.cameraEpoch, before.cameraEpoch + 1); before = after;
  f.clock(1100); f.browser.flushFrames(1100); after = take(); assert.equal(after.cameraEpoch, before.cameraEpoch + 1); before = after;
  f.viewport.setOrbit(registryOrbit(-1)); after = take(); assert.equal(after.cameraEpoch, before.cameraEpoch + 1);
  assert.equal(after.sizeEpoch, before.sizeEpoch); assert.equal(after.styleEpoch, before.styleEpoch);
  f.viewport.canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 41 })); assert.equal(take().gestureActive, true);
  f.viewport.canvas.dispatchEvent(pointerEvent('pointercancel', { pointerId: 41 })); assert.equal(take().gestureActive, false);
});

test('fresh rollback snapshot permits explicit style/compatible camera under unchanged original lifetime; stale fresh snapshots refuse', t => {
  const f = registryFixture(t), original = f.capture(), explicit = resolveLyra3dStyle({ background: '#445566' });
  f.cell.style = resolveLyra3dStyle({ background: '#abcdef' }); f.cell.styleEpoch++;
  f.cell.orbit = registryOrbit(-.6); f.cell.cameraEpoch++;
  const currentOrbit = f.cell.orbit;
  assert.throws(() => prepareViewportTransactionInstall(f.access, original, original.lifetime, explicit), registryInvalidState);
  const fresh = f.capture(), install = prepareViewportTransactionInstall(f.access, fresh, original.lifetime, explicit);
  validateViewportTransactionInstall(install); validateViewportTransactionInstall(install);
  installViewportTransaction(install); assert.equal(f.cell.style, explicit); assert.equal(f.cell.orbit, currentOrbit);
  restoreViewportTransaction(install); assert.equal(f.cell.style, fresh.style); assert.equal(f.cell.orbit, currentOrbit);
  invalidateViewportXr(f.viewport); const newerLifetime = f.capture();
  assert.notEqual(newerLifetime.lifetime, original.lifetime);
  const before = registryFacts(f.cell);
  assert.throws(() => prepareViewportTransactionInstall(f.access, newerLifetime, original.lifetime, explicit), registryInvalidState);
  registrySameFacts(f.cell, before); assert.deepEqual(f.effects, []);
});

test('safe-counter overflow refuses before any cell write', t => {
  for (const field of registryCounterFields) for (const value of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const f = registryFixture(t, { observeWrites: true }); f.raw[field] = value; f.writes.length = 0;
    assert.throws(() => f.prepare());
    assert.deepEqual(f.writes, []);
    assert.equal(Object.is(f.raw[field], value), true); assert.deepEqual(f.effects, []);
  }
  for (const field of ['styleEpoch', 'glowGeneration', 'cameraEpoch']) {
    const f = registryFixture(t, { observeWrites: true }); f.raw[field] = Number.MAX_SAFE_INTEGER; f.writes.length = 0;
    assert.throws(() => f.prepare(undefined, field === 'cameraEpoch' ? registryOrbit() : undefined));
    assert.deepEqual(f.writes, []);
    assert.equal(f.raw[field], Number.MAX_SAFE_INTEGER); assert.deepEqual(f.effects, []);
  }
});

test('install uses exactly ten fixed writes and no parser/palette/GL/RAF/Three/application work', t => {
  const f = registryFixture(t, { observeWrites: true, viewportGetters: true }), before = registryFacts(f.cell);
  const resolved = resolveLyra3dStyle({ forcedColors: true, reducedMotion: true }); let paletteReads = 0;
  const palette = new Proxy(resolved.palette, { get() { paletteReads++; assert.fail('Prepared palette must not be read'); } });
  const prospective = Object.freeze({ ...resolved, palette }), install = f.prepare(prospective);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame'); let raf = 0;
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value() { raf++; assert.fail('Install scheduled a frame'); } });
  try {
    f.writes.length = 0; registryForbidThreeMethods(() => installViewportTransaction(install));
    assert.deepEqual(f.writes.map(([key]) => key), registryWriteFields);
    assert.equal(f.cell.style, prospective); assert.equal(f.cell.styleEpoch, before.styleEpoch + 1);
    assert.equal(f.cell.orbit, before.orbit); assert.equal(f.cell.cameraEpoch, before.cameraEpoch); assert.equal(f.cell.transition, before.transition);
    assert.equal(f.cell.cameraChanged, before.cameraChanged); assert.equal(f.cell.pendingReducedMotion, undefined);
    assert.equal(typeof f.cell.pendingEffects, 'object'); assert.ok(f.cell.pendingEffects);
    assert.equal(f.cell.glowGeneration, before.glowGeneration + 1); assert.equal(f.cell.pendingRender, true);
    assert.equal(paletteReads, 0); assert.equal(raf, 0); assert.deepEqual(f.effects, []);
    registryForbidThreeMethods(() => restoreViewportTransaction(install)); registrySameFacts(f.cell, before);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'requestAnimationFrame', descriptor); else delete globalThis.requestAnimationFrame; }
});

test('numeric failure points1..10 restore every field, consume failed operation and preserve native state', t => {
  for (let point = 1; point <= 10; point++) {
    const f = registryFixture(t, { observeWrites: true });
    f.raw.transition = { from: f.cell.orbit, to: registryOrbit(), start: 1000 }; f.raw.cameraChanged = true;
    f.raw.gesture = registryReplacement(f.cell, 'gesture');
    const before = registryFacts(f.cell), install = f.prepare(resolveLyra3dStyle({ reducedMotion: true, forcedColors: true }), registryOrbit(-1));
    assert.throws(() => installViewportTransaction(install, point), registryOperationError);
    registrySameFacts(f.cell, before); assert.deepEqual(f.effects, []);
    for (const operation of [validateViewportTransactionInstall, installViewportTransaction, restoreViewportTransaction]) {
      assert.throws(() => operation(install), registryInvalidState); registrySameFacts(f.cell, before);
    }
  }
  for (const point of [-1, .5, 11, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const f = registryFixture(t, { observeWrites: true }), before = registryFacts(f.cell), install = f.prepare();
    f.writes.length = 0; assert.throws(() => installViewportTransaction(install, point), RangeError);
    assert.deepEqual(f.writes, []); registrySameFacts(f.cell, before);
    installViewportTransaction(install); restoreViewportTransaction(install); registrySameFacts(f.cell, before);
  }
});

test('single-use install and guarded one-use restore cannot overwrite later style/camera/size/gesture/glow state', t => {
  const plain = registryFixture(t), before = registryFacts(plain.cell), install = plain.prepare();
  assert.throws(() => restoreViewportTransaction(install), registryInvalidState);
  installViewportTransaction(install); assert.throws(() => installViewportTransaction(install), registryInvalidState);
  restoreViewportTransaction(install); registrySameFacts(plain.cell, before);
  assert.throws(() => restoreViewportTransaction(install), registryInvalidState);
  const changedFields = [...registryWriteFields, 'width', 'height', 'allocatedWidth', 'allocatedHeight', 'sizeEpoch', 'epoch',
    'gesture', 'glowRequested', 'glowPending', 'active', 'lost', 'failed', 'restoring'];
  for (const field of changedFields) {
    const f = registryFixture(t), operation = f.prepare(); installViewportTransaction(operation);
    f.cell[field] = registryReplacement(f.cell, field); const changed = registryFacts(f.cell);
    assert.throws(() => restoreViewportTransaction(operation), registryInvalidState); registrySameFacts(f.cell, changed); assert.deepEqual(f.effects, []);
  }
  const gesture = registryFixture(t, { cell: { gesture: { id: 1, startX: 0, startY: 0, x: 0, y: 0, moved: false, pan: false } } });
  const gestureInstall = gesture.prepare(); installViewportTransaction(gestureInstall);
  gesture.cell.gesture = registryReplacement(gesture.cell, 'gesture'); const gestureChanged = registryFacts(gesture.cell);
  assert.equal(gesture.capture().gestureActive, true); assert.throws(() => restoreViewportTransaction(gestureInstall), registryInvalidState);
  registrySameFacts(gesture.cell, gestureChanged);
  const later = registryFixture(t), first = later.prepare(); installViewportTransaction(first);
  const second = later.prepare(resolveLyra3dStyle({ background: '#aabbcc' })); installViewportTransaction(second);
  const latest = registryFacts(later.cell); assert.throws(() => restoreViewportTransaction(first), registryInvalidState); registrySameFacts(later.cell, latest);
  restoreViewportTransaction(second);
  const lifetime = registryFixture(t), lifetimeInstall = lifetime.prepare(); installViewportTransaction(lifetimeInstall);
  invalidateViewportXr(lifetime.viewport); const lifetimeChanged = registryFacts(lifetime.cell);
  assert.throws(() => restoreViewportTransaction(lifetimeInstall), registryInvalidState); registrySameFacts(lifetime.cell, lifetimeChanged);
});

test('changed/accessor fixed targets reject before writes without invoking accessors', t => {
  for (const field of registryWriteFields) for (const mode of ['changed', 'accessor', 'readonly']) {
    const f = registryFixture(t, { observeWrites: true }), install = f.prepare(); let gets = 0, sets = 0;
    if (mode === 'changed') f.raw[field] = registryReplacement(f.cell, field);
    else if (mode === 'accessor') Object.defineProperty(f.raw, field, { configurable: true, enumerable: true,
      get() { gets++; assert.fail('Fixed target getter ran'); }, set() { sets++; assert.fail('Fixed target setter ran'); } });
    else Object.defineProperty(f.raw, field, { ...Object.getOwnPropertyDescriptor(f.raw, field), writable: false });
    const descriptors = Object.getOwnPropertyDescriptors(f.raw); f.writes.length = 0;
    assert.throws(() => validateViewportTransactionInstall(install), registryInvalidState);
    assert.throws(() => installViewportTransaction(install), registryInvalidState);
    assert.equal(gets, 0); assert.equal(sets, 0); assert.deepEqual(f.writes, []);
    assert.deepEqual(Object.getOwnPropertyDescriptors(f.raw), descriptors); assert.deepEqual(f.effects, []);
  }
  const invalid = registryFixture(t, { register: false }); let gets = 0;
  Object.defineProperty(invalid.cell, 'style', { configurable: true, enumerable: true, get() { gets++; assert.fail('Registration getter ran'); } });
  assert.throws(() => registerViewportTransaction(invalid.viewport, invalid.cell)); assert.equal(gets, 0);
});

test('first ordinary render flushes latest DPR/background before drawing', t => {
  const f = setupViewport(t, { size: [320, 180] }), before = rendererSnapshot(f.viewport);
  const { style } = installStyle(f.viewport, { background: 'rgba(12,34,56,0.4)', palette: ['#f00', '#0f0'], devicePixelRatio: 1.5, reducedMotion: true });
  assert.equal(f.viewport.style, style); assert.deepEqual(encodeValue(style), CAPTURED.styled.style);
  assert.deepEqual(rendererSnapshot(f.viewport), before); assert.deepEqual(f.events, []);
  f.viewport.renderNow(); assertRenderer(f.viewport, CAPTURED.styled); assertDrawAfterFrame(f);
  const size = f.events.findIndex(event => event[0] === 'renderer.setSize'), draw = f.events.findIndex(event => event[0] === 'renderer.render');
  assert.ok(size >= 0 && size < draw);
});

test('first immediate pick flushes effects without moving camera or running frame callbacks', t => {
  const f = setupViewport(t, { size: [320, 180] }), before = f.viewport.orbit;
  installStyle(f.viewport, { background: 'rgba(12,34,56,0.4)', palette: ['#f00', '#0f0'], devicePixelRatio: 1.5, reducedMotion: true });
  assert.equal(f.viewport.pickAt(10, 12), null);
  assertRenderer(f.viewport, CAPTURED.styled); assert.equal(f.viewport.orbit, before);
  assert.deepEqual(cameraSnapshot(f.viewport.camera), CAPTURED.styled.camera);
  assert.equal(eventCount(f, 'frame'), 0); assert.equal(eventCount(f, 'host.camera'), 0);
  assert.equal(f.events.filter(event => event[0] === 'renderer.render' && event[1] === 'world').length, 0);
  assert.equal(f.events.filter(event => event[0] === 'renderer.render' && event[1] === 'pick').length, 1);
});

test('active glow forced-colors installation disposes/reconciles only after install', async t => {
  const f = setupViewport(t);
  assert.equal((await f.watch(f.viewport.setGlow(true))).status, 'fulfilled');
  assert.equal(f.effects.length, 1); f.events.length = 0;
  const before = rendererSnapshot(f.viewport);
  installStyle(f.viewport, { forcedColors: true, reducedMotion: true });
  assert.deepEqual(f.events, []); assert.deepEqual(rendererSnapshot(f.viewport), before);
  assert.deepEqual(encodeValue(f.viewport.style), CAPTURED.forced.style);
  f.viewport.renderNow(); await turns();
  assertRenderer(f.viewport, CAPTURED.forced);
  assert.equal(eventCount(f, 'glow.dispose'), 1); assert.equal(eventCount(f, 'glow.render'), 0);
  assert.equal(eventCount(f, 'glow.create'), 0); assertDrawAfterFrame(f);
  f.viewport.renderNow(); assert.equal(eventCount(f, 'glow.dispose'), 1);
});

test('pending glow forced-colors installation invalidates old completion immediately and escapes render gating', async t => {
  const f = setupViewport(t, { manualGlow: true }), pending = f.watch(f.viewport.setGlow(true));
  assert.equal(f.loads.length, 1); assert.equal(f.effects.length, 0); f.events.length = 0;
  installStyle(f.viewport, { forcedColors: true }); assert.deepEqual(f.events, []);
  // Settle the older load BEFORE any renderer/pick flush: installation itself must revoke it.
  f.resolveLoad(0); const outcome = await pending;
  assert.equal(outcome.status, 'rejected'); assert.ok(aborted(outcome.reason)); assert.equal(f.effects.length, 0);
  f.viewport.renderNow(); await turns();
  assert.equal(f.viewport.lost, false); assert.equal(eventCount(f, 'glow.create'), 0);
  assert.equal(f.events.filter(event => event[0] === 'renderer.render' && event[1] === 'world').length, 1);
  assert.equal(eventCount(f, 'host.lost'), 0);
});

test('removing forced colors or resizing a pending style reconciles current requested glow exactly once', async t => {
  for (const mode of ['unforce', 'resize', 'pending-resize']) {
    const f = setupViewport(t, { manualGlow: mode === 'pending-resize' });
    try {
      if (mode === 'pending-resize') {
        const old = f.watch(f.viewport.setGlow(true)); assert.equal(f.loads.length, 1); f.events.length = 0;
        installStyle(f.viewport, { devicePixelRatio: 2 }); assert.deepEqual(f.events, []);
        f.resolveLoad(0); const superseded = await old; assert.equal(superseded.status, 'rejected'); assert.ok(aborted(superseded.reason));
        assert.equal(f.effects.length, 0); f.viewport.resize(800, 600); await turns();
        assert.equal(f.loads.length, 2); assert.equal(eventCount(f, 'glow.load'), 1);
        f.viewport.renderNow(); assert.equal(eventCount(f, 'renderer.render'), 0);
        f.resolveLoad(1); await turns(); f.viewport.renderNow();
        assertRenderer(f.viewport, CAPTURED.resized); assert.equal(eventCount(f, 'glow.create'), 1);
        assert.equal(eventCount(f, 'glow.render'), 1); assert.equal(eventCount(f, 'host.lost'), 0);
        assert.deepEqual(f.events.filter(event => event[0] === 'glow.resize').at(-1).slice(2), [800, 600, 2]);
        continue;
      }
      await f.watch(f.viewport.setGlow(true));
      if (mode === 'unforce') {
        f.viewport.setStyle({ forcedColors: true, reducedMotion: true }); await turns();
        f.events.length = 0; installStyle(f.viewport, { forcedColors: false, devicePixelRatio: 1.25 });
        assert.deepEqual(f.events, []); f.viewport.pickAt(1, 1); await turns(); f.viewport.renderNow();
        assertRenderer(f.viewport, CAPTURED.unforced); assert.deepEqual(encodeValue(f.viewport.style), CAPTURED.unforced.style);
        assert.equal(eventCount(f, 'glow.load'), 1); assert.equal(eventCount(f, 'glow.create'), 1);
        assert.equal(eventCount(f, 'glow.dispose'), 0); assert.equal(eventCount(f, 'glow.render'), 1);
      } else {
        f.events.length = 0; installStyle(f.viewport, { devicePixelRatio: 2 });
        f.viewport.resize(800, 600); await turns(); f.viewport.renderNow();
        assertRenderer(f.viewport, CAPTURED.resized); assert.equal(eventCount(f, 'glow.create'), 0);
        assert.equal(eventCount(f, 'glow.dispose'), 0);
        assert.deepEqual(f.events.filter(event => event[0] === 'glow.resize').at(-1).slice(2), [800, 600, 2]);
      }
    } finally { await f.close(); }
  }
});

test('later public setStyle/setGlow supersedes pending effects without stale DPR/glow restoration', async t => {
  for (const mode of ['style', 'disable']) {
    const f = setupViewport(t);
    try {
      const old = f.watch(f.viewport.setGlow(true));
      installStyle(f.viewport, { forcedColors: true, devicePixelRatio: 1.25 });
      if (mode === 'style') {
        f.viewport.setStyle({ devicePixelRatio: 2.5 }); f.viewport.resize(777, 333);
        await turns(); f.viewport.renderNow();
        assertRenderer(f.viewport, CAPTURED.latest); assert.deepEqual(encodeValue(f.viewport.style), CAPTURED.latest.style);
        assert.equal(f.viewport.lost, false); assert.ok(eventCount(f, 'glow.render') > 0);
      } else {
        assert.equal((await f.watch(f.viewport.setGlow(false))).status, 'fulfilled');
        await turns(); f.viewport.renderNow();
        assert.equal(f.viewport.style.forcedColors, true); assert.equal(f.viewport.renderer.getPixelRatio(), 1.25);
        assert.equal(eventCount(f, 'glow.render'), 0); assert.equal(eventCount(f, 'glow.create'), 0);
      }
      const outcome = await old; assert.equal(outcome.status, 'rejected'); assert.ok(aborted(outcome.reason));
      assert.equal(eventCount(f, 'host.lost'), 0);
    } finally { await f.close(); }
  }
});

test('prepared reducedMotion completes the captured transition only on next render before frame callbacks and draw', t => {
  const f = setupViewport(t); beginTransition(f);
  const before = f.viewport.orbit, access = getViewportTransactionAccess(f.viewport), epoch = captureViewportTransaction(access).cameraEpoch;
  installStyle(f.viewport, { reducedMotion: true });
  assert.equal(f.viewport.orbit, before); assert.equal(captureViewportTransaction(access).cameraEpoch, epoch); assert.deepEqual(f.events, []);
  f.viewport.renderNow();
  assert.deepEqual(encodeValue(f.viewport.orbit), CAPTURED.finishedTransition.orbit);
  assert.deepEqual(withoutView(cameraSnapshot(f.viewport.camera)), withoutView(CAPTURED.finishedTransition.camera));
  assert.equal(captureViewportTransaction(access).cameraEpoch, epoch + 1); assertDrawAfterFrame(f);
  assert.deepEqual(f.events.find(event => event[0] === 'frame')[2], CAPTURED.finishedTransition.orbit);
  const draw = f.events.findIndex(event => event[0] === 'renderer.render'), notification = f.events.findIndex(event => event[0] === 'host.camera');
  assert.ok(notification > draw); assert.equal(eventCount(f, 'host.camera'), 1);
  f.viewport.renderNow(); assert.equal(eventCount(f, 'host.camera'), 1);
});

test('immediate pick before the reduced-motion frame preserves old camera and geometry ordering', t => {
  const f = setupViewport(t); beginTransition(f);
  installStyle(f.viewport, { reducedMotion: true });
  assert.equal(f.viewport.pickAt(10, 10), null);
  assert.deepEqual(encodeValue(f.viewport.orbit), CAPTURED.partialTransition.orbit);
  assert.deepEqual(withoutView(cameraSnapshot(f.viewport.camera)), withoutView(CAPTURED.partialTransition.camera));
  assert.equal(eventCount(f, 'frame'), 0); assert.equal(eventCount(f, 'host.camera'), 0);
  f.viewport.renderNow(); assert.deepEqual(encodeValue(f.viewport.orbit), CAPTURED.finishedTransition.orbit);
  const draws = f.events.filter(event => event[0] === 'renderer.render'); assert.deepEqual(draws.map(event => event[1]), ['pick', 'world']);
  assertDrawAfterFrame(f);
});

test('new transition or public camera/style write clears old completion without a stale snap', async t => {
  for (const mode of ['transition', 'orbit', 'style']) {
    const f = setupViewport(t);
    try {
      beginTransition(f); installStyle(f.viewport, { reducedMotion: true });
      if (mode === 'transition') f.viewport.transitionTo({ yaw: -0.75, pitch: 0.1, distance: 210 });
      else if (mode === 'orbit') f.viewport.setOrbit({ yaw: -0.4, pitch: -0.1, distance: 180 });
      else f.viewport.setStyle({ reducedMotion: false });
      f.events.length = 0; f.clock(1200); f.viewport.renderNow();
      if (mode === 'style') {
        const eased = 1 - (1 - 200 / 320) ** 3;
        assert.equal(f.viewport.orbit.yaw, 1.25 * eased); assert.notEqual(f.viewport.orbit.yaw, 1.25);
      } else {
        assert.equal(f.viewport.orbit.yaw, mode === 'orbit' ? -0.4 : -0.75);
        f.clock(5000); f.viewport.renderNow(); assert.equal(f.viewport.orbit.yaw, mode === 'orbit' ? -0.4 : -0.75);
      }
      if (mode === 'orbit') assert.equal(eventCount(f, 'host.camera'), 0);
    } finally { await f.close(); }
  }
});

test('trusted orbit override cancels transition/completion silently and seeds its camera epoch', t => {
  const f = setupViewport(t); beginTransition(f);
  const access = getViewportTransactionAccess(f.viewport), before = captureViewportTransaction(access);
  const target = normalizeOrbitCamera({ yaw: -0.4, pitch: -0.2, distance: 180, target: { x: 1, y: 2, z: 3 } });
  installStyle(f.viewport, { reducedMotion: true }, target);
  assert.deepEqual(f.viewport.orbit, target); assert.equal(captureViewportTransaction(access).cameraEpoch, before.cameraEpoch + 1);
  assert.deepEqual(f.events, []); f.clock(5000); f.viewport.renderNow();
  assert.deepEqual(f.viewport.orbit, target); assert.equal(eventCount(f, 'host.camera'), 0); assertDrawAfterFrame(f);
});

test('loss then restore invalidates old original lifetime and applies current committed style', async t => {
  const f = setupViewport(t, { size: [321, 123] }), access = getViewportTransactionAccess(f.viewport), original = captureViewportTransaction(access);
  const { style, operation } = installStyle(f.viewport, { background: '#112233', devicePixelRatio: 1.5 });
  f.lose(); assert.equal(f.viewport.lost, true);
  assert.throws(() => captureViewportTransaction(access), invalidState); assert.throws(() => restoreViewportTransaction(operation), invalidState);
  f.restore(); await turns();
  assert.equal(f.viewport.style, style); assertRenderer(f.viewport, CAPTURED.restored);
  const current = captureViewportTransaction(getViewportTransactionAccess(f.viewport));
  assert.notEqual(current.lifetime, original.lifetime); assert.ok(current.epoch > original.epoch);
  assert.throws(() => prepareViewportTransactionInstall(getViewportTransactionAccess(f.viewport), current, original.lifetime, style), invalidState);
  f.viewport.pickAt(1, 1); f.viewport.renderNow(); assert.equal(f.viewport.lost, false);
  assert.deepEqual(f.events.filter(event => event[0] === 'host.lost').map(event => event[1]), ['context-lost']);
  assert.equal(eventCount(f, 'host.restored'), 1);
});

test('native handoff invalidates private authority before semantic cleanup reentry', t => {
  const f = setupViewport(t), access = getViewportTransactionAccess(f.viewport), operation = prepareInstall(f.viewport, resolveLyra3dStyle());
  const token = captureViewportXrPreparation(f.viewport, false), originalRemove = f.viewport.canvas.remove;
  let removals = 0;
  f.viewport.canvas.remove = function () {
    removals++; assert.equal(getViewportTransactionAccess(f.viewport), undefined);
    assert.throws(() => captureViewportTransaction(access), invalidState);
    assert.throws(() => installViewportTransaction(operation), invalidState);
    return Reflect.apply(originalRemove, this, []);
  };
  try {
    assert.equal(handoffViewportXr(f.viewport, token, false), f.resources); assert.equal(removals, 1);
    assert.equal(f.viewport.disposed, true); assert.equal(getViewportXrLifetimeStamp(f.viewport).phase, 'native');
    f.events.length = 0; const before = f.browser.gl.calls.length;
    f.viewport.setStyle({ forcedColors: true }); f.viewport.resize(800, 600); f.viewport.setOrbit({ yaw: 0.2 });
    f.viewport.invalidate(); f.viewport.pickAt(1, 1); f.viewport.renderNow();
    assert.deepEqual(f.events, []); assert.equal(f.browser.gl.calls.length, before); assert.equal(f.browser.pendingFrames(), 0);
  } finally { f.viewport.canvas.remove = originalRemove; }
});

test('deferred renderer/glow failure follows lost handling without retroactive installation rollback', async t => {
  for (const mode of ['renderer', 'glow']) {
    const f = setupViewport(t);
    try {
      if (mode === 'glow') await f.watch(f.viewport.setGlow(true));
      f.events.length = 0;
      const { style, operation } = installStyle(f.viewport, { background: '#f10203', devicePixelRatio: 2 });
      assert.deepEqual(f.events, []); assert.equal(f.viewport.lost, false);
      if (mode === 'renderer') f.browser.gl.fail.set('clearColor', new Error('Renderer state failed'));
      else f.hooks.resize = () => { throw new Error('Effect resize failed'); };
      f.viewport.renderNow(); await turns();
      assert.equal(f.viewport.lost, CAPTURED.failure.lost); assert.equal(f.viewport.style, style);
      assert.deepEqual(f.events.filter(event => event[0] === 'host.lost'), CAPTURED.failure.host);
      assert.throws(() => restoreViewportTransaction(operation), invalidState);
      const before = f.events.length; f.viewport.renderNow(); f.viewport.pickAt(1, 1); assert.equal(f.events.length, before);
      delete f.hooks.resize;
    } finally { await f.close(); }
  }
});

test('initialization/disposal failures release authority and ignore saved old work callbacks', async t => {
  const initialBrowser = installFakeBrowser();
  try {
    const failure = new Error('Initial host failed');
    assert.throws(() => createLyra3dViewport(initialBrowser.container, { rendering() { throw failure; } }), error => error === failure);
    assert.deepEqual(initialBrowser.container.children, []); assert.equal(initialBrowser.pendingFrames(), 0);
    assert.equal(initialBrowser.canvases.at(-1).contexts.at(-1).state.lost, true);
  } finally { initialBrowser.restore(); }
  const f = setupViewport(t, { manualGlow: true }), access = getViewportTransactionAccess(f.viewport);
  const operation = prepareInstall(f.viewport, resolveLyra3dStyle()), pending = f.watch(f.viewport.setGlow(true));
  const originalRemove = f.viewport.canvas.remove, failure = new Error('Canvas removal failed'); let removals = 0;
  f.viewport.canvas.remove = function () {
    removals++; assert.equal(getViewportTransactionAccess(f.viewport), undefined);
    assert.throws(() => captureViewportTransaction(access), invalidState);
    Reflect.apply(originalRemove, this, []); throw failure;
  };
  try {
    assert.throws(() => f.viewport.dispose(), error => error === failure); assert.equal(removals, 1);
    assert.throws(() => installViewportTransaction(operation), invalidState);
    const before = f.events.length; f.resolveLoad(0);
    const result = await pending; assert.equal(result.status, 'rejected'); assert.ok(aborted(result.reason));
    await turns(); f.viewport.renderNow(); f.viewport.pickAt(1, 1); f.browser.flushFrames();
    assert.equal(f.events.length, before); assert.equal(f.effects.length, 0); assert.equal(f.browser.pendingFrames(), 0);
  } finally { f.viewport.canvas.remove = originalRemove; }
});

test('flag-only installation schedules no RAF and explicit later invalidate wakes one current frame', async t => {
  const f = setupViewport(t); assert.equal(f.browser.pendingFrames(), 0);
  const before = rendererSnapshot(f.viewport);
  installStyle(f.viewport, { background: '#abcdef', devicePixelRatio: 2 }); await turns();
  assert.equal(f.browser.pendingFrames(), 0); assert.deepEqual(f.events, []); assert.deepEqual(rendererSnapshot(f.viewport), before);
  f.viewport.invalidate(); f.viewport.invalidate(); assert.equal(f.browser.pendingFrames(), 1);
  f.browser.flushFrames(1016); assert.equal(eventCount(f, 'frame'), 1); assert.equal(eventCount(f, 'renderer.render'), 1);
  assert.equal(f.viewport.renderer.getPixelRatio(), 2); assert.equal(f.browser.pendingFrames(), 1);
  f.browser.flushFrames(1032); assert.equal(eventCount(f, 'renderer.render'), 1); assert.equal(f.browser.pendingFrames(), 0);
});

test('deferred effect/camera callback reentry cannot resume overwritten work or work after disposal', async t => {
  for (const mode of ['style', 'renderer-dispose', 'glow-dispose', 'frame-dispose', 'camera-dispose']) {
    const f = setupViewport(t);
    try {
      if (mode === 'style') {
        installStyle(f.viewport, { devicePixelRatio: 2, background: '#123456' });
        const original = f.viewport.renderer.setPixelRatio; let entered = false;
        f.viewport.renderer.setPixelRatio = function (...args) {
          const result = Reflect.apply(original, this, args);
          if (!entered) { entered = true; f.viewport.setStyle({ devicePixelRatio: 3, background: '#abcdef' }); }
          return result;
        };
        try {
          f.viewport.renderNow(); await turns();
          assert.equal(entered, true); assert.equal(f.viewport.style.devicePixelRatio, 3); assert.equal(f.viewport.renderer.getPixelRatio(), 3);
          assert.equal(eventCount(f, 'host.lost'), 0);
        } finally { f.viewport.renderer.setPixelRatio = original; }
      } else if (mode === 'renderer-dispose') {
        installStyle(f.viewport, { devicePixelRatio: 2, background: '#123456' });
        const original = f.viewport.renderer.setPixelRatio; let afterDispose;
        f.viewport.renderer.setPixelRatio = function (...args) {
          const result = Reflect.apply(original, this, args);
          f.viewport.dispose(); afterDispose = f.events.length; return result;
        };
        try {
          f.viewport.renderNow(); await turns();
          assert.equal(f.viewport.disposed, true); assert.equal(typeof afterDispose, 'number');
          assert.equal(f.events.slice(afterDispose).some(event => event[0].startsWith('renderer.') || event[0].startsWith('glow.') || event[0] === 'frame'), false);
          assert.equal(getViewportTransactionAccess(f.viewport), undefined); assert.equal(eventCount(f, 'host.lost'), 0);
        } finally { f.viewport.renderer.setPixelRatio = original; }
      } else if (mode === 'glow-dispose') {
        await f.watch(f.viewport.setGlow(true)); f.events.length = 0;
        installStyle(f.viewport, { devicePixelRatio: 2 });
        let removed = false;
        f.hooks.resize = () => { if (!removed) { removed = true; f.viewport.dispose(); } };
        f.viewport.renderNow(); await turns();
        assert.equal(removed, true); assert.equal(f.viewport.disposed, true);
        const dispose = f.events.findIndex(event => event[0] === 'glow.dispose'); assert.ok(dispose >= 0);
        assert.equal(f.events.slice(dispose + 1).some(event => event[0] === 'glow.prepare' || event[0] === 'glow.render' || event[0] === 'renderer.render'), false);
        assert.equal(getViewportTransactionAccess(f.viewport), undefined); assert.equal(eventCount(f, 'host.lost'), 0);
      } else if (mode === 'camera-dispose') {
        beginTransition(f); installStyle(f.viewport, { reducedMotion: true });
        let callback = 0, afterDispose;
        f.hooks.camera = () => { callback++; f.viewport.dispose(); afterDispose = f.events.length; };
        f.viewport.renderNow(); await turns();
        assert.equal(callback, 1); assert.equal(f.viewport.disposed, true); assertDrawAfterFrame(f);
        assert.equal(eventCount(f, 'renderer.render'), 1); assert.equal(eventCount(f, 'host.camera'), 1);
        assert.ok(f.events.findIndex(event => event[0] === 'host.camera') > f.events.findIndex(event => event[0] === 'renderer.render'));
        assert.equal(f.events.length, afterDispose); assert.equal(getViewportTransactionAccess(f.viewport), undefined);
        f.viewport.renderNow(); f.browser.flushFrames(); assert.equal(f.events.length, afterDispose);
      } else {
        beginTransition(f); installStyle(f.viewport, { reducedMotion: true });
        f.hooks.frame = () => f.viewport.dispose(); f.viewport.renderNow();
        assert.equal(f.viewport.disposed, true); assert.equal(eventCount(f, 'renderer.render'), 0); assert.equal(eventCount(f, 'host.camera'), 0);
        assert.equal(getViewportTransactionAccess(f.viewport), undefined);
      }
    } finally { await f.close(); }
  }
});
