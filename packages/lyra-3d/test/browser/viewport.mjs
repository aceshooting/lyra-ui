import { Color, DataTexture, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, WebGLRenderTarget } from 'three';
import { createLyra3dViewport, createPickMaterial, DEFAULT_ORBIT_CAMERA, DEFAULT_LYRA_3D_STYLE } from '@aceshooting/lyra-3d/core';
let active;
const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
export function cleanupViewport() { active?.viewport.dispose(); active?.container.remove(); active = undefined; }
function mount(options = {}, overrides = {}) {
  cleanupViewport();
  const container = document.createElement('div'); container.style.cssText = 'position:absolute;left:0;top:0;width:480px;height:320px'; document.body.replaceChildren(container);
  const calls = { lost: [], camera: [], pick: [], hover: [], restored: 0 };
  const viewport = createLyra3dViewport(container, { lost: (...args) => calls.lost.push(args), camera: (value) => calls.camera.push(value), pick: (item) => calls.pick.push(item), hover: (item) => calls.hover.push(item), restored: () => calls.restored++, ...overrides }, options);
  viewport.resize(480, 320); viewport.renderNow();
  return active = { viewport, container, calls };
}
export const viewportCases = {
  async 'viewport-render-failure-is-terminal'() {
    const { viewport, calls } = mount(); let renders = 0, frames = 0;
    viewport.onFrame(() => { frames++; viewport.invalidate(); });
    viewport.transitionTo({ ...viewport.orbit, yaw: 1 });
    viewport.renderer.render = () => { renders++; throw new Error('Untrusted driver detail'); };
    viewport.renderNow();
    const stopped = JSON.stringify(viewport.orbit);
    viewport.invalidate(); viewport.renderNow();
    viewport.canvas.dispatchEvent(new Event('webglcontextrestored'));
    await settle();
    return { passed: viewport.lost && renders === 1 && frames === 1 && calls.lost.length === 1 &&
      calls.lost[0][0] === 'error' && calls.lost[0][1] === 'Rendering failed.' && calls.camera.length === 0 &&
      calls.restored === 0 && JSON.stringify(viewport.orbit) === stopped && viewport.pickAt(10, 10) === null, calls, renders, frames };
  },
  'viewport-pick-render-failure'() {
    const { viewport, calls } = mount(); viewport.renderer.render = () => { throw new Error('pick upload'); };
    const item = viewport.pickAt(20, 20); viewport.renderNow();
    return { passed: item === null && viewport.lost && calls.lost.length === 1 && calls.lost[0][0] === 'error', calls };
  },
  'viewport-host-errors-propagate'() {
    const marker = new Error('host callback');
    const { viewport, calls } = mount({}, { camera() { throw marker; } });
    viewport.setStyle({ ...DEFAULT_LYRA_3D_STYLE, reducedMotion: true }); viewport.transitionTo({ ...viewport.orbit, yaw: 1 });
    let caught; try { viewport.renderNow(); } catch (error) { caught = error; }
    return { passed: caught === marker && !viewport.lost && calls.lost.length === 0 };
  },
  'viewport-frame-disposal-stops-render'() {
    const { viewport, calls } = mount(); let renders = 0, later = 0;
    viewport.renderer.render = () => { renders++; };
    viewport.onFrame(() => viewport.dispose()); viewport.onFrame(() => later++);
    viewport.transitionTo({ ...viewport.orbit, yaw: 1 }); viewport.renderNow();
    return { passed: viewport.disposed && renders === 0 && later === 0 && calls.camera.length === 0 && calls.lost.length === 0 };
  },
  'viewport-loss-disposal-and-error-propagation'() {
    const marker = new Error('loss host'); let lost = 0; let viewport;
    ({ viewport } = mount({}, { lost() { lost++; viewport.dispose(); throw marker; } }));
    viewport.renderer.render = () => { throw new Error('upload'); };
    let caught; try { viewport.renderNow(); } catch (error) { caught = error; }
    viewport.renderNow();
    return { passed: caught === marker && lost === 1 && viewport.disposed };
  },
};
function prepare(primaryPan) {
  const record = mount(primaryPan === undefined ? {} : { primaryPan: () => primaryPan });
  record.before = structuredClone(DEFAULT_ORBIT_CAMERA); record.viewport.setOrbit(record.before); record.viewport.renderNow();
  record.trusted = 0; record.viewport.canvas.addEventListener('pointermove', (event) => { if (event.isTrusted && event.buttons === 1) record.trusted++; });
  return { action: 'drag', setup: { start: { x: 120, y: 200 }, end: { x: 220, y: 170 } }, steps: 10 };
}
async function verify(pan) {
  await settle(); const { viewport, calls, before, trusted } = active; const next = viewport.orbit;
  return { passed: trusted > 0 && calls.camera.length > 0 && calls.pick.length === 0 && (pan ?
    next.yaw === before.yaw && next.pitch === before.pitch && Math.abs(next.target.x - before.target.x) > 1 :
    Math.abs(next.yaw - before.yaw) > 0.1 && JSON.stringify(next.target) === JSON.stringify(before.target)), next, trusted };
}
export const viewportPointerCases = {
  'viewport-primary-pan': () => prepare(true), 'viewport-primary-pan:verify': () => verify(true),
  'viewport-primary-default-orbit': () => prepare(undefined), 'viewport-primary-default-orbit:verify': () => verify(false),
  'viewport-primary-false-orbit': () => prepare(false), 'viewport-primary-false-orbit:verify': () => verify(false),
};

