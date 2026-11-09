import assert from 'node:assert/strict';
import { createSceneBridge } from '../src/scene/bridge.mjs';
import { createSceneBridgeGl } from './fixtures/scene-bridge-gl.mjs';

export const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
export const frozen = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
};
export const marker = (id = 'anchor', change = {}) => ({ id, position: { lngLat: [0, 0], altitude: 7, altitudeReference: 'terrain' },
  acceptedPositionRevision: 1, radiusCss: 6, rgba: [0.2, 0.4, 0.8, 0.5], ...change });
export const packet = (change = {}) => frozen({ acceptedSceneRevision: 1, presentationRevision: 1,
  allocation: { revision: 1, width: 640, height: 480, pixelRatio: 1, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  reducedMotion: true, markers: [marker()], ...change });
export const absolute = (id = 'anchor', change = {}) => marker(id, { position: { lngLat: [0, 0], altitude: 7, altitudeReference: 'sea-level' }, ...change });
export const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

export function events() {
  const listeners = new Map();
  return {
    add(name, callback, capture = false) { if (!listeners.has(name)) listeners.set(name, new Map()); listeners.get(name).set(callback, capture); },
    remove(name, callback) { listeners.get(name)?.delete(callback); },
    emit(name, value = {}) {
      const ordered = [...listeners.get(name) ?? []].sort((left, right) => Number(right[1]) - Number(left[1]));
      for (const [callback] of ordered) callback({ type: name, ...value });
    },
    count(name) { return name ? listeners.get(name)?.size ?? 0 : [...listeners.values()].reduce((count, values) => count + values.size, 0); }
  };
}

export function fixture(options = {}) {
  const gpu = createSceneBridgeGl(options), { gl } = gpu, nativeEvents = events(), canvasEvents = events();
  const controller = new AbortController(), layers = new Map(), inputListeners = new Set();
  const calls = { prepare: [], add: [], remove: [], repaint: 0, capture: 0, subscribe: 0, unsubscribe: 0 };
  const states = [], errors = [], order = [];
  let input = options.input ?? packet(), current = true, styleReady = true, callbackDepth = 0, bridge;
  let center = { lng: 0, lat: 0 }, zoom = 0, terrain = { source: 'dem', exaggeration: 1 }, projection = { type: 'mercator' };
  const controls = { onCapture: undefined, onPrepare: undefined, onAdd: undefined, onState: undefined, onError: undefined };
  gl.canvas.addEventListener = (name, callback, options) => canvasEvents.add(name, callback, options === true || Boolean(options?.capture));
  gl.canvas.removeEventListener = (name, callback) => canvasEvents.remove(name, callback);
  const map = {
    getCanvas: () => gl.canvas,
    getLayer: id => layers.get(id)?.handle,
    getCenter: () => ({ ...center }), getZoom: () => zoom, getPitch: () => 0, getBearing: () => 0,
    getTerrain: () => terrain, getProjection: () => projection,
    isStyleLoaded: () => styleReady,
    prepareFeatures(...args) { calls.prepare.push(args); return controls.onPrepare?.(...args) ?? Promise.resolve(); },
    addLayer(layer, before) {
      assert.equal(layers.has(layer.id), false, 'never overwrite an installed layer');
      const handle = Object.freeze({ id: layer.id });
      layers.set(layer.id, { layer, handle }); calls.add.push({ layer, before, handle });
      layer.onAdd?.(map, gl); controls.onAdd?.(layer);
    },
    removeLayer(id) {
      assert.equal(callbackDepth, 0, 'native removal waits for callback exit');
      const installed = layers.get(id); layers.delete(id); calls.remove.push(id);
      installed?.layer?.onRemove?.(map, gl);
    },
    triggerRepaint() { calls.repaint++; },
    on(name, callback) { nativeEvents.add(name, callback); return map; },
    off(name, callback) { nativeEvents.remove(name, callback); return map; }
  };
  const host = {
    signal: controller.signal,
    isCurrent: () => current,
    subscribeRenderInput(callback) {
      order.push('subscribe'); calls.subscribe++; inputListeners.add(callback); let released = false;
      return () => { assert.equal(released, false, 'release the input subscription once'); released = true; calls.unsubscribe++; inputListeners.delete(callback); };
    },
    captureRenderInput() { order.push('capture'); calls.capture++; controls.onCapture?.(); return input; },
    onState(value) { states.push(value); controls.onState?.(value); },
    onError(code) { errors.push(code); controls.onError?.(code); }
  };
  const args = {
    shaderData: { variantName: 'mercator', define: '#define PROJECTION_MERCATOR',
      vertexShaderPrelude: 'vec4 projectTileFor3D(vec2 p, float z) { return u_projection_fallback_matrix * vec4(p, z, 1.0); }' },
    getProjectionData({ tileID }) {
      const size = 2 ** tileID.canonical.z;
      return {
        mainMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        fallbackMatrix: [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 1 / 1000, 0, -1, 1, 0, 1],
        tileMercatorCoords: [tileID.canonical.x / size, tileID.canonical.y / size, 1 / (8192 * size), 1 / (8192 * size)],
        clippingPlane: [0, 0, 1, -1 / 3], projectionTransition: 0
      };
    },
    renderTerrainHeightMap(target) { return gpu.renderTerrainHeightMap(target); }
  };
  async function callback(method = 'render', selected = [...layers.values()].map(value => value.layer)) {
    for (const layer of selected) {
      if (typeof layer?.[method] !== 'function') continue;
      callbackDepth++;
      try { assert.doesNotThrow(() => layer[method](gl, args), 'native callbacks isolate application failures'); }
      finally { callbackDepth--; }
    }
    await flush();
  }
  const item = { gpu, gl, map, host, args, calls, states, errors, layers, controls, nativeEvents, canvasEvents, controller, order,
    get bridge() { return bridge; }, get input() { return input; },
    start() { bridge = createSceneBridge(map, host); return bridge; },
    async ready() { await flush(); },
    callback,
    async frames(count = 4) { for (let index = 0; index < count; index++) { await callback('prerender'); await callback(); } },
    replace(value) { input = value; for (const callback of [...inputListeners]) callback(); },
    expire() { current = false; },
    style(value) { styleReady = value; },
    view(value = {}) { center = value.center ?? center; zoom = value.zoom ?? zoom; projection = value.projection ?? projection; nativeEvents.emit('move'); },
    terrain(value) { terrain = value; nativeEvents.emit('terrain'); },
    async replaceStyle() {
      bridge.invalidateStyle(); styleReady = false;
      for (const [id, installed] of [...layers]) { layers.delete(id); installed.layer?.onRemove?.(map, gl); }
      styleReady = true; nativeEvents.emit('style.load'); await flush();
    },
    loss() { gpu.lose(); canvasEvents.emit('webglcontextlost', { preventDefault() {} }); },
    restore() { gpu.restore(); canvasEvents.emit('webglcontextrestored'); },
    stop() { bridge?.dispose(); }
  };
  return item;
}

export const ownedLive = (item, kind) => [...item.gpu.created].filter(handle => handle.kind === kind && !item.gpu.deleted.has(handle));
export const callsNamed = (item, name) => item.gpu.calls.filter(call => call[0] === name);
export const hasUniform = (draw, expected) => Object.values(draw.uniforms).some(value => value.length === expected.length && value.every((part, index) => Math.abs(part - expected[index]) < 1e-6));
export const sampleCalls = item => callsNamed(item, 'renderTerrainHeightMap').length;
export const stateValue = (draw, name) => draw.state.values.find(([key]) => key === name)?.[1];
export const latest = item => item.states.at(-1);
export const refusalCount = item => item.errors.length + item.states.filter(value => value.state === 'unavailable' && value.code).length;
export function sanitized(item) {
  assert.ok(item.errors.every(code => ['engine', 'limit', 'render', 'context-lost'].includes(code)));
  for (const value of item.states) {
    assert.ok(['pending', 'installed', 'empty', 'unavailable'].includes(value.state));
    assert.deepEqual(Object.keys(value).sort(), ['acceptedSceneRevision', 'allocationRevision', 'markerInstallationRevision', 'presentationRevision', 'state',
      ...Object.hasOwn(value, 'code') ? ['code'] : []].sort());
    assert.ok(Number.isSafeInteger(value.markerInstallationRevision) && value.markerInstallationRevision >= 0);
  }
}

