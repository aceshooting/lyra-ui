import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three';
import { createLyra3dViewport } from '../dist/core/viewport.js';
import { captureViewportXrPreparation, getViewportXrLifetimeStamp, getViewportXrResources,
  handoffViewportXr, invalidateViewportXr, isViewportXrPreparationCurrent,
  releaseViewportXrPreparation } from '../dist/core/viewport-xr.js';
import { restoreViewportContextMethods, retireViewportExtras, viewportResourceRetirement } from '../dist/core/viewport-resources.js';
import { createThreeXrNativeOwner } from '../dist/xr/three-native-owner.js';
import { acquireXrPreparation, acquireXrSession, releaseXrSession } from '../dist/xr/coordinator.js';
import { createXrPresentationController } from '../dist/xr/controller.js';
import { DEFAULT_LYRA_3D_STYLE } from '../dist/core/style.js';
import { createFakeGl, installFakeBrowser, pointerEvent, wheelEvent } from './fake-browser.mjs';
import { deferred, turns } from './xr-controller-fixture.mjs';

// Actual viewport/renderer with deterministic native APIs and fake GL, not GPU/device evidence.
function fixture(t, options = {}) {
  const browser = installFakeBrowser(), trace = [], hostCalls = [], methodCalls = [];
  const saved = new Map(['self', 'XRWebGLLayer', 'XRWebGLBinding'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const request = deferred(), compatibility = deferred(), referenceReady = deferred(), ending = deferred();
  const reference = new EventTarget(), finalizers = [], errors = [], documentKey = {};
  let viewport, resources, controller, session, gl, geometry, material;
  const counts = { rendererDisposals: 0, releaseRequests: 0, preparations: 0, nativeRequests: 0 };
  const listeners = new Map();
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try {
      try { controller?.dispose(); } catch { /* Continue independent cleanup. */ }
      try { if (session && !session.ended) session.signalEnd(); } catch { /* Continue independent cleanup. */ }
      compatibility.resolve(); referenceReady.resolve(reference); ending.resolve();
      await turns();
      while (finalizers.length) { finalizers.shift()(); await turns(); }
      try { viewport?.dispose(); } catch { /* Continue resource cleanup. */ }
      try { if (resources) retireViewportExtras(resources); } catch { /* Continue renderer cleanup. */ }
      try { viewport?.renderer.setAnimationLoop(null); viewport?.renderer.dispose(); } catch { /* Continue guard cleanup. */ }
      try { if (resources) restoreViewportContextMethods(resources); } catch { /* Continue fixture cleanup. */ }
      try { geometry?.dispose(); material?.dispose(); } catch { /* Continue global restoration. */ }
      gl?.state.lose();
    } finally {
      try { browser.restore(); } finally {
        for (const [name, descriptor] of saved) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
        }
      }
    }
  };
  t.after(cleanup);
  Object.defineProperty(globalThis, 'self', { configurable: true, value: { requestAnimationFrame, cancelAnimationFrame } });
  const createCanvas = document.createElement.bind(document);
  document.createElement = tag => {
    const canvas = createCanvas(tag), types = new Map(); listeners.set(canvas, types);
    const add = canvas.addEventListener.bind(canvas), remove = canvas.removeEventListener.bind(canvas);
    canvas.addEventListener = (type, callback, init) => { if (!types.has(type)) types.set(type, new Set()); types.get(type).add(callback); add(type, callback, init); };
    canvas.removeEventListener = (type, callback, init) => { types.get(type)?.delete(callback); remove(type, callback, init); };
    canvas.contextFactory = value => {
      const context = createFakeGl(value), probe = value.requests.at(-1)?.attributes?.failIfMajorPerformanceCaveat === true;
      if (!probe) {
        Object.defineProperty(context, 'makeXRCompatible', { value: () => compatibility.promise });
        const extension = context.getExtension.bind(context);
        Object.defineProperty(context, 'getExtension', { configurable: true, value: name => name === 'WEBGL_lose_context'
          ? { loseContext() { counts.releaseRequests++; trace.push('release-request'); if (!options.nativeBranch) context.state.lose(); } }
          : extension(name) });
      }
      return context;
    };
    return canvas;
  };
  class Session extends EventTarget {
    inputSources = []; enabledFeatures = []; environmentBlendMode = 'opaque'; visibilityState = 'visible';
    renderState = {}; frames = new Map(); next = 0; ended = false; endCalls = 0; endListeners = new Set();
    addEventListener(type, callback, init) { if (type === 'end') this.endListeners.add(callback); super.addEventListener(type, callback, init); }
    removeEventListener(type, callback, init) { if (type === 'end') this.endListeners.delete(callback); super.removeEventListener(type, callback, init); }
    requestReferenceSpace(type) { assert.equal(type, 'local'); trace.push('reference-request'); return referenceReady.promise; }
    updateRenderState(value) { Object.assign(this.renderState, value); }
    requestAnimationFrame(callback) { if (this.ended) throw new DOMException('Ended', 'InvalidStateError'); const id = ++this.next; this.frames.set(id, callback); return id; }
    cancelAnimationFrame(id) { this.frames.delete(id); }
    end() { this.endCalls++; return ending.promise; }
    signalEnd() { this.ended = true; this.frames.clear(); trace.push('native-end'); this.dispatchEvent(new Event('end')); }
    deliver(frame) { const due = [...this.frames.values()]; this.frames.clear(); for (const callback of due) callback(100, frame); }
  }
  session = new Session();
  const eyeViewport = view => ({ x: view.eye === 'right' ? 900 : 0, y: 0, width: view.eye === 'right' ? 700 : 900, height: view.eye === 'right' ? 650 : 700 });
  class Layer {
    framebuffer = {}; framebufferWidth = 1600; framebufferHeight = 700; ignoreDepthValues = false; fixedFoveation = 0;
    constructor(value) { assert.equal(value, session); }
    getViewport(view) { return eyeViewport(view); }
  }
  class Binding {
    constructor(value) { assert.equal(value, session); }
    createProjectionLayer() { return { textureWidth: 1600, textureHeight: 700, ignoreDepthValues: false, fixedFoveation: 0 }; }
    getViewSubImage(_layer, view) { return { viewport: eyeViewport(view), colorTexture: {}, depthStencilTexture: {} }; }
  }
  Object.defineProperty(globalThis, 'XRWebGLLayer', { configurable: true, value: Layer });
  if (options.nativeBranch === 'projection') Object.defineProperty(globalThis, 'XRWebGLBinding', { configurable: true, value: Binding });
  else delete globalThis.XRWebGLBinding;
  const host = Object.fromEntries(['hover', 'pick', 'camera', 'lost', 'restored', 'rendering'].map(name => [name, (...args) => { hostCalls.push([name, ...args]); }]));
  Object.assign(host, options.host);
  const construct = () => {
    viewport = createLyra3dViewport(browser.container, host, { wheelZoom: () => true, ...options.viewportOptions }, options.services);
    gl = viewport.renderer.getContext();
    const token = captureViewportXrPreparation(viewport, false); resources = getViewportXrResources(token); releaseViewportXrPreparation(token);
    for (const name of ['render', 'setSize', 'setPixelRatio', 'setClearColor', 'setAnimationLoop', 'dispose']) {
      const original = viewport.renderer[name].bind(viewport.renderer);
      viewport.renderer[name] = (...args) => {
        methodCalls.push(name);
        if (name === 'dispose') { counts.rendererDisposals++; trace.push('renderer-dispose'); }
        const result = original(...args);
        if (name === 'render') trace.push('render-return');
        return result;
      };
    }
    viewport.resize(640, 360);
    geometry = new BoxGeometry(.2, .2, .2); material = new MeshBasicMaterial();
    const box = new Mesh(geometry, material); box.position.z = -2; viewport.scene.add(box);
    return viewport;
  };
  if (!options.deferConstruction) construct();
  const frame = (valid = true) => ({ session, getViewerPose: () => valid ? {
    transform: { matrix: new Matrix4().toArray() }, views: ['left', 'right'].map(eye => ({ eye,
      projectionMatrix: new PerspectiveCamera(70, 1, .1, 50).projectionMatrix.toArray(),
      transform: { matrix: new Matrix4().makeTranslation(eye === 'left' ? -.032 : .032, 0, 0).toArray() },
    })),
  } : null });
  return { browser, counts, trace, hostCalls, methodCalls, listeners, construct, cleanup, session, request, compatibility, referenceReady, reference, ending, frame, errors,
    get viewport() { return viewport; }, get resources() { return resources; }, get gl() { return gl; },
    prepare: () => captureViewportXrPreparation(viewport, false),
    handoff(token) { return handoffViewportXr(viewport, token, false); },
    draws: () => gl.state.callsOf('drawElements').length + gl.state.callsOf('drawArrays').length,
    observeLoss() { gl.state.lose(); trace.push('loss-observed'); viewport.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); },
    queues: () => ({ inline: browser.pendingFrames(), native: session.frames.size }),
    documentBusy() { try { const lease = acquireXrSession(documentKey); releaseXrSession(lease); return false; } catch (error) { if (error.code === 'busy') return true; throw error; } },
    async flush() { await turns(); while (finalizers.length) { finalizers.shift()(); await turns(); } },
    controller() {
      const prepared = captureViewportXrPreparation(viewport, false), owned = getViewportXrResources(prepared);
      const owner = nativeOwner(owned, { viewport, prepared }, request, counts, trace);
      controller = createXrPresentationController({ preparationLease: acquireXrPreparation({}), documentKey, nativeOwner: owner,
        validatePrepared: () => isViewportXrPreparationCurrent(prepared) ? null : 'aborted',
        enqueueFinalizer: callback => finalizers.push(callback), reportApplicationError: error => errors.push(error),
      });
      return controller;
    },
  };
}