export function viewportPointerCheckpoint(name) {
  if (name !== 'viewport-drag-render-failure') return;
  const { viewport } = active;
  active.capturedBefore = viewport.canvas.hasPointerCapture(active.pointerId);
  viewport.renderer.render = () => { throw new Error('upload during drag'); };
  viewport.renderNow();
  active.capturedAfter = viewport.canvas.hasPointerCapture(active.pointerId);
  active.cameraCountAtFailure = active.calls.camera.length;
}
viewportPointerCases['viewport-drag-render-failure'] = () => {
  const setup = prepare(false);
  active.viewport.canvas.addEventListener('pointerdown', (event) => { active.pointerId = event.pointerId; });
  return setup;
};
viewportPointerCases['viewport-drag-render-failure:verify'] = async () => {
  await settle(); const record = active;
  return { passed: record.trusted > 0 && record.capturedBefore === true && record.capturedAfter === false &&
    record.viewport.lost && record.calls.lost.length === 1 && record.calls.camera.length === record.cameraCountAtFailure &&
    record.calls.pick.length === 0, capturedBefore: record.capturedBefore, capturedAfter: record.capturedAfter, calls: record.calls };
};

viewportCases['viewport-constrain-disposal-stops-transition'] = () => {
  let viewport; let callsToConstrain = 0;
  ({ viewport } = mount({ constrain(value) { callsToConstrain++; viewport.dispose(); return value; } }));
  const before = viewport.orbit;
  viewport.transitionTo({ ...before, yaw: 1 }); viewport.renderNow();
  return { passed: callsToConstrain === 1 && viewport.disposed && viewport.orbit === before && active.calls.camera.length === 0 };
};
viewportCases['viewport-frame-errors-propagate'] = () => {
  const { viewport, calls } = mount(); const marker = new Error('frame callback');
  viewport.onFrame(() => { throw marker; });
  let caught; try { viewport.renderNow(); } catch (error) { caught = error; }
  return { passed: caught === marker && !viewport.lost && calls.lost.length === 0 };
};


