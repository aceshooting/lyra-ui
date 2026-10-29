import assert from 'node:assert/strict';
import { Matrix4, PerspectiveCamera, Scene, SRGBColorSpace, Vector2 } from 'three';
import { WebXRManager } from 'three/src/renderers/webxr/WebXRManager.js';
import { WebGLAnimation } from 'three/src/renderers/webgl/WebGLAnimation.js';
import { acquireXrPreparation, acquireXrSession, releaseXrSession } from '../dist/xr/coordinator.js';
import { createXrPresentationController } from '../dist/xr/controller.js';
import { deferred, turns } from './xr-controller-fixture.mjs';

export { turns };
export const eyeViewports = [[0, 0, 900, 700], [900, 0, 700, 650]];

class Session extends EventTarget {
  inputSources = [];
  enabledFeatures = [];
  environmentBlendMode = 'opaque';
  visibilityState = 'visible';
  renderState = {};
  reference = deferred();
  ending = deferred();
  ended = false;
  endCalls = 0;
  referenceCalls = [];
  frames = new Map();
  nextFrame = 0;
  endListeners = new Set();

  constructor(trace) { super(); this.trace = trace; }
  addEventListener(type, listener, options) {
    if (type === 'end') this.endListeners.add(listener);
    super.addEventListener(type, listener, options);
  }
  removeEventListener(type, listener, options) {
    if (type === 'end') this.endListeners.delete(listener);
    super.removeEventListener(type, listener, options);
  }
  requestReferenceSpace(kind) { this.referenceCalls.push(kind); this.trace.push('reference-request'); return this.reference.promise; }
  updateRenderState(value) { Object.assign(this.renderState, value); }
  requestAnimationFrame(callback) {
    if (this.ended) throw new DOMException('Session ended', 'InvalidStateError');
    const id = ++this.nextFrame; this.frames.set(id, callback); return id;
  }
  cancelAnimationFrame(id) { this.frames.delete(id); this.trace.push('session-raf-cancel'); }
  end() { this.endCalls++; this.trace.push('native-end-request'); return this.ending.promise; }
  signalEnd() {
    assert.equal(this.ended, false); this.ended = true; this.frames.clear();
    this.trace.push('native-end-event'); this.dispatchEvent(new Event('end'));
  }
  deliver(frame) {
    const callbacks = [...this.frames.values()]; this.frames.clear();
    for (const callback of callbacks) callback(100, frame);
    return callbacks.length;
  }
}

