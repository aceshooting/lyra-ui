import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Vector2, WebGLRenderer } from 'three';
import { guardContextEpoch } from '../dist/core/context-epoch.js';
import { createThreeXrNativeOwner } from '../dist/xr/three-native-owner.js';
import { installFakeBrowser } from './fake-browser.mjs';
import { deferred, turns } from './xr-controller-fixture.mjs';

// Real renderer/manager execution against simulated native APIs and GL; no GPU or device evidence.
function fixture(t, branch, options = {}) {
  const saved = new Map(['self', 'XRWebGLLayer', 'XRWebGLBinding'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const browser = installFakeBrowser(), inline = new Map(); let next = 0;
  let teardownRenderer, teardownOwner, teardownSession, teardownGl, teardownGuard;
  t.after(() => {
    try {
      try { teardownOwner?.detach(); } catch { /* Continue independent cleanup. */ }
      try { if (teardownSession && !teardownSession.ended) teardownSession.signalEnd(); } catch { /* Continue independent cleanup. */ }
      try { teardownRenderer?.setAnimationLoop(null); } finally { teardownRenderer?.dispose(); }
    } finally {
      teardownGuard?.();
      teardownGl?.state.lose();
      try { browser.restore(); } finally {
        for (const [name, descriptor] of saved) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
        }
      }
    }
  });
  const compatibility = deferred(), referenceReady = deferred(), ending = deferred();
  const reference = new EventTarget(), trace = [], counts = { returns: 0, submitted: 0, prepare: 0, release: 0, legacy: 0, projection: 0 };
  class Session extends EventTarget {
    inputSources = []; enabledFeatures = []; environmentBlendMode = 'opaque'; visibilityState = 'visible';
    renderState = {}; frames = new Map(); next = 0; ended = false;
    requestReferenceSpace() { trace.push('reference'); return referenceReady.promise; }
    updateRenderState(value) { Object.assign(this.renderState, value); }
    requestAnimationFrame(callback) { if (this.ended) throw new DOMException('Ended', 'InvalidStateError'); const id = ++this.next; this.frames.set(id, callback); return id; }
    cancelAnimationFrame(id) { this.frames.delete(id); }
    end() { return ending.promise; }
    signalEnd() { this.ended = true; this.frames.clear(); this.dispatchEvent(new Event('end')); ending.resolve(); }
    deliver(frame) { const callbacks = [...this.frames.values()]; this.frames.clear(); for (const callback of callbacks) callback(100, frame); }
  }
  const session = new Session(); teardownSession = session;
  const endListeners = new Set();
  const add = session.addEventListener.bind(session), remove = session.removeEventListener.bind(session);
  session.addEventListener = (type, listener, ...args) => { if (type === 'end') endListeners.add(listener); add(type, listener, ...args); };
  session.removeEventListener = (type, listener, ...args) => { if (type === 'end') endListeners.delete(listener); remove(type, listener, ...args); };
  const viewport = view => ({ x: view.eye === 'right' ? 900 : 0, y: 0, width: view.eye === 'right' ? 700 : 900, height: view.eye === 'right' ? 650 : 700 });
  class Layer {
    framebuffer = {}; framebufferWidth = 1600; framebufferHeight = 700; ignoreDepthValues = false; fixedFoveation = 0;
    constructor(value) { assert.equal(value, session); counts.legacy++; if (options.layerError) throw new Error('Layer refused'); }
    getViewport(view) { return viewport(view); }
  }
  class Binding {
    constructor(value) { assert.equal(value, session); }
    createProjectionLayer() { counts.projection++; if (options.layerError) throw new Error('Layer refused'); return { textureWidth: 1600, textureHeight: 700, ignoreDepthValues: false, fixedFoveation: 0 }; }
    getViewSubImage(_layer, view) { return { viewport: viewport(view), colorTexture: {}, depthStencilTexture: {} }; }
  }
  Object.defineProperty(globalThis, 'self', { configurable: true, value: {
    requestAnimationFrame(callback) { const id = ++next; inline.set(id, callback); return id; },
    cancelAnimationFrame(id) { inline.delete(id); },
  } });
  Object.defineProperty(globalThis, 'XRWebGLLayer', { configurable: true, value: options.missingLayer ? undefined : Layer });
  if (branch === 'projection') Object.defineProperty(globalThis, 'XRWebGLBinding', { configurable: true, value: Binding });
  else delete globalThis.XRWebGLBinding;
  const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2'); teardownGl = gl;
  Object.defineProperty(gl, 'makeXRCompatible', { value: () => compatibility.promise });
  const originalExtension = gl.getExtension.bind(gl);
  Object.defineProperty(gl, 'getExtension', { configurable: true, value: name => name === 'WEBGL_lose_context'
    ? options.missingRelease ? null : { loseContext() { counts.release++; } } : originalExtension(name) });
  const controls = {}, guardDescriptors = new Map();
  let restoreGuard;
  if (options.guard) {
    const removeBuffer = gl.deleteBuffer;
    Object.defineProperty(gl, 'deleteBuffer', { configurable: true, enumerable: false, writable: true, value: removeBuffer });
    for (const name of ['createBuffer', 'deleteBuffer', 'createTexture', 'deleteTexture']) {
      guardDescriptors.set(name, Object.getOwnPropertyDescriptor(gl, name));
    }
    restoreGuard = guardContextEpoch(gl); teardownGuard = restoreGuard;
  }
  const renderer = new WebGLRenderer({ canvas, context: gl }); teardownRenderer = renderer;
  renderer.setSize(640, 360, false);
  const scene = new Scene(), camera = new PerspectiveCamera(55, 640 / 360, .1, 50);
  const geometry = new BoxGeometry(.2, .2, .2), material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material); mesh.position.z = -2; scene.add(mesh);
  const render = renderer.render.bind(renderer);
  renderer.render = (...args) => { render(...args); counts.returns++; trace.push('render-return'); };
  const owner = createThreeXrNativeOwner({ xr: { requestSession: () => Promise.resolve(session) }, renderer, canvas, scene, camera,
    stopInline() { renderer.setAnimationLoop(null); },
    prepareFrame() { counts.prepare++; return true; }, detachApplication() {},
    retireResources() { geometry.dispose(); material.dispose(); scene.clear(); },
    ...(options.postRenderer ? { afterRendererDispose() { controls.afterRendererDispose?.(); } } : {}),
  });
  teardownOwner = owner;
  const frame = (valid = true) => ({ session, getViewerPose: () => valid ? {
    transform: { matrix: new Matrix4().toArray() },
    views: ['left', 'right'].map(eye => ({ eye,
      projectionMatrix: new PerspectiveCamera(70, 1, .1, 50).projectionMatrix.toArray(),
      transform: { matrix: new Matrix4().makeTranslation(eye === 'left' ? -.032 : .032, 0, 0).toArray() },
    })),
  } : null });
  return { owner, renderer, gl, session, counts, trace, frame, compatibility, referenceReady, canvas, controls, endListeners, guardDescriptors, restoreGuard,
    queues: () => ({ inline: inline.size, native: session.frames.size }),
    draws: () => gl.state.callsOf('drawElements').length + gl.state.callsOf('drawArrays').length,
    async start() { const owned = await owner.request(); const binding = owner.bind(owned, () => { counts.submitted++; trace.push('submitted'); }); return { owned, binding }; },
    async bind() { const attempt = await this.start(); compatibility.resolve(); await turns(); referenceReady.resolve(reference); await attempt.binding; return attempt; },
    observeLoss() { gl.state.lose(); canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); },
    async finish() { owner.detach(); if (!session.ended) session.signalEnd(); await turns(); const retirement = owner.retire(); await turns(); this.observeLoss(); await retirement; assert.deepEqual(this.queues(), { inline: 0, native: 0 }); },
  };
}