// Pending native ownership receives only resources; its one application key cell is cleared at entry.
function nativeOwner(resources, cell, request, counts, trace) {
  return createThreeXrNativeOwner({ xr: { requestSession() { counts.nativeRequests++; trace.push('native-request'); return request.promise; } },
    renderer: resources.renderer, canvas: resources.canvas, scene: resources.scene, camera: resources.camera,
    stopInline() { const viewport = cell.viewport, prepared = cell.prepared; cell.viewport = undefined; cell.prepared = undefined; handoffViewportXr(viewport, prepared, false); },
    prepareFrame() { counts.preparations++; return true; }, detachApplication() {},
    retireResources: viewportResourceRetirement(resources),
    afterRendererDispose() { trace.push('guard-finalize'); restoreViewportContextMethods(resources); },
  });
}
const inputListeners = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave', 'dblclick', 'wheel', 'contextmenu'];

test('real viewport unused preparation preserves inline rendering input and canvas ownership', t => {
  const f = fixture(t), stamp = getViewportXrLifetimeStamp(f.viewport), token = f.prepare();
  assert.equal(stamp.phase, 'inline'); assert.equal(Object.isFrozen(stamp), true);
  releaseViewportXrPreparation(token); assert.equal(getViewportXrLifetimeStamp(f.viewport), stamp);
  const before = f.draws(); f.viewport.renderNow(); assert.ok(f.draws() > before);
  f.viewport.canvas.dispatchEvent(pointerEvent('pointerdown')); assert.equal(f.viewport.canvas.captured.size, 1);
  f.viewport.canvas.dispatchEvent(pointerEvent('pointercancel'));
  assert.equal(f.browser.container.children.includes(f.viewport.canvas), true);
  assert.equal(f.counts.rendererDisposals, 0); assert.equal(f.counts.releaseRequests, 0);
});

