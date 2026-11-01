import assert from 'node:assert/strict';
import { Matrix4, PerspectiveCamera } from 'three';
import { createPointsEngine } from '../dist/points/engine.js';
import { createLyra3dViewport } from '../dist/core/viewport.js';
import { FakeCanvas, FakeContainer, installFakeBrowser } from './fake-browser.mjs';
import { deferred } from './xr-controller-fixture.mjs';

export const defaultData = () => ({ positions: new Float32Array([-1, 0, 0, 1, .5, .25]), segments: new Uint32Array([0, 1]), mode: '3d' });
export async function settle() {
  for (let turn = 0; turn < 3; turn++) { for (let micro = 0; micro < 8; micro++) await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0)); }
}
export async function until(predicate) {
  for (let turn = 0; turn < 100; turn++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.ok(predicate(), 'Fixture condition did not settle within the bounded wait');
}

/** Actual points engine/renderer; native APIs and GL are explicitly simulated, never device proof. */
export async function createFixture(t, options = {}) {
  const branch = options.branch ?? 'legacy', support = options.support ?? true;
  const names = ['navigator', 'isSecureContext', 'self', 'XRWebGLLayer', 'XRWebGLBinding', 'reportError'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const browser = installFakeBrowser(), inline = new Map(), attempts = [], supportQueries = [], trace = [], records = [], contexts = [], errors = [];
  let nextInline = 0, cleaned = false, requestingGl;
  const define = (name, value) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  const viewportFor = view => ({ x: view.eye === 'right' ? 900 : 0, y: 0, width: view.eye === 'right' ? 700 : 900, height: view.eye === 'right' ? 650 : 700 });
  class Session extends EventTarget {
    inputSources = []; enabledFeatures = []; environmentBlendMode = 'opaque'; visibilityState = 'visible'; renderState = {};
    frames = new Map(); nextFrame = 0; endCalls = 0; ended = false; endListeners = new Set();
    constructor(attempt) { super(); this.attempt = attempt; }
    addEventListener(type, listener, config) { if (type === 'end') this.endListeners.add(listener); super.addEventListener(type, listener, config); }
    removeEventListener(type, listener, config) { if (type === 'end') this.endListeners.delete(listener); super.removeEventListener(type, listener, config); }
    requestReferenceSpace(kind) { this.attempt.referenceCalls.push(kind); trace.push('reference-request'); return this.attempt.referenceReady.promise; }
    updateRenderState(value) { Object.assign(this.renderState, value); }
    requestAnimationFrame(callback) { if (this.ended) throw new DOMException('Session ended', 'InvalidStateError'); const id = ++this.nextFrame; this.frames.set(id, callback); return id; }
    cancelAnimationFrame(id) { this.frames.delete(id); }
    end() { this.endCalls++; trace.push('native-end-request'); return this.attempt.ending.promise; }
  }
  class Layer {
    framebuffer = {}; framebufferWidth = 1600; framebufferHeight = 700; ignoreDepthValues = false; fixedFoveation = 0;
    constructor(session) { assert.ok(session instanceof Session); if (session.ended) throw new TypeError('Ended session'); trace.push('legacy-layer'); }
    getViewport(view) { return viewportFor(view); }
  }
  class Binding {
    constructor(session) { assert.ok(session instanceof Session); if (session.ended) throw new TypeError('Ended session'); }
    createProjectionLayer() { trace.push('projection-layer'); return { textureWidth: 1600, textureHeight: 700, ignoreDepthValues: false, fixedFoveation: 0 }; }
    getViewSubImage(_layer, view) { return { viewport: viewportFor(view), colorTexture: {}, depthStencilTexture: {} }; }
  }
  define('self', {
    requestAnimationFrame(callback) { const id = ++nextInline; inline.set(id, callback); return id; },
    cancelAnimationFrame(id) { inline.delete(id); },
  });
  define('XRWebGLLayer', Layer); if (branch === 'projection') define('XRWebGLBinding', Binding); else delete globalThis.XRWebGLBinding;
  define('isSecureContext', true);
  define('reportError', error => { errors.push(error); });
  const xr = {
    isSessionSupported(mode) {
      assert.equal(this, xr); const query = { mode, ...deferred() }; supportQueries.push(query); trace.push('support-query');
      if (support !== 'pending') query.resolve(support); return query.promise;
    },
    requestSession(mode, init) {
      assert.equal(this, xr); assert.equal(mode, 'immersive-vr'); assert.deepEqual(init, { requiredFeatures: ['local'] });
      const attempt = { request: deferred(), compatibility: deferred(), referenceReady: deferred(), reference: new EventTarget(), ending: deferred(), referenceCalls: [], gl: undefined, expectedGl: requestingGl, granted: false };
      attempt.session = new Session(attempt);
      attempt.grant = () => { attempt.granted = true; trace.push('native-grant'); attempt.request.resolve(attempt.session); };
      attempt.bind = async () => { attempt.grant(); await settle(); attempt.compatibility.resolve(); await settle(); attempt.referenceReady.resolve(attempt.reference); await settle(); };
      attempt.frame = (valid = true, headMatrix) => {
        const common = headMatrix ? [...headMatrix] : new Matrix4().makeTranslation(0, 1.6, 0).toArray();
        return { session: attempt.session, getViewerPose: () => valid ? {
          transform: { matrix: common }, views: ['left', 'right'].map(eye => {
            const eyeMatrix = new Matrix4().fromArray(common).multiply(new Matrix4().makeTranslation(eye === 'left' ? -.032 : .032, 0, 0));
            return { eye, transform: { matrix: eyeMatrix.toArray() }, projectionMatrix: new PerspectiveCamera(70, 1, .01, 100).projectionMatrix.toArray() };
          }),
        } : null };
      };
      attempt.deliver = (valid = true, headMatrix) => {
        const callbacks = [...attempt.session.frames.values()]; attempt.session.frames.clear();
        const frame = attempt.frame(valid, headMatrix); for (const callback of callbacks) callback(100, frame); return callbacks.length;
      };
      attempt.endEvent = () => {
        if (attempt.session.ended) return;
        attempt.session.ended = true; attempt.session.frames.clear(); trace.push('native-end-event'); attempt.session.dispatchEvent(new Event('end'));
      };
      attempts.push(attempt); trace.push('native-request'); return attempt.request.promise;
    },
  };
  define('navigator', { xr });
  const createElement = document.createElement.bind(document);
  document.createElement = name => {
    const canvas = createElement(name), getContext = canvas.getContext.bind(canvas);
    canvas.getContext = (...args) => {
      const gl = getContext(...args); if (!gl || args[0] !== 'webgl2') return gl;
      contexts.push(gl); gl.state.releaseRequests = 0; gl.state.deferRelease = false;
      const getExtension = gl.getExtension.bind(gl);
      Object.defineProperty(gl, 'getExtension', { configurable: true, value: extension => extension === 'WEBGL_lose_context' ? {
        loseContext() { trace.push('context-release-request'); gl.state.releaseRequests++; if (!gl.state.deferRelease) gl.state.lose(); },
      } : getExtension(extension) });
      Object.defineProperty(gl, 'makeXRCompatible', { configurable: true, value: () => {
        const attempt = attempts.find(value => !value.gl && value.expectedGl === gl)
          ?? attempts.find(value => !value.gl && value.granted && !value.expectedGl); assert.ok(attempt, 'Compatibility requires a requested attempt');
        attempt.gl = gl; trace.push('compatibility-request'); return attempt.compatibility.promise;
      } });
      return gl;
    };
    return canvas;
  };
  const fixture = {
    browser, attempts, supportQueries, trace, records, errors, settle, until,
    queues: () => ({ inline: browser.pendingFrames() + inline.size, native: attempts.reduce((sum, attempt) => sum + attempt.session.frames.size, 0) }),
    lose(record = fixture.record) {
      const gl = record.currentGL(); trace.push('context-loss-observed'); gl.state.lose(); gl.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    },
    async createRecord(input = defaultData(), hostOverrides = {}) {
      const record = { engine: undefined, viewports: [], callbacks: [], presentations: [], container: new FakeContainer(), renderReturns: 0, disposals: 0 };
      const host = Object.fromEntries(['hover', 'pick', 'camera', 'lost', 'restored', 'rendering'].map(name => [name, (...args) => {
        record.callbacks.push([name, ...args]); trace.push(`host:${name}`); hostOverrides[name]?.(...args);
      }]));
      record.engine = createPointsEngine({ labelCanvas: () => new FakeCanvas({ context2d: true }), viewport(container, nextHost, services) {
        const viewport = createLyra3dViewport(container, nextHost, services); record.viewports.push(viewport); trace.push('viewport-created');
        const render = viewport.renderer.render.bind(viewport.renderer), dispose = viewport.renderer.dispose.bind(viewport.renderer);
        viewport.renderer.render = (...args) => { const result = render(...args); record.renderReturns++; trace.push('renderer-return'); return result; };
        viewport.renderer.dispose = () => { record.disposals++; trace.push('renderer-dispose'); return dispose(); };
        return viewport;
      } });
      record.mount = async () => { await record.engine.mount(record.container, host); record.engine.resize(640, 480); browser.flushFrames(); };
      Object.defineProperty(record, 'viewport', { get: () => record.viewports.at(-1) });
      record.currentGL = () => record.viewport.renderer.getContext();
      record.enter = presentation => {
        requestingGl = record.currentGL(); requestingGl.state.deferRelease = true; record.presentations.push(presentation);
        try { return presentation.enter(); } finally { requestingGl = undefined; }
      };
      records.push(record);
      record.engine.setData(input, 0); if (options.style) record.engine.setStyle(options.style);
      await record.mount(); return record;
    },
    async cleanup() {
      if (cleaned) return; cleaned = true;
      try {
        for (const record of records) { for (const presentation of record.presentations) { try { presentation.dispose(); } catch { /* Continue independent fixture cleanup. */ } } try { record.engine.dispose(); } catch { /* Continue independent fixture cleanup. */ } }
        for (const query of supportQueries) query.resolve(false);
        for (const attempt of attempts) { attempt.grant(); attempt.compatibility.resolve(); attempt.referenceReady.resolve(attempt.reference); attempt.ending.resolve(); attempt.endEvent(); }
        await settle();
        for (const gl of contexts) { gl.state.lose(); gl.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); }
        await settle();
        for (const record of records) for (const viewport of record.viewports) { try { viewport.dispose(); } catch { /* Continue independent fixture cleanup. */ } }
      } finally {
        browser.restore();
        for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
      }
    },
  };
  fixture.restore = fixture.cleanup;
  t.after(() => fixture.cleanup());
  try { fixture.record = await fixture.createRecord(options.data ?? defaultData(), options.host); return fixture; }
  catch (error) { await fixture.cleanup(); throw error; }
}