for (const branch of ['legacy', 'projection']) {
  test(`real renderer ${branch}: null pose cannot submit; real GL dispatch and render return precede submission`, async t => {
    const f = fixture(t, branch); await f.bind();
    f.session.deliver(f.frame(false)); assert.equal(f.counts.returns, 0); assert.equal(f.counts.submitted, 0);
    const before = f.draws(), framebuffers = f.gl.state.callsOf('bindFramebuffer').length;
    const attachments = f.gl.state.callsOf('framebufferTexture2D').length;
    f.session.deliver(f.frame());
    assert.ok(f.draws() > before); assert.equal(f.counts.returns, 1); assert.equal(f.counts.submitted, 1);
    assert.deepEqual(f.trace.slice(-2), ['render-return', 'submitted']);
    assert.deepEqual(f.renderer.xr.getCamera().cameras.map(camera => camera.viewport.toArray()), [[0, 0, 900, 700], [900, 0, 700, 650]]);
    assert.ok(f.gl.state.callsOf('bindFramebuffer').length > framebuffers);
    if (branch === 'projection') assert.ok(f.gl.state.callsOf('framebufferTexture2D').length > attachments);
    await f.finish();
  });
  test(`real renderer ${branch}: thrown GL dispatch cannot produce a render return or submission`, async t => {
    const f = fixture(t, branch); await f.bind(); const failures = []; f.owner.observeFailure(reason => failures.push(reason));
    f.gl.state.fail.set('drawElements', new Error('Controlled dispatch failure'));
    f.session.deliver(f.frame()); assert.equal(f.counts.returns, 0); assert.equal(f.counts.submitted, 0); assert.deepEqual(failures, ['failed']);
    f.gl.state.fail.clear(); await f.finish();
  });
  test(`real renderer ${branch}: callback-null leaves native RAF/target ownership and presenting refuses inline resize`, async t => {
    const f = fixture(t, branch); await f.bind(); f.session.deliver(f.frame());
    f.renderer.setSize(777, 333, false); assert.deepEqual(f.renderer.getSize(new Vector2()).toArray(), [1600, 700]);
    f.owner.detach(); const before = f.session.next, draws = f.draws(), prepare = f.counts.prepare;
    f.renderer.setRenderTarget(null); f.session.deliver(f.frame());
    assert.equal(f.draws(), draws); assert.equal(f.counts.prepare, prepare); assert.ok(f.session.next > before);
    assert.equal(f.renderer.getRenderTarget().isXRRenderTarget, true); assert.deepEqual(f.queues(), { inline: 0, native: 1 });
    await f.finish();
  });
  test(`real renderer ${branch}: retirement stays pending after release request until context loss is observed`, async t => {
    const f = fixture(t, branch); await f.bind(); f.owner.detach(); f.session.signalEnd(); await turns();
    let settled = false; const retirement = f.owner.retire(); void retirement.then(() => { settled = true; }, () => { settled = true; });
    await turns(); assert.equal(f.counts.release, 1); assert.equal(f.gl.isContextLost(), false); assert.equal(settled, false);
    f.observeLoss(); await retirement; assert.deepEqual(f.queues(), { inline: 0, native: 0 });
  });
  test(`real renderer ${branch}: throwing native layer rejects binding without a fallback submission`, async t => {
    const f = fixture(t, branch, { layerError: true }); const { binding } = await f.start();
    const rejected = assert.rejects(binding); f.compatibility.resolve(); await rejected;
    assert.equal(f.counts.submitted, 0); assert.equal(f.counts.legacy, branch === 'legacy' ? 1 : 0);
    assert.equal(f.counts.projection, branch === 'projection' ? 1 : 0); await f.finish();
  });
  for (const phase of ['compatibility', 'reference']) {
    test(`real renderer ${branch}: end during ${phase} await cannot release before actual binding settlement`, async t => {
      const f = fixture(t, branch); const { binding } = await f.start();
      if (phase === 'reference') { f.compatibility.resolve(); await turns(); assert.ok(f.trace.includes('reference')); }
      f.owner.detach(); f.session.signalEnd(); await assert.rejects(f.owner.retire(), { name: 'InvalidStateError' });
      const observed = binding.then(() => 'fulfilled', () => 'rejected');
      f.compatibility.resolve(); await turns(); f.referenceReady.resolve(new EventTarget()); await observed;
      assert.equal(f.counts.submitted, 0); await f.finish();
    });
  }
}