test('real viewport handoff revokes inline ownership and canvas ancestry without retiring resources', t => {
  const f = fixture(t), token = f.prepare(), resources = getViewportXrResources(token);
  const before = f.methodCalls.length; f.viewport.canvas.dispatchEvent(pointerEvent('pointerdown'));
  assert.equal(f.handoff(token), resources);
  for (const key of ['renderer', 'canvas', 'scene', 'pickScene', 'camera']) assert.equal(resources[key], f.viewport[key]);
  assert.equal(f.viewport.disposed, true); assert.equal(resources.transferred, true); assert.equal(resources.extrasRetired, false);
  assert.equal(f.viewport.canvas.parent, undefined); assert.equal(f.viewport.canvas.captured.size, 0);
  for (const type of inputListeners) assert.equal(f.listeners.get(f.viewport.canvas).get(type)?.size ?? 0, 0, type);
  assert.deepEqual(f.queues(), { inline: 0, native: 0 }); assert.deepEqual(f.methodCalls.slice(before), []);
  assert.equal(f.gl.isContextLost(), false); assert.equal(f.counts.rendererDisposals, 0); assert.equal(f.counts.releaseRequests, 0);
});

test('all old viewport application routes stay silent after handoff including disposal', async t => {
  const f = fixture(t); let frames = 0; f.viewport.onFrame(() => { frames++; }); f.handoff(f.prepare());
  const methods = f.methodCalls.length, callbacks = f.hostCalls.length;
  f.viewport.resize(777, 333); f.viewport.setStyle({ ...DEFAULT_LYRA_3D_STYLE, forcedColors: true });
  f.viewport.setOrbit({ yaw: .4, pitch: .2, distance: 3, target: { x: 1, y: 2, z: 3 } });
  f.viewport.transitionTo({ yaw: .2 }); f.viewport.invalidate(); f.viewport.onFrame(() => { frames++; });
  assert.equal(f.viewport.pickAt(1, 1), null); f.viewport.renderNow(); await f.viewport.setGlow(true);
  f.viewport.canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 10 })); f.viewport.canvas.dispatchEvent(wheelEvent(20));
  f.viewport.dispose(); f.viewport.dispose(); f.browser.flushFrames(); await turns();
  assert.equal(frames, 0); assert.equal(f.hostCalls.length, callbacks); assert.deepEqual(f.methodCalls.slice(methods), []);
  assert.equal(f.counts.releaseRequests, 0); assert.equal(f.resources.extrasRetired, false); assert.equal(f.gl.isContextLost(), false);
});