async function constructorFailure(stage, throwingCleanup = false) {
  cleanupViewport();
  const marker = new Error(`constructor ${stage}`);
  const secondary = new Error('secondary cleanup failure');
  const container = document.createElement('div'); document.body.replaceChildren(container);
  const nativeContext = HTMLCanvasElement.prototype.getContext;
  const nativeCamera = PerspectiveCamera.prototype.updateProjectionMatrix;
  const nativeTargetDispose = WebGLRenderTarget.prototype.dispose;
  const nativeAppend = container.append.bind(container);
  const records = [];
  const seen = new WeakSet();
  let pickerDisposals = 0; let nameFaultHits = 0;
  let result; let caught;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    // The capability probe must reach a native context in this fault scenario even on software
    // backends, otherwise its major-caveat result short-circuits the renderer-name read entirely.
    const requested = stage === 'renderer-name' && args[0] === 'webgl2' && args[1]?.failIfMajorPerformanceCaveat
      ? [args[0], { ...args[1], failIfMajorPerformanceCaveat: false }] : args;
    const gl = nativeContext.apply(this, requested);
    if (args[0] === 'webgl2' && gl && !seen.has(gl)) {
      seen.add(gl);
      const nativeMethods = ['createBuffer', 'deleteBuffer', 'createTexture', 'deleteTexture', 'createVertexArray', 'deleteVertexArray', 'fenceSync', 'deleteSync'];
      const descriptors = nativeMethods.map(name => [name, Object.getOwnPropertyDescriptor(gl, name)]);
      const record = { canvas: this, gl, extension: gl.getExtension('WEBGL_lose_context'), listeners: new Set(), descriptors }; records.push(record);
      const add = this.addEventListener.bind(this); const remove = this.removeEventListener.bind(this);
      this.addEventListener = (type, listener, options) => { record.listeners.add(listener); return add(type, listener, options); };
      this.removeEventListener = (type, listener, options) => { record.listeners.delete(listener); return remove(type, listener, options); };
      if (stage === 'renderer-name') {
        const parameter = gl.getParameter.bind(gl);
        gl.getParameter = (name) => { if (name === gl.RENDERER) { nameFaultHits++; throw marker; } return parameter(name); };
      }
    }
    return gl;
  };
  container.append = (...nodes) => {
    nativeAppend(...nodes);
    const canvas = nodes.find((node) => node instanceof HTMLCanvasElement);
    if (stage === 'renderer-state' && canvas) canvas.getContext('webgl2').viewport = () => { throw marker; };
    if (stage === 'camera-state') PerspectiveCamera.prototype.updateProjectionMatrix = () => { throw marker; };
  };
  WebGLRenderTarget.prototype.dispose = function () {
    pickerDisposals += 1; nativeTargetDispose.call(this);
    if (throwingCleanup) throw secondary;
  };
  try {
    try {
      result = createLyra3dViewport(container, {
        hover() {}, pick() {}, camera() {}, lost() {},
        rendering() {
          if (stage === 'host-rendering') {
            // Failure after an event schedules owned work must cancel that unreturned viewport too.
            container.querySelector('canvas').dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }));
            throw marker;
          }
        },
      });
    } catch (error) { caught = error; }
    const record = records.at(-1);
    if (!record) return { passed: false, skipped: 'Actual WebGL2 context unavailable for constructor cleanup' };
    if (!record.extension) return { passed: false, skipped: 'WEBGL_lose_context unavailable for constructor cleanup' };
    await settle();
    const methodsRestored = record.descriptors.every(([name, before]) => { const after = Object.getOwnPropertyDescriptor(record.gl, name); return before ? after?.value === before.value && after?.configurable === before.configurable && after?.writable === before.writable && after?.enumerable === before.enumerable : after === undefined; });
    return { passed: methodsRestored && caught === marker && container.querySelector('canvas') === null && record.canvas.isConnected === false &&
      record.listeners.size === 0 && record.gl.isContextLost() && (stage === 'renderer-name' ? nameFaultHits > 0 : pickerDisposals >= 1),
      stage, originalError: caught === marker, attached: record.canvas.isConnected,
      listeners: record.listeners.size, contextLost: record.gl.isContextLost(), pickerDisposals, nameFaultHits, methodsRestored };
  } finally {
    HTMLCanvasElement.prototype.getContext = nativeContext;
    PerspectiveCamera.prototype.updateProjectionMatrix = nativeCamera;
    WebGLRenderTarget.prototype.dispose = nativeTargetDispose;
    Reflect.deleteProperty(container, 'append');
    try { result?.dispose(); } catch { /* Continue releasing any native test contexts. */ }
    for (const record of records) {
      try { if (!record.gl.isContextLost()) record.extension?.loseContext(); } catch { /* Continue releasing the remaining contexts. */ }
      Reflect.deleteProperty(record.canvas, 'addEventListener'); Reflect.deleteProperty(record.canvas, 'removeEventListener');
      Reflect.deleteProperty(record.gl, 'getParameter'); Reflect.deleteProperty(record.gl, 'viewport');
      record.canvas.remove();
    }
    container.remove();
  }
}
for (const stage of ['renderer-name', 'renderer-state', 'camera-state', 'host-rendering']) {
  viewportCases[`viewport-constructor-${stage}-cleanup`] = () => constructorFailure(stage);
}
viewportCases['viewport-constructor-cleanup-preserves-original-error'] = () => constructorFailure('host-rendering', true);