test('real renderer legacy: missing native layer capability rejects binding', async t => {
  const f = fixture(t, 'legacy', { missingLayer: true }); const { binding } = await f.start();
  const rejected = assert.rejects(binding); f.compatibility.resolve(); await rejected;
  assert.equal(f.counts.submitted, 0); await f.finish();
});

test('real renderer legacy: missing context-release extension rejects retirement', async t => {
  const f = fixture(t, 'legacy', { missingRelease: true }); await f.bind(); f.owner.detach(); f.session.signalEnd(); await turns();
  await assert.rejects(f.owner.retire(), /XR resource retirement failed/u);
  assert.equal(f.gl.isContextLost(), false); assert.deepEqual(f.queues(), { inline: 0, native: 0 });
});


test('real renderer legacy: disposal failure still requests context loss and awaits its observation before rejection', async t => {
  const f = fixture(t, 'legacy'); await f.bind(); f.owner.detach(); f.session.signalEnd(); await turns();
  const dispose = f.renderer.dispose.bind(f.renderer); let disposals = 0;
  f.renderer.dispose = () => { disposals++; dispose(); throw new Error('Controlled disposal failure'); };
  let settled = false; const retirement = f.owner.retire();
  void retirement.then(() => { settled = true; }, () => { settled = true; });
  const rejected = assert.rejects(retirement, /XR resource retirement failed/u);
  await turns(); assert.equal(disposals, 1); assert.equal(f.counts.release, 1);
  assert.equal(settled, false); assert.equal(f.gl.isContextLost(), false);
  assert.deepEqual(f.queues(), { inline: 0, native: 0 });
  f.observeLoss(); await rejected;
  f.renderer.dispose = dispose;
});