/** Actual manager/animation code with simulated native APIs and a recording renderer; no GPU. */
export function nativeFixture(t, createOwner, branch = 'legacy', options = {}) {
  const trace = [], request = deferred(), compatibility = deferred(), resources = deferred();
  const session = new Session(trace), reference = new EventTarget(), canvas = new EventTarget();
  const inlineFrames = new Map(); let nextInlineFrame = 0;
  const globals = new Map(['XRWebGLLayer', 'XRWebGLBinding', 'self'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const controls = { renderError: undefined, requestHook: undefined, prepareHook: undefined, detachHook: undefined, lost: false };
  const counts = { requests: 0, compatibility: 0, frames: 0, draws: 0, detach: 0, stop: 0,
    resources: 0, dispose: 0, releaseRequests: 0, framebuffer: 0, textures: 0, subImages: 0 };
  const viewport = view => {
    const [x, y, width, height] = eyeViewports[view.eye === 'right' ? 1 : 0];
    return { x, y, width, height };
  };
  class Layer {
    framebuffer = {};
    framebufferWidth = 1600;
    framebufferHeight = 700;
    ignoreDepthValues = false;
    fixedFoveation = 0;
    constructor(value) {
      assert.equal(value, session, 'native layer receives actual granted session');
      if (value.ended) throw new TypeError('Layer requires a live session');
      trace.push('legacy-layer');
      if (options.layerError) throw options.layerError;
    }
    getViewport(view) { return viewport(view); }
  }
  class Binding {
    constructor(value) {
      assert.equal(value, session, 'native binding receives actual granted session');
      if (value.ended) throw new TypeError('Binding requires a live session');
    }
    createProjectionLayer() {
      trace.push('projection-layer');
      if (options.layerError) throw options.layerError;
      return { textureWidth: 1600, textureHeight: 700, ignoreDepthValues: false, fixedFoveation: 0 };
    }
    getViewSubImage(layer, view) {
      assert.equal(layer, session.renderState.layers[0]); counts.subImages++;
      return { viewport: viewport(view), colorTexture: {}, depthStencilTexture: {} };
    }
  }
  const inlinePlatform = {
    requestAnimationFrame(callback) { const id = ++nextInlineFrame; inlineFrames.set(id, callback); return id; },
    cancelAnimationFrame(id) { inlineFrames.delete(id); trace.push('inline-raf-cancel'); },
  };
  Object.defineProperty(globalThis, 'XRWebGLLayer', { configurable: true, value: Layer });
  if (branch === 'projection') Object.defineProperty(globalThis, 'XRWebGLBinding', { configurable: true, value: Binding });
  else delete globalThis.XRWebGLBinding;
  Object.defineProperty(globalThis, 'self', { configurable: true, value: inlinePlatform });
  t.after(() => {
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  });

  const observeContextLoss = () => {
    if (controls.lost) return;
    controls.lost = true; trace.push('context-loss-observed'); canvas.dispatchEvent(new Event('webglcontextlost'));
  };
  const gl = {
    RGBA8: 32856, DEPTH24_STENCIL8: 35056, DEPTH_COMPONENT24: 33190,
    getContextAttributes: () => ({ xrCompatible: false, depth: true, stencil: false, antialias: false }),
    makeXRCompatible() { counts.compatibility++; trace.push('compatibility-request'); return compatibility.promise; },
    isContextLost: () => controls.lost,
    getExtension(name) {
      if (name !== 'WEBGL_lose_context' || options.missingRelease) return null;
      return { loseContext() { counts.releaseRequests++; trace.push('context-loss-request'); } };
    },
  };
  let currentTarget = { initial: true }, ratio = 1.25, width = 640, height = 360, callback;
  const inlineAnimation = new WebGLAnimation();
  inlineAnimation.setContext(inlinePlatform);
  inlineAnimation.setAnimationLoop(time => { callback?.(time); });
  const renderer = {
    domElement: canvas, outputColorSpace: SRGBColorSpace,
    getContext: () => gl,
    getRenderTarget: () => currentTarget,
    setRenderTarget(value) { currentTarget = value; trace.push(value?.isXRRenderTarget ? 'target-xr' : 'target-inline'); },
    setRenderTargetFramebuffer() { counts.framebuffer++; },
    setRenderTargetTextures() { counts.textures++; },
    getPixelRatio: () => ratio,
    setPixelRatio(value) { ratio = value; },
    getSize: value => value.set(width, height),
    setSize(w, h) { width = w; height = h; },
    setAnimationLoop(value) {
      callback = value; manager.setAnimationLoop(value);
      if (value === null) inlineAnimation.stop(); else inlineAnimation.start();
    },
    render(scene, camera) {
      assert.equal(scene, presentationScene); assert.equal(camera, presentationCamera);
      assert.equal(counts.dispose, 0, 'no render after renderer retirement');
      if (controls.renderError) throw controls.renderError;
      manager.updateCamera(camera); counts.draws++; trace.push('recorded-render-return');
    },
    dispose() {
      counts.dispose++; trace.push('renderer-dispose'); inlineAnimation.stop();
      manager.removeEventListener('sessionstart', onStart); manager.removeEventListener('sessionend', onEnd);
    },
    forceContextLoss() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
  const manager = new WebXRManager(renderer, gl); renderer.xr = manager;
  // Mirror only the renderer's animation ownership hooks. This is not WebGLRenderer evidence.
  const onStart = () => { trace.push('manager-start'); inlineAnimation.stop(); };
  const onEnd = () => { trace.push('manager-end'); inlineAnimation.start(); };
  manager.addEventListener('sessionstart', onStart); manager.addEventListener('sessionend', onEnd);
  const presentationScene = new Scene(), presentationCamera = new PerspectiveCamera(55, 640 / 360, .1, 50);
  const xr = {
    requestSession(mode, init) {
      assert.equal(this, xr); assert.equal(mode, 'immersive-vr'); assert.deepEqual(init, { requiredFeatures: ['local'] });
      counts.requests++; trace.push('native-request'); controls.requestHook?.();
      if (options.requestError) throw options.requestError;
      return request.promise;
    },
  };
  const owner = createOwner({ xr, renderer, canvas, scene: presentationScene, camera: presentationCamera,
    stopInline() { counts.stop++; trace.push('stop-inline'); inlineAnimation.stop(); if (options.stopError) throw options.stopError; },
    prepareFrame(frame, space) {
      assert.equal(frame.session, session); assert.equal(space, reference);
      counts.frames++; controls.prepareHook?.(); return frame.getViewerPose(space) !== null;
    },
    detachApplication() { counts.detach++; trace.push('application-detach'); controls.detachHook?.(); },
    retireResources() { counts.resources++; trace.push('resources-retire'); return resources.promise; },
  });
  const lease = acquireXrPreparation({}), documentKey = {}, finalizers = [], applicationErrors = [];
  const controller = createXrPresentationController({ preparationLease: lease, documentKey, nativeOwner: owner,
    validatePrepared: () => null,
    enqueueFinalizer: job => { finalizers.push(job); },
    reportApplicationError: error => { applicationErrors.push(error); },
  }, { onStateChange: state => { trace.push(`state:${state}`); } });
  const frame = (valid = true) => ({ session,
    getViewerPose(space) {
      assert.equal(space, reference);
      if (!valid) return null;
      const projection = new PerspectiveCamera(70, 1, .1, 50).projectionMatrix.toArray();
      return { transform: { matrix: new Matrix4().toArray() }, views: ['left', 'right'].map(eye => ({ eye,
        projectionMatrix: projection,
        transform: { matrix: new Matrix4().makeTranslation(eye === 'left' ? -.032 : .032, 0, 0).toArray() },
      })) };
    },
  });
  return { owner, controller, lease, trace, counts, controls, session, reference, request, compatibility, resources,
    manager, renderer, gl, canvas, frame, observeContextLoss, finalizers, applicationErrors,
    async grant() { request.resolve(session); await turns(); },
    async bind() { await this.grant(); compatibility.resolve(); await turns(); session.reference.resolve(reference); await turns(); },
    async flush() { await turns(); while (finalizers.length) { finalizers.shift()(); await turns(); } },
    queues: () => ({ inline: inlineFrames.size, native: session.frames.size }),
    size: () => renderer.getSize(new Vector2()).toArray(),
    documentBusy() {
      try { const value = acquireXrSession(documentKey); releaseXrSession(value); return false; }
      catch (error) { if (error.code === 'busy') return true; throw error; }
    },
  };
}