viewportCases['viewport-resource-cache-context-epochs'] = async () => {
  cleanupViewport();
  const nativeContext = HTMLCanvasElement.prototype.getContext; const records = []; const seen = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const gl = nativeContext.apply(this, args); if (args[0] !== 'webgl2' || !gl || seen.has(gl)) return gl;
    seen.add(gl); const record = { gl, canvas: this, epoch: 0, staleDeletes: [], methods: [], wrappers: {} }; records.push(record);
    const onLoss = () => { if (gl.isContextLost()) record.epoch++; }; this.addEventListener('webglcontextlost', onLoss);
    record.removeLoss = () => this.removeEventListener('webglcontextlost', onLoss);
    // Record actual native calls below the viewport's context guard, never above its skip logic.
    for (const suffix of ['Buffer', 'Texture', 'Framebuffer', 'Renderbuffer', 'VertexArray', 'Program', 'Shader']) {
      const handles = new WeakMap();
      for (const operation of ['create', 'delete']) {
        const name = `${operation}${suffix}`; const original = gl[name]; const descriptor = Object.getOwnPropertyDescriptor(gl, name);
        const wrapped = function (...values) {
          if (operation === 'delete' && this === gl && !gl.isContextLost() && values[0] && handles.has(values[0]) && handles.get(values[0]) !== record.epoch) record.staleDeletes.push(suffix);
          const value = original.apply(this, values); if (operation === 'create' && this === gl && value) handles.set(value, record.epoch); return value;
        };
        gl[name] = wrapped; record.wrappers[name] = wrapped;
        record.methods.push(() => { if (descriptor) Object.defineProperty(gl, name, descriptor); else Reflect.deleteProperty(gl, name); });
      }
    }
    return gl;
  };
  let record; let owned;
  try { owned = mount(); record = records.find(value => value.gl === owned.viewport.renderer.getContext()); }
  finally { HTMLCanvasElement.prototype.getContext = nativeContext; }
  const { viewport, calls } = owned; const gl = viewport.renderer.getContext();
  const extension = gl.getExtension('WEBGL_lose_context'); if (!extension) { viewport.dispose(); for (const value of records) { value.removeLoss(); for (const restore of value.methods) restore(); } return { passed: false, skipped: 'WEBGL_lose_context unavailable' }; }
  let terminalTextureDisposals = 0; let textureEvents = 0; let geometryEvents = 0; let reentrant = false;
  class RetainedTexture extends DataTexture { dispose() { terminalTextureDisposals++; super.dispose(); } }
  const imageBytes = new Uint8Array([255, 0, 0, 255]);
  const geometry = new PlaneGeometry(100, 100); const texture = new RetainedTexture(imageBytes, 1, 1); texture.needsUpdate = true;
  texture.addEventListener('dispose', () => textureEvents++);
  geometry.addEventListener('dispose', () => { geometryEvents++; if (reentrant) viewport.dispose(); });
  const original = new MeshBasicMaterial({ map: texture }); const replacement = new MeshBasicMaterial({ color: new Color(0xffffff) });
  const mesh = new InstancedMesh(geometry, original, 1); mesh.setMatrixAt(0, new Matrix4()); viewport.world.add(mesh);
  const pickMaterial = createPickMaterial(); pickMaterial.color.setRGB(1 / 255, 0, 0); const pickMesh = new Mesh(geometry, pickMaterial); viewport.pickWorld.add(pickMesh);
  const picks = []; const pixels = [];
  try {
    viewport.renderNow(); picks.push(viewport.pickAt(240, 160));
    // The first material and its map have GPU bindings but are absent from the current scene.
    mesh.material = replacement; viewport.renderNow();
    for (let turn = 0; turn < 2; turn++) {
      extension.loseContext(); await settle(); if (!viewport.lost) throw new Error('Expected native context loss');
      await new Promise(resolve => setTimeout(resolve, 100)); extension.restoreContext();
      const deadline = performance.now() + 10000; while (calls.restored <= turn && performance.now() < deadline) await settle();
      if (calls.restored <= turn) throw new Error('Native restoration timed out');
      mesh.material = original; viewport.renderNow(); picks.push(viewport.pickAt(240, 160)); viewport.renderNow();
      const rgba = new Uint8Array(4); gl.readPixels(gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba); pixels.push(Array.from(rgba));
    }
    const cpuRetained = terminalTextureDisposals === 0 && textureEvents === 0 && geometryEvents === 0 && texture.image.data === imageBytes;
    mesh.removeFromParent(); pickMesh.removeFromParent(); mesh.dispose(); original.dispose(); replacement.dispose(); texture.dispose(); pickMaterial.dispose();
    geometry.dispose(); reentrant = true; geometry.dispose(); viewport.dispose();
    const methodsRestored = Object.entries(record.wrappers).every(([name, wrapped]) => gl[name] === wrapped);
    return { passed: cpuRetained && methodsRestored && calls.restored === 2 && picks.every(value => value === 0) && pixels.every(value => value[0] > 200 && value[1] < 10 && value[2] < 10) && record.staleDeletes.length === 0 && gl.isContextLost(), picks, pixels, staleDeletes: record.staleDeletes, restored: calls.restored, cpuRetained, methodsRestored };
  } finally {
    mesh.removeFromParent(); pickMesh.removeFromParent(); mesh.dispose(); original.dispose(); replacement.dispose(); texture.dispose(); pickMaterial.dispose(); geometry.dispose(); viewport.dispose();
    for (const value of records) { value.removeLoss(); for (const restore of value.methods) restore(); if (!value.gl.isContextLost()) value.gl.getExtension('WEBGL_lose_context')?.loseContext(); }
  }
};