test('real renderer legacy: throwing context release rejects after renderer disposal and queue cancellation', async t => {
  const f = fixture(t, 'legacy'); await f.bind(); f.owner.detach(); f.session.signalEnd(); await turns();
  const dispose = f.renderer.dispose.bind(f.renderer); let disposals = 0, releases = 0;
  f.renderer.dispose = () => { disposals++; dispose(); };
  Object.defineProperty(f.gl, 'getExtension', { configurable: true, value: name => {
    assert.equal(name, 'WEBGL_lose_context');
    return { loseContext() { releases++; throw new Error('Controlled release failure'); } };
  } });
  await assert.rejects(f.owner.retire(), /XR resource retirement failed/u);
  assert.equal(disposals, 1); assert.equal(releases, 1); assert.equal(f.gl.isContextLost(), false);
  assert.deepEqual(f.queues(), { inline: 0, native: 0 });
  f.renderer.dispose = dispose;
});


test('real renderer guard restoration follows actual renderer disposal and precedes final observed context release', async t => {
  const f = fixture(t, 'legacy', { guard: true, postRenderer: true }); await f.bind();
  f.session.deliver(f.frame());
  const guardedDelete = f.gl.deleteBuffer, guardedCreate = f.gl.createBuffer;
  f.observeLoss();
  f.gl.state.lost = false;
  f.canvas.dispatchEvent(new Event('webglcontextrestored'));
  f.owner.detach(); f.session.signalEnd(); await turns();
  const dispose = f.renderer.dispose.bind(f.renderer); let disposals = 0, hooks = 0;
  f.renderer.dispose = () => {
    if (disposals > 0) { dispose(); return; }
    assert.equal(f.gl.deleteBuffer, guardedDelete); assert.equal(f.gl.createBuffer, guardedCreate);
    dispose(); disposals++;
    assert.equal(f.gl.deleteBuffer, guardedDelete); assert.equal(f.gl.createBuffer, guardedCreate);
  };
  f.controls.afterRendererDispose = () => {
    hooks++; assert.equal(disposals, 1); assert.equal(f.counts.release, 0);
    f.restoreGuard();
    for (const [name, descriptor] of f.guardDescriptors) assert.deepEqual(Object.getOwnPropertyDescriptor(f.gl, name), descriptor);
  };
  const retirement = f.owner.retire(); let settled = false;
  void retirement.then(() => { settled = true; }, () => { settled = true; });
  await turns();
  assert.equal(disposals, 1); assert.equal(hooks, 1); assert.equal(f.counts.release, 1); assert.equal(settled, false);
  f.observeLoss(); await retirement;
  assert.equal(f.endListeners.size, 0); assert.deepEqual(f.queues(), { inline: 0, native: 0 });
  f.renderer.dispose = dispose;
});

test('throwing post-renderer cleanup runs once and cannot skip observed context release or native observer cleanup', async t => {
  const f = fixture(t, 'projection', { postRenderer: true }); await f.bind();
  f.owner.detach(); f.session.signalEnd(); await turns();
  const dispose = f.renderer.dispose.bind(f.renderer); let disposals = 0, hooks = 0;
  f.renderer.dispose = () => { dispose(); disposals++; };
  f.controls.afterRendererDispose = () => {
    hooks++; assert.equal(disposals, 1); throw new Error('Controlled post-renderer cleanup failure');
  };
  const retirement = f.owner.retire(), rejected = assert.rejects(retirement, error => error instanceof Error && error.message === 'XR resource retirement failed.');
  let settled = false; void retirement.then(() => { settled = true; }, () => { settled = true; });
  await turns(); assert.equal(hooks, 1); assert.equal(disposals, 1); assert.equal(f.counts.release, 1);
  assert.equal(settled, false); assert.equal(f.gl.isContextLost(), false);
  f.observeLoss(); await rejected;
  assert.equal(f.endListeners.size, 0); assert.deepEqual(f.queues(), { inline: 0, native: 0 });
  assert.equal(f.owner.retire(), retirement); assert.equal(hooks, 1);
  f.renderer.dispose = dispose;
});