test('handoff refusals preserve inline ownership while a detachment throw cannot reverse consumed ownership', t => {
  const f = fixture(t), old = f.prepare(); invalidateViewportXr(f.viewport);
  assert.throws(() => f.handoff(old), { code: 'aborted' });
  const current = f.prepare();
  assert.throws(() => handoffViewportXr({}, current, false), TypeError);
  assert.throws(() => handoffViewportXr(f.viewport, current, true), { code: 'busy' });
  assert.equal(isViewportXrPreparationCurrent(current), true); assert.equal(f.resources.transferred, false);
  const failure = new Error('Controlled listener cleanup failure'), remove = f.viewport.canvas.removeEventListener.bind(f.viewport.canvas);
  let injected = false;
  f.viewport.canvas.removeEventListener = (type, callback, options) => { remove(type, callback, options); if (!injected && type === 'pointerdown') { injected = true; throw failure; } };
  assert.throws(() => f.handoff(current), error => error === failure);
  assert.equal(f.resources.transferred, true); assert.equal(f.resources.extrasRetired, false);
  assert.equal(f.viewport.canvas.parent, undefined); assert.equal(f.viewport.disposed, true);
  for (const type of inputListeners) assert.equal(f.listeners.get(f.viewport.canvas).get(type)?.size ?? 0, 0, type);
  assert.equal(f.counts.rendererDisposals, 0); assert.equal(f.counts.releaseRequests, 0);
});

test('a delayed glow import cannot allocate prepare render or notify after viewport handoff', async t => {
  const module = deferred(), calls = [];
  const f = fixture(t, { services: { loadGlow: () => module.promise } });
  const pending = f.viewport.setGlow(true), rejected = assert.rejects(pending, { name: 'AbortError' });
  f.handoff(f.prepare()); const callbacks = f.hostCalls.length;
  module.resolve({ createLyra3dGlow() { calls.push('create'); return { dispose() {}, resize() {}, prepare() {}, render() {} }; } });
  await rejected; f.browser.flushFrames(); await turns();
  assert.deepEqual(calls, []); assert.equal(f.hostCalls.length, callbacks); assert.equal(f.counts.rendererDisposals, 0);
  f.viewport.dispose(); f.viewport.dispose(); assert.equal(getViewportXrLifetimeStamp(f.viewport), undefined);
});

test('ordinary viewport disposal independently preserves extras renderer context guard and canvas cleanup order', t => {
  const f = fixture(t), first = new Error('Controlled glow cleanup failure'), order = [];
  const pickerDispose = f.resources.picker.dispose.bind(f.resources.picker), rendererDispose = f.viewport.renderer.dispose.bind(f.viewport.renderer);
  const guard = f.resources.restoreContextMethods, canvasRemove = f.viewport.canvas.remove.bind(f.viewport.canvas);
  f.resources.glow = { dispose() { order.push('glow'); throw first; } };
  f.resources.picker.dispose = () => { order.push('picker'); pickerDispose(); throw new Error('Controlled picker cleanup failure'); };
  f.viewport.renderer.dispose = () => { order.push('renderer'); rendererDispose(); throw new Error('Controlled renderer cleanup failure'); };
  const extension = f.gl.getExtension.bind(f.gl);
  Object.defineProperty(f.gl, 'getExtension', { configurable: true, value: name => {
    const value = extension(name); if (name !== 'WEBGL_lose_context') return value;
    return { loseContext() { order.push('context'); value.loseContext(); } };
  } });
  f.resources.restoreContextMethods = () => { order.push('guard'); guard(); };
  f.viewport.canvas.remove = () => { order.push('canvas'); canvasRemove(); };
  assert.throws(() => f.viewport.dispose(), error => error === first);
  assert.deepEqual(order, ['glow', 'picker', 'renderer', 'context', 'guard', 'canvas']);
  assert.equal(f.gl.isContextLost(), true); assert.equal(f.resources.extrasRetired, true);
  assert.equal(getViewportXrLifetimeStamp(f.viewport), undefined); assert.equal(f.viewport.canvas.parent, undefined);
  f.viewport.renderer.dispose = rendererDispose; f.viewport.canvas.remove = canvasRemove;
});

test('context lifetime changes revoke old preparation and restoration never resumes transferred application work', t => {
  const f = fixture(t), old = f.prepare(), before = getViewportXrLifetimeStamp(f.viewport);
  f.observeLoss(); assert.notEqual(getViewportXrLifetimeStamp(f.viewport), before); assert.equal(isViewportXrPreparationCurrent(old), false);
  f.gl.state.lost = false; f.viewport.canvas.dispatchEvent(new Event('webglcontextrestored'));
  const restored = getViewportXrLifetimeStamp(f.viewport); assert.equal(restored.phase, 'inline');
  f.handoff(f.prepare()); const callbacks = f.hostCalls.length, frames = f.browser.pendingFrames();
  // Three may restore its own native state; the viewport must not publish or schedule application work.
  f.gl.state.lose(); f.viewport.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  f.gl.state.lost = false; f.viewport.canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(f.hostCalls.length, callbacks); assert.equal(f.browser.pendingFrames(), frames); assert.equal(f.viewport.disposed, true);
});

test('a failed initial host rendering callback releases acquired canvas listeners context and guards', t => {
  const failure = new Error('Controlled initial host failure');
  const f = fixture(t, { deferConstruction: true, host: { rendering() { throw failure; } } });
  assert.throws(() => f.construct(), error => error === failure);
  assert.equal(f.browser.container.children.length, 0); assert.equal(f.browser.pendingFrames(), 0);
  const canvas = f.browser.canvases.at(-1), gl = canvas.contexts.at(-1);
  assert.equal(gl.isContextLost(), true); assert.equal(Object.getOwnPropertyDescriptor(gl, 'createBuffer'), undefined);
  for (const callbacks of f.listeners.get(canvas).values()) assert.equal(callbacks.size, 0);
});

for (const branch of ['legacy', 'projection']) {
  test(`real viewport ${branch} native ownership waits binding end and observed release with silent inline application`, async t => {
    for (const endDuringBinding of [false, true]) {
      const f = fixture(t, { nativeBranch: branch }), controller = f.controller(), entry = controller.enter();
      assert.equal(f.counts.nativeRequests, 1); assert.equal(f.viewport.canvas.parent, undefined);
      const hostCount = f.hostCalls.length; assert.equal(f.resources.transferred, true);
      f.request.resolve(f.session); await turns(); f.compatibility.resolve(); await turns();
      assert.ok(f.trace.includes('reference-request'));
      if (!endDuringBinding) {
        f.referenceReady.resolve(f.reference); await turns();
        f.session.deliver(f.frame(false)); assert.equal(f.counts.preparations, 0);
        const draws = f.draws(); f.session.deliver(f.frame()); await entry;
        assert.ok(f.draws() > draws); assert.equal(controller.state, 'presenting');
        assert.deepEqual(f.viewport.renderer.xr.getCamera().cameras.map(camera => camera.viewport.toArray()), [[0, 0, 900, 700], [900, 0, 700, 650]]);
      }
      const rejected = endDuringBinding ? assert.rejects(entry, { code: 'aborted' }) : Promise.resolve();
      const exiting = controller.exit(); await rejected;
      f.ending.resolve(); await f.flush(); assert.equal(f.resources.extrasRetired, false);
      f.session.signalEnd(); await f.flush();
      if (endDuringBinding) {
        assert.equal(f.resources.extrasRetired, false, 'pending real binding still owns renderer');
        f.referenceReady.resolve(f.reference); await f.flush();
      }
      assert.equal(f.resources.extrasRetired, true); assert.equal(f.counts.rendererDisposals, 1);
      assert.equal(f.counts.releaseRequests, 1); assert.equal(f.documentBusy(), true); assert.equal(f.gl.isContextLost(), false);
      assert.ok(f.trace.indexOf('renderer-dispose') < f.trace.indexOf('guard-finalize'));
      assert.ok(f.trace.indexOf('guard-finalize') < f.trace.indexOf('release-request'));
      assert.equal(Object.getOwnPropertyDescriptor(f.gl, 'createBuffer'), undefined);
      f.observeLoss(); await exiting; await turns();
      assert.equal(f.documentBusy(), false); assert.equal(f.hostCalls.length, hostCount); assert.equal(f.counts.preparations, endDuringBinding ? 0 : 1);
      assert.equal(f.session.endListeners.size, 0); assert.deepEqual(f.queues(), { inline: 0, native: 0 }); assert.deepEqual(f.errors, []);
      await f.cleanup();
    }
  });
}

test('frozen lifetime stamp identity changes only with ownership lifetime and reads are effect-free', t => {
  const f = fixture(t), initial = getViewportXrLifetimeStamp(f.viewport), methods = f.methodCalls.length;
  assert.equal(Object.isFrozen(initial), true); assert.deepEqual(Object.keys(initial).sort(), ['epoch', 'phase']);
  for (let i = 0; i < 5; i++) assert.equal(getViewportXrLifetimeStamp(f.viewport), initial);
  assert.equal(f.methodCalls.length, methods);
  f.viewport.setOrbit({ yaw: .25 }); f.viewport.setStyle(DEFAULT_LYRA_3D_STYLE);
  assert.equal(getViewportXrLifetimeStamp(f.viewport), initial);
  invalidateViewportXr(f.viewport); const invalidated = getViewportXrLifetimeStamp(f.viewport);
  assert.notEqual(invalidated, initial); assert.equal(invalidated.epoch, initial.epoch + 1); assert.equal(invalidated.phase, 'inline');
  f.handoff(f.prepare()); const native = getViewportXrLifetimeStamp(f.viewport);
  assert.notEqual(native, invalidated); assert.equal(native.phase, 'native');
  f.viewport.dispose(); assert.equal(getViewportXrLifetimeStamp(f.viewport), undefined);
});
