import assert from 'node:assert/strict';
import test from 'node:test';
import { createSceneBridge } from '../src/scene/bridge.mjs';
import { createSceneBridgeGl } from './fixtures/scene-bridge-gl.mjs';

const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
const frozen = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
};
const marker = (id = 'anchor', change = {}) => ({ id, position: { lngLat: [0, 0], altitude: 7, altitudeReference: 'terrain' },
  acceptedPositionRevision: 1, radiusCss: 6, rgba: [0.2, 0.4, 0.8, 0.5], ...change });
const packet = (change = {}) => frozen({ acceptedSceneRevision: 1, presentationRevision: 1,
  allocation: { revision: 1, width: 640, height: 480, pixelRatio: 1, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  reducedMotion: true, markers: [marker()], ...change });
const absolute = (id = 'anchor', change = {}) => marker(id, { position: { lngLat: [0, 0], altitude: 7, altitudeReference: 'sea-level' }, ...change });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function events() {
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

function fixture(options = {}) {
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

const ownedLive = (item, kind) => [...item.gpu.created].filter(handle => handle.kind === kind && !item.gpu.deleted.has(handle));
const callsNamed = (item, name) => item.gpu.calls.filter(call => call[0] === name);
const hasUniform = (draw, expected) => Object.values(draw.uniforms).some(value => value.length === expected.length && value.every((part, index) => Math.abs(part - expected[index]) < 1e-6));
const sampleCalls = item => callsNamed(item, 'renderTerrainHeightMap').length;
const stateValue = (draw, name) => draw.state.values.find(([key]) => key === name)?.[1];
const latest = item => item.states.at(-1);
const refusalCount = item => item.errors.length + item.states.filter(value => value.state === 'unavailable' && value.code).length;
function sanitized(item) {
  assert.ok(item.errors.every(code => ['engine', 'limit', 'render', 'context-lost'].includes(code)));
  for (const value of item.states) {
    assert.ok(['pending', 'installed', 'empty', 'unavailable'].includes(value.state));
    assert.deepEqual(Object.keys(value).sort(), ['acceptedSceneRevision', 'allocationRevision', 'markerInstallationRevision', 'presentationRevision', 'state',
      ...Object.hasOwn(value, 'code') ? ['code'] : []].sort());
    assert.ok(Number.isSafeInteger(value.markerInstallationRevision) && value.markerInstallationRevision >= 0);
  }
}

test('bridge subscribes before capture, exposes only lifecycle methods and keeps empty input resource-free', async () => {
  const item = fixture({ input: packet({ markers: [] }) }), bridge = item.start(); await item.ready();
  assert.deepEqual(Object.keys(bridge).sort(), ['dispose', 'invalidateStyle', 'requestFrame', 'setVisible']);
  assert.deepEqual(item.order.slice(0, 2), ['subscribe', 'capture']); assert.equal(item.calls.subscribe, 1);
  assert.equal(item.calls.add.length, 0); assert.equal(item.gpu.created.size, 0);
  assert.equal(latest(item).state, 'empty'); assert.equal(latest(item).markerInstallationRevision, 0);
  sanitized(item); bridge.dispose(); bridge.dispose(); assert.equal(item.calls.unsubscribe, 1);
});

test('missing allocation does not prepare, install, sample or draw a fabricated viewport', async () => {
  const item = fixture({ input: packet({ allocation: undefined }) }); item.start(); await item.ready(); await item.frames();
  assert.equal(item.calls.prepare.length, 0); assert.equal(item.calls.add.length, 0); assert.equal(item.gpu.created.size, 0);
  assert.equal(item.gpu.draws.length, 0); assert.equal(latest(item).allocationRevision, undefined);
  assert.equal(latest(item).markerInstallationRevision, 0); item.stop();
});

test('current absolute marker installs once, draws a premultiplied circle packet and restores native state', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.gpu.enabled.delete(item.gl.BLEND);
  const before = item.gpu.snapshot(); item.start(); await item.ready(); await item.frames(2);
  assert.equal(item.calls.add.length, 1); assert.ok(item.gpu.draws.length > 0); assert.equal(sampleCalls(item), 0);
  for (const draw of item.gpu.draws) {
    assert.deepEqual([draw.mode, draw.first, draw.count], [item.gl.TRIANGLE_STRIP, 0, 4]);
    assert.equal(item.gpu.created.has(draw.vao), true); assert.equal(draw.vao.kind, 'VertexArray');
    assert.equal(item.gpu.created.has(draw.program), true); assert.equal(draw.program.kind, 'Program');
    assert.ok(hasUniform(draw, [4096, 4096, 7]));
    assert.ok(hasUniform(draw, [2 * 6 / 640, 2 * 6 / 480]));
    // The packet keeps unpremultiplied input; the shader applies alpha and edge coverage once.
    assert.ok(hasUniform(draw, [0.2, 0.4, 0.8, 0.5]));
    assert.equal(stateValue(draw, 'DEPTH_WRITEMASK'), false); assert.equal(draw.enabled.includes(item.gl.DEPTH_TEST), true);
    assert.equal(draw.enabled.includes(item.gl.BLEND), true);
    assert.equal(draw.enabled.includes(item.gl.SCISSOR_TEST), before.enabled.includes(item.gl.SCISSOR_TEST));
    for (const name of ['DEPTH_FUNC', 'DEPTH_RANGE', 'DRAW_FRAMEBUFFER_BINDING', 'READ_FRAMEBUFFER_BINDING']) {
      assert.deepEqual(stateValue(draw, name), stateValue({ state: before }, name));
    }
    for (const name of ['STENCIL_TEST', 'CULL_FACE', 'RASTERIZER_DISCARD', 'SAMPLE_COVERAGE', 'SAMPLE_ALPHA_TO_COVERAGE', 'POLYGON_OFFSET_FILL']) assert.equal(draw.enabled.includes(item.gl[name]), false);
    assert.equal(stateValue(draw, 'BLEND_EQUATION_RGB'), item.gl.FUNC_ADD); assert.equal(stateValue(draw, 'BLEND_EQUATION_ALPHA'), item.gl.FUNC_ADD);
    assert.equal(stateValue(draw, 'BLEND_SRC_RGB'), item.gl.ONE); assert.equal(stateValue(draw, 'BLEND_DST_RGB'), item.gl.ONE_MINUS_SRC_ALPHA);
    assert.equal(stateValue(draw, 'BLEND_SRC_ALPHA'), item.gl.ONE); assert.equal(stateValue(draw, 'BLEND_DST_ALPHA'), item.gl.ONE_MINUS_SRC_ALPHA);
    assert.deepEqual(stateValue(draw, 'COLOR_WRITEMASK'), [true, true, true, true]);
    assert.deepEqual(stateValue(draw, 'VIEWPORT'), stateValue({ state: before }, 'VIEWPORT'));
    assert.deepEqual(stateValue(draw, 'SCISSOR_BOX'), stateValue({ state: before }, 'SCISSOR_BOX'));
  }
  assert.deepEqual(item.gpu.snapshot(), before); sanitized(item);
  assert.ok([...item.gpu.created].every(value => ['Program', 'Shader', 'VertexArray'].includes(value.kind)));
  for (const name of ['bufferData', 'bufferSubData', 'bindTexture', 'bindSampler', 'pixelStorei', 'bindFramebuffer',
    'framebufferTexture2D', 'clear', 'getIndexedParameter', 'bindBufferBase', 'bindBufferRange']) assert.equal(callsNamed(item, name).length, 0);
  assert.equal(latest(item).state, 'installed'); assert.ok(latest(item).markerInstallationRevision > 0);
  item.stop(); assert.equal(ownedLive(item, 'Program').length + ownedLive(item, 'Shader').length + ownedLive(item, 'VertexArray').length, 0);
});

test('shared current-stamp terrain height resolves duplicate demands and adds each authored offset once', async () => {
  const item = fixture({ input: packet({ markers: [marker('first'), marker('second', { position: { lngLat: [0, 0], altitude: -3, altitudeReference: 'terrain' } })] }) });
  item.gpu.setCoverage(125, 1); item.start(); await item.ready(); await item.frames();
  assert.equal(sampleCalls(item), 1); assert.ok(item.gpu.draws.some(draw => hasUniform(draw, [4096, 4096, 132])));
  assert.ok(item.gpu.draws.some(draw => hasUniform(draw, [4096, 4096, 122])));
  const samples = sampleCalls(item); await item.frames(3); assert.equal(sampleCalls(item), samples);
  assert.equal(ownedLive(item, 'Buffer').length, 1); assert.equal(ownedLive(item, 'Texture').length, 2); item.stop();
});

for (const [height, alpha, draws] of [[0, 1, true], [0, 0, false]]) {
  test(`terrain coverage ${alpha} at height zero ${draws ? 'resolves a real zero' : 'stays pending without fallback or endless resampling'}`, async () => {
    const item = fixture(); item.gpu.setCoverage(height, alpha); item.start(); await item.ready(); await item.frames(5);
    assert.equal(sampleCalls(item), 1); assert.equal(item.gpu.draws.length > 0, draws);
    if (draws) assert.ok(item.gpu.draws.every(draw => hasUniform(draw, [4096, 4096, 7])));
    item.stop();
  });
}

test('missing native height capability leaves terrain pending without drawing at authored offset alone', async () => {
  const item = fixture(); delete item.args.renderTerrainHeightMap; item.start(); await item.ready(); await item.frames();
  assert.equal(sampleCalls(item), 0); assert.equal(item.gpu.draws.length, 0); sanitized(item); item.stop();
});

test('unsignaled terrain fence never reads the PBO or publishes marker geometry', async () => {
  const item = fixture(); item.gpu.setFenceStatus(item.gl.TIMEOUT_EXPIRED); item.start(); await item.ready(); await item.frames(3);
  assert.equal(sampleCalls(item), 1); assert.equal(callsNamed(item, 'getBufferSubData').length, 0); assert.equal(item.gpu.draws.length, 0);
  item.gpu.setFenceStatus(undefined); await item.frames(2);
  assert.equal(callsNamed(item, 'getBufferSubData').length, 1); assert.ok(item.gpu.draws.length > 0); item.stop();
});

test('theme-only packet replaces color without changing accepted position or resampling the terrain', async () => {
  const item = fixture(); item.start(); await item.ready(); await item.frames(); const samples = sampleCalls(item);
  item.replace(packet({ presentationRevision: 2, markers: [marker('anchor', { rgba: [0.8, 0.3, 0.1, 0.25] })] })); await item.ready();
  item.gpu.draws.length = 0; await item.frames(2);
  assert.equal(sampleCalls(item), samples); assert.ok(item.gpu.draws.length > 0);
  assert.ok(item.gpu.draws.every(draw => hasUniform(draw, [0.8, 0.3, 0.1, 0.25])));
  assert.equal(latest(item).acceptedSceneRevision, 1); assert.equal(latest(item).presentationRevision, 2); item.stop();
});

test('offset replacement reuses the same current terrain sample and installs only the new position revision', async () => {
  const item = fixture(); item.start(); await item.ready(); await item.frames(); const samples = sampleCalls(item);
  item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2,
    markers: [marker('anchor', { acceptedPositionRevision: 2, position: { lngLat: [0, 0], altitude: 19, altitudeReference: 'terrain' } })] }));
  await item.ready(); item.gpu.draws.length = 0; await item.frames(2);
  assert.equal(sampleCalls(item), samples); assert.ok(item.gpu.draws.length > 0);
  assert.ok(item.gpu.draws.every(draw => hasUniform(draw, [4096, 4096, 119])));
  assert.equal(latest(item).acceptedSceneRevision, 2); item.stop();
});

for (const name of ['move', 'resize', 'terrain', 'projectiontransition', 'sourcedata']) {
  test(`native ${name} invalidates current terrain before a new result can draw`, async () => {
    const item = fixture(); item.start(); await item.ready(); await item.frames(); const samples = sampleCalls(item);
    item.gpu.draws.length = 0; item.gpu.setCoverage(250, 1);
    item.nativeEvents.emit(name, name === 'sourcedata' ? { sourceId: 'dem', sourceDataType: 'content', isSourceLoaded: true } : {});
    await item.callback(); assert.equal(item.gpu.draws.length, 0);
    await item.frames(); assert.equal(sampleCalls(item), samples + 1);
    assert.ok(item.gpu.draws.some(draw => hasUniform(draw, [4096, 4096, 257]))); item.stop();
  });
}

test('unrelated source, styledata and no-op native repaints do not self-invalidate completed terrain', async () => {
  const item = fixture(); item.start(); await item.ready(); await item.frames(); const samples = sampleCalls(item), installed = item.calls.add.length;
  item.nativeEvents.emit('sourcedata', { sourceId: 'labels', sourceDataType: 'content' }); item.nativeEvents.emit('styledata');
  await item.frames(); assert.equal(sampleCalls(item), samples); assert.equal(item.calls.add.length, installed); item.stop();
});

test('hidden ownership suppresses native sampling, drawing and repaint requests until shown', async () => {
  const item = fixture(); item.start(); await item.ready(); item.bridge.setVisible(false); await item.ready();
  const repaint = item.calls.repaint; item.bridge.requestFrame(); item.bridge.requestFrame(); await item.frames(3);
  assert.equal(item.calls.repaint, repaint); assert.equal(sampleCalls(item), 0); assert.equal(item.gpu.draws.length, 0);
  item.bridge.setVisible(true); await item.ready(); assert.ok(item.calls.repaint > repaint); await item.frames();
  assert.ok(item.gpu.draws.length > 0); item.stop();
});

test('repaint requests coalesce and become inert after exact installation currency expires', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.start(); await item.ready(); await item.frames(1);
  const before = item.calls.repaint; for (let index = 0; index < 12; index++) item.bridge.requestFrame(); await item.ready();
  assert.ok(item.calls.repaint - before <= 1); item.expire(); const expired = item.calls.repaint;
  item.bridge.requestFrame(); item.nativeEvents.emit('move'); await item.ready(); item.gpu.draws.length = 0; await item.frames(1);
  assert.equal(item.calls.repaint, expired); assert.equal(item.gpu.draws.length, 0); item.stop();
});

test('late preparation cannot install a packet replaced by empty accepted input', async () => {
  const item = fixture(), pending = deferred(); item.controls.onPrepare = () => pending.promise;
  item.start(); await item.ready(); assert.ok(item.calls.prepare.length > 0);
  item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2, markers: [] })); pending.resolve(); await item.ready();
  assert.equal(item.calls.add.length, 0); assert.equal(latest(item).state, 'empty'); assert.equal(latest(item).acceptedSceneRevision, 2);
  assert.equal(item.gpu.created.size, 0); item.stop();
});

test('status callback replacement cannot be overwritten by the stale packet after reentry', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); let replaced = false;
  item.controls.onState = value => {
    if (replaced || value.state !== 'installed') return;
    replaced = true; item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2, markers: [] }));
  };
  item.start(); await item.ready(); await item.frames(); assert.equal(replaced, true);
  assert.equal(latest(item).acceptedSceneRevision, 2); assert.equal(latest(item).state, 'empty');
  const firstNew = item.states.findIndex(value => value.acceptedSceneRevision === 2);
  assert.ok(item.states.slice(firstNew).every(value => value.acceptedSceneRevision === 2)); item.stop();
});

test('foreign native layer replacement is not removed or reused by bridge disposal', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.start(); await item.ready(); await item.frames(1);
  const installed = item.calls.add[0], foreign = Object.freeze({ id: installed.layer.id, foreign: true });
  item.layers.set(installed.layer.id, { handle: foreign }); const removes = item.calls.remove.length; item.stop();
  assert.equal(item.map.getLayer(installed.layer.id), foreign); assert.equal(item.calls.remove.length, removes);
});

test('input replacement after foreign native takeover cannot advance owned installation or publish installed', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.start(); await item.ready(); await item.frames(1);
  const installed = item.calls.add[0], foreign = Object.freeze({ id: installed.layer.id, foreign: true });
  const boundary = item.states.length, revision = latest(item).markerInstallationRevision, removes = item.calls.remove.length;
  item.layers.set(installed.layer.id, { handle: foreign });
  item.replace(packet({ presentationRevision: 2, markers: [absolute('anchor', { rgba: [0.8, 0.3, 0.1, 0.25] })] }));
  await item.ready();
  assert.equal(item.states.slice(boundary).some(value => value.state === 'installed'), false);
  assert.ok(item.states.slice(boundary).every(value => value.markerInstallationRevision <= revision));
  assert.equal(item.calls.add.length, 1); assert.equal(item.calls.remove.length, removes);
  assert.equal(item.map.getLayer(installed.layer.id), foreign); item.stop();
  assert.equal(item.map.getLayer(installed.layer.id), foreign);
});

test('style replacement creates a fresh layer epoch and cannot reuse stale terrain results', async () => {
  const item = fixture(); item.start(); await item.ready(); await item.frames(); const old = item.calls.add[0].layer;
  await item.replaceStyle(); item.gpu.setCoverage(250, 1); item.gpu.draws.length = 0;
  await item.callback('render', [old]); assert.equal(item.gpu.draws.length, 0);
  await item.frames(); assert.equal(item.calls.add.length, 2); assert.notEqual(item.calls.add[1].layer, old);
  assert.ok(item.gpu.draws.some(draw => hasUniform(draw, [4096, 4096, 257]))); item.stop();
});

test('style load before source readiness waits for a native render before installing the replacement', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.start(); await item.ready(); await item.frames(1);
  const old = item.calls.add[0].layer, revision = latest(item).markerInstallationRevision;
  item.bridge.invalidateStyle(); item.style(false); item.nativeEvents.emit('style.load'); await item.ready();
  const draws = item.gpu.draws.length;
  for (let index = 0; index < 3; index++) { item.nativeEvents.emit('render'); await item.ready(); }
  assert.equal(item.calls.add.length, 1); assert.equal(latest(item).markerInstallationRevision, revision);
  await item.callback('render', [old]); assert.equal(item.gpu.draws.length, draws);
  item.style(true); for (let index = 0; index < 3; index++) item.nativeEvents.emit('render'); await item.ready();
  assert.equal(item.calls.add.length, 2, 'fully loaded native render resumes the pending style installation once');
  assert.notEqual(item.calls.add[1].layer, old); assert.ok(latest(item).markerInstallationRevision > revision);
  await item.frames(1); assert.ok(item.gpu.draws.length > draws); assert.deepEqual(item.errors, []); item.stop();
});

test('first installation resumes from style readiness with only the latest accepted input', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.style(false); item.start(); await item.ready();
  assert.equal(item.calls.add.length, 0); assert.equal(item.gpu.created.size, 0);
  item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2,
    markers: [absolute('latest', { rgba: [0.8, 0.3, 0.1, 0.25] })] })); await item.ready();
  item.style(true); item.nativeEvents.emit('render'); await item.ready(); await item.frames(1);
  assert.equal(item.calls.add.length, 1, 'initial source readiness resumes installation');
  assert.equal(latest(item).state, 'installed'); assert.equal(latest(item).acceptedSceneRevision, 2);
  assert.ok(item.gpu.draws.length > 0); assert.ok(item.gpu.draws.every(draw => hasUniform(draw, [0.8, 0.3, 0.1, 0.25])));
  assert.deepEqual(item.errors, []); item.stop();
});

test('native readiness wakes coalesce without replacing an in-flight feature preparation', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }), pending = deferred();
  item.style(false); item.start(); await item.ready(); item.controls.onPrepare = () => pending.promise;
  item.style(true); item.nativeEvents.emit('render'); await item.ready();
  assert.equal(item.calls.prepare.length, 1, 'readiness starts one feature preparation');
  for (let index = 0; index < 3; index++) { item.nativeEvents.emit('render'); await item.ready(); }
  assert.equal(item.calls.prepare.length, 1); assert.equal(item.calls.add.length, 0);
  pending.resolve(); await item.ready(); assert.equal(item.calls.add.length, 1);
  const revision = latest(item).markerInstallationRevision;
  for (let index = 0; index < 3; index++) { item.nativeEvents.emit('render'); await item.ready(); }
  assert.equal(item.calls.prepare.length, 1); assert.equal(latest(item).markerInstallationRevision, revision); item.stop();
});

test('readiness wake cannot cross a new style barrier or a disposed bridge', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.style(false); item.start(); await item.ready();
  item.bridge.invalidateStyle(); item.style(true); item.nativeEvents.emit('render'); await item.ready();
  assert.equal(item.calls.prepare.length, 0); assert.equal(item.calls.add.length, 0);
  item.nativeEvents.emit('style.load'); await item.ready(); assert.equal(item.calls.add.length, 1);
  item.bridge.invalidateStyle(); item.style(false); item.nativeEvents.emit('style.load'); await item.ready(); item.stop();
  item.style(true); item.nativeEvents.emit('render'); item.nativeEvents.emit('style.load'); await item.ready();
  assert.equal(item.calls.add.length, 1); assert.equal(item.nativeEvents.count(), 0); assert.equal(item.calls.unsubscribe, 1);
});

test('same-style source loading cannot retire a committed layer or its glyph resources', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.start(); await item.ready(); await item.frames(1);
  const installed = item.calls.add[0], revision = latest(item).markerInstallationRevision;
  const programs = ownedLive(item, 'Program'), resources = item.gpu.created.size;
  item.style(false); item.nativeEvents.emit('sourcedata', { sourceId: 'labels', sourceDataType: 'content' });
  await item.frames(1);
  assert.equal(item.map.getLayer(installed.layer.id), installed.handle, 'full source readiness is not committed style identity');
  assert.equal(item.calls.remove.length, 0); assert.ok(programs.every(program => !item.gpu.deleted.has(program)));
  const draws = item.gpu.draws.length;
  item.style(true); item.nativeEvents.emit('render'); await item.ready(); await item.frames(1);
  assert.ok(item.gpu.draws.length > draws); assert.equal(item.calls.add.length, 1); assert.equal(item.gpu.created.size, resources);
  assert.equal(latest(item).markerInstallationRevision, revision); assert.deepEqual(item.errors, []); item.stop();
});

for (const replaceInput of [false, true]) {
  test(`readiness interruption during held preparation preserves ${replaceInput ? 'replacement' : 'original'} startup intent`, async () => {
    const item = fixture({ input: packet({ markers: [absolute()] }) }), pending = deferred();
    item.controls.onPrepare = () => pending.promise; item.start(); await item.ready();
    assert.equal(item.calls.prepare.length, 1); item.style(false);
    if (replaceInput) {
      item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2,
        markers: [absolute('latest', { rgba: [0.8, 0.3, 0.1, 0.25] })] })); await item.ready();
    }
    pending.resolve(); await item.ready();
    assert.equal(item.calls.add.length, 0, 'startup remains pending while full native readiness is false');
    assert.equal(item.gpu.created.size, 0);
    item.style(true); item.nativeEvents.emit('render'); await item.ready(); await item.frames(1);
    assert.equal(item.calls.add.length, 1, 'a later ready render resumes the latest startup intent');
    assert.equal(latest(item).state, 'installed'); assert.equal(latest(item).acceptedSceneRevision, replaceInput ? 2 : 1);
    assert.ok(item.gpu.draws.length > 0);
    const color = replaceInput ? [0.8, 0.3, 0.1, 0.25] : [0.2, 0.4, 0.8, 0.5];
    assert.ok(item.gpu.draws.every(draw => hasUniform(draw, color))); assert.deepEqual(item.errors, []); item.stop();
  });
}

for (const pixelRatio of [1, 1.25, 2]) {
  test(`CSS radius has the same clip offsets at pixel ratio ${pixelRatio} without point-size clamping`, async () => {
    const input = packet({ allocation: { revision: 1, width: 640, height: 480, pixelRatio, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      markers: [absolute('anchor', { radiusCss: 123 })] });
    const item = fixture({ pixelRatio, input }); item.start(); await item.ready(); await item.frames(1);
    assert.ok(item.gpu.draws.length > 0); assert.ok(item.gpu.draws.every(draw => hasUniform(draw, [246 / 640, 246 / 480])));
    assert.equal(item.gpu.calls.some(call => call[0] === 'getParameter' && call[1] === 'ALIASED_POINT_SIZE_RANGE'), false); item.stop();
  });
}

for (const change of ['viewport', 'depth-function', 'depth-range']) {
  test(`unsupported entry ${change} refuses glyph drawing without modifying native policy`, async () => {
    const item = fixture({ input: packet({ markers: [absolute()] }) });
    if (change === 'viewport') item.gpu.state.set('VIEWPORT', [0, 0, 320, 480]);
    if (change === 'depth-function') item.gpu.state.set('DEPTH_FUNC', 'GEQUAL');
    if (change === 'depth-range') item.gpu.state.set('DEPTH_RANGE', [1, 0]);
    const before = item.gpu.snapshot(); item.start(); await item.ready(); await item.frames(2);
    assert.equal(item.gpu.draws.length, 0); assert.deepEqual(item.gpu.snapshot(), before); sanitized(item);
    assert.ok(refusalCount(item) > 0, 'unsupported target is an explicit sanitized refusal'); item.stop();
  });
}

test('transparent markers do not submit glyph draws', async () => {
  const item = fixture({ input: packet({ markers: [absolute('anchor', { rgba: [0.5, 0.25, 0.75, 0] })] }) });
  item.start(); await item.ready(); await item.frames(2); assert.equal(item.gpu.draws.length, 0); item.stop();
});

test('derived radius overflow refuses drawing rather than clamping or publishing a finite substitute', async () => {
  const item = fixture({ input: packet({ markers: [absolute('anchor', { radiusCss: Number.MAX_VALUE })] }) });
  item.start(); await item.ready(); await item.frames(2); assert.equal(item.gpu.draws.length, 0); sanitized(item);
  assert.ok(refusalCount(item) > 0, 'numeric refusal is observable'); item.stop();
});

test('semitransparent glyphs draw far-to-near with stable accepted order for equal projected depth', async () => {
  const color = index => [index / 10, 0.25, 0.5, 0.5];
  const item = fixture({ input: packet({ markers: [absolute('near', { rgba: color(1), position: { lngLat: [0, 0], altitude: 10 } }),
    absolute('far-a', { rgba: color(2), position: { lngLat: [0, 0], altitude: 300 } }),
    absolute('far-b', { rgba: color(3), position: { lngLat: [0, 0], altitude: 300 } })] }) });
  const originalProjection = item.args.getProjectionData; let changed = false;
  item.args.getProjectionData = request => {
    const result = originalProjection(request);
    // Z/W = 0.5 / (1 + altitude/1000): increasing height moves toward the near plane.
    if (!changed) result.fallbackMatrix = [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 0, 1 / 1000, -1, 1, 0.5, 1];
    return result;
  };
  item.start(); await item.ready(); await item.callback(); assert.equal(item.gpu.draws.length, 3);
  for (const [index, expected] of [1, 2, 3].entries()) assert.ok(hasUniform(item.gpu.draws[index], color(expected)));
  changed = true; item.gpu.draws.length = 0; await item.callback(); assert.equal(item.gpu.draws.length, 3);
  for (const [index, expected] of [2, 3, 1].entries()) assert.ok(hasUniform(item.gpu.draws[index], color(expected)));
  item.stop();
});

test('different origins share one glyph program and VAO when exact native shader sources match', async () => {
  const item = fixture({ input: packet({ markers: [absolute('west', { position: { lngLat: [-100, 0], altitude: 0 } }),
    absolute('east', { position: { lngLat: [100, 0], altitude: 0 } })] }) });
  item.view({ zoom: 3 }); item.start(); await item.ready(); await item.frames(2);
  assert.ok(item.gpu.draws.length >= 2); assert.equal(callsNamed(item, 'createProgram').length, 1);
  assert.equal(callsNamed(item, 'createShader').length, 2); assert.equal(callsNamed(item, 'createVertexArray').length, 1); item.stop();
});

test('changed native shader sources replace one program only after bounded candidate construction', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); let maximum = 0;
  item.gpu.afterCall = () => { maximum = Math.max(maximum, ownedLive(item, 'Program').length + ownedLive(item, 'Shader').length + ownedLive(item, 'VertexArray').length); };
  item.start(); await item.ready(); await item.frames(1);
  item.args.shaderData = { ...item.args.shaderData, vertexShaderPrelude: `${item.args.shaderData.vertexShaderPrelude}\n// Alternate native source.` };
  await item.frames(1); assert.equal(callsNamed(item, 'createProgram').length, 2);
  assert.ok(maximum <= 7); assert.equal(ownedLive(item, 'Program').length, 1); assert.equal(ownedLive(item, 'Shader').length, 2); item.stop();
});

for (const method of ['createShader', 'compileShader', 'createProgram', 'linkProgram', 'createVertexArray']) {
  test(`partial glyph ${method} failure retains and retires every already-created handle`, async () => {
    const item = fixture({ input: packet({ markers: [absolute()] }) }); let failed = false;
    item.gpu.beforeCall = name => { if (!failed && name === method) { failed = true; throw new Error('driver diagnostic must remain private'); } };
    item.start(); await item.ready(); await item.frames(2); assert.equal(failed, true); sanitized(item); item.stop();
    assert.ok(refusalCount(item) > 0);
    assert.equal(JSON.stringify([item.states, item.errors]).includes('driver diagnostic'), false);
    for (const kind of ['Program', 'Shader', 'VertexArray']) assert.equal(ownedLive(item, kind).length, 0);
  });
}

test('failed program deletion continues independent cleanup and retains loss observation after logical disposal', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.start(); await item.ready(); await item.frames(1);
  const originalProgram = ownedLive(item, 'Program')[0]; assert.ok(originalProgram);
  item.gpu.beforeCall = name => { if (name === 'deleteProgram') throw new Error('delete failure'); };
  item.stop(); assert.equal(item.gpu.deleted.has(originalProgram), false);
  assert.ok(callsNamed(item, 'deleteVertexArray').length > 0, 'independent VAO cleanup still runs');
  assert.ok(item.canvasEvents.count('webglcontextlost') > 0, 'unretired handles retain authoritative loss observation');
  const before = item.gpu.calls.length; item.loss(); await item.ready();
  assert.ok(item.gpu.calls.slice(before).every(call => ['context-loss', 'isContextLost'].includes(call[0])));
  assert.equal(item.canvasEvents.count(), 0); assert.equal(item.calls.unsubscribe, 1);
});

test('failed sampler deletion blocks replacement allocation in the same context across style replay', async () => {
  const item = fixture(); item.start(); await item.ready(); await item.frames();
  const textures = callsNamed(item, 'createTexture').length;
  item.gpu.beforeCall = name => { if (name === 'deleteTexture') throw new Error('delete failure'); };
  await item.replaceStyle(); await item.frames(3);
  assert.equal(callsNamed(item, 'createTexture').length, textures, 'do not allocate a new sampler behind retained ownership');
  item.stop(); item.loss(); await item.ready(); assert.equal(item.canvasEvents.count(), 0);
});

test('observed context loss stops all raw GL, drawing, publication and wakeups from expired callbacks', async () => {
  const item = fixture(); item.start(); await item.ready(); await item.frames(); const layers = item.calls.add.map(value => value.layer);
  item.loss(); await item.ready(); const before = item.gpu.calls.length, repaint = item.calls.repaint;
  item.bridge.requestFrame(); await item.callback('prerender', layers); await item.callback('render', layers); item.stop();
  assert.ok(item.gpu.calls.slice(before).every(call => call[0] === 'isContextLost'));
  assert.equal(item.calls.repaint, repaint); sanitized(item);
});

test('host abort tears down subscriptions and future input cannot publish or request work', async () => {
  const item = fixture(); item.start(); await item.ready(); await item.frames(); item.controller.abort(); await item.ready();
  const stateCount = item.states.length, repaint = item.calls.repaint;
  item.replace(packet({ acceptedSceneRevision: 2, presentationRevision: 2 })); item.nativeEvents.emit('move'); item.bridge.requestFrame(); await item.ready();
  assert.equal(item.states.length, stateCount); assert.equal(item.calls.repaint, repaint); assert.equal(item.calls.unsubscribe, 1);
  assert.equal(item.nativeEvents.count(), 0); item.stop();
});

test('many unique terrain demands remain under eight native draws per prerender and one in-flight PBO', async () => {
  const markers = Array.from({ length: 12 }, (_, index) => marker(`anchor-${index}`, { position: { lngLat: [index, 0], altitude: 0, altitudeReference: 'terrain' } }));
  const item = fixture({ input: packet({ markers }) }); item.start(); await item.ready();
  for (let index = 0; index < 5; index++) {
    const before = sampleCalls(item); await item.callback('prerender'); assert.ok(sampleCalls(item) - before <= 8);
    assert.ok(ownedLive(item, 'Buffer').length <= 1); assert.ok(ownedLive(item, 'Sync').length <= 1);
  }
  item.stop();
});

for (const reentry of ['replace', 'abort']) {
  test(`${reentry} during native installation prevents stale installation publication and counter advance`, async () => {
    const item = fixture({ input: packet({ markers: [absolute()] }) }); let entered = false;
    item.controls.onAdd = () => {
      if (entered) return;
      entered = true;
      if (reentry === 'replace') item.replace(packet({ markers: [] }));
      else item.controller.abort();
    };
    item.start(); await item.ready(); await item.frames(1);
    assert.equal(entered, true); assert.equal(item.states.some(value => value.state === 'installed'), false);
    assert.ok(item.states.every(value => value.markerInstallationRevision === 0));
    assert.equal(item.gpu.draws.length, 0); assert.equal(item.layers.size, 0);
    if (reentry === 'replace') assert.equal(latest(item).state, 'empty');
    item.stop();
  });
}

test('same-revision input replacement during program construction suppresses stale drawing and retires the candidate', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); let boundary, entered = false;
  item.gpu.afterCall = name => {
    if (entered || name !== 'createProgram') return;
    entered = true; boundary = item.states.length; item.replace(packet({ markers: [] }));
  };
  item.start(); await item.ready(); await item.frames(2);
  assert.equal(entered, true); assert.equal(item.gpu.draws.length, 0);
  assert.ok(item.states.slice(boundary).every(value => value.state !== 'installed'));
  assert.equal(latest(item).state, 'empty'); item.stop();
  for (const kind of ['Program', 'Shader', 'VertexArray']) assert.equal(ownedLive(item, kind).length, 0);
});

for (const method of ['createShader', 'createProgram', 'createVertexArray', 'getShaderParameter', 'getProgramParameter']) {
  test(`ordinary ${method} refusal is sanitized and retires partial ownership`, async () => {
    const item = fixture({ input: packet({ markers: [absolute()] }) }), original = item.gl[method]; let refused = false;
    item.gl[method] = (...args) => {
      if (method.startsWith('create')) { refused = true; return null; }
      original.apply(item.gl, args); refused = true; return false;
    };
    item.start(); await item.ready(); await item.frames(2); assert.equal(refused, true);
    assert.ok(refusalCount(item) > 0); sanitized(item); item.stop();
    for (const kind of ['Program', 'Shader', 'VertexArray']) assert.equal(ownedLive(item, kind).length, 0);
  });
}

test('failed candidate link does not retire the current variant before successful replacement', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.start(); await item.ready(); await item.frames(1);
  const current = ownedLive(item, 'Program')[0], originalSource = item.args.shaderData;
  const originalStatus = item.gl.getProgramParameter; let failed = false, deletedBeforeCandidateFailure = false;
  item.gpu.beforeCall = (name, args) => {
    if (name === 'deleteProgram' && args[0] === current && !failed) deletedBeforeCandidateFailure = true;
  };
  item.gl.getProgramParameter = (...args) => {
    const result = originalStatus.apply(item.gl, args);
    if (args[0] !== current) { failed = true; return false; }
    return result;
  };
  item.args.shaderData = { ...originalSource, vertexShaderPrelude: `${originalSource.vertexShaderPrelude}\n// Failing candidate source.` };
  const before = refusalCount(item); await item.frames(1);
  assert.equal(failed, true); assert.equal(deletedBeforeCandidateFailure, false);
  assert.ok(refusalCount(item) > before); assert.equal(item.gpu.draws.some(draw => draw.program !== current), false);
  item.stop();
});

test('retained old-program deletion failure prevents a third variant from exceeding seven owned glyph handles', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); let peak = 0;
  item.gpu.afterCall = () => { peak = Math.max(peak, ownedLive(item, 'Program').length + ownedLive(item, 'Shader').length + ownedLive(item, 'VertexArray').length); };
  item.start(); await item.ready(); await item.frames(1); const old = ownedLive(item, 'Program')[0];
  item.gpu.beforeCall = (name, args) => { if (name === 'deleteProgram' && args[0] === old) throw new Error('retained program'); };
  item.args.shaderData = { ...item.args.shaderData, define: `${item.args.shaderData.define}\n#define SECOND_VARIANT` }; await item.frames(1);
  assert.equal(item.gpu.deleted.has(old), false); assert.ok(callsNamed(item, 'deleteProgram').some(call => call[1] === old));
  const allocations = callsNamed(item, 'createProgram').length;
  item.args.shaderData = { ...item.args.shaderData, define: `${item.args.shaderData.define}\n#define THIRD_VARIANT` }; await item.frames(2);
  assert.ok(peak <= 7); assert.equal(callsNamed(item, 'createProgram').length, allocations);
  assert.ok(refusalCount(item) > 0); item.stop(); item.loss();
});

test('allocation replacement invalidates terrain and updates CSS glyph dimensions within one bridge', async () => {
  const item = fixture(); item.start(); await item.ready(); await item.frames(); const samples = sampleCalls(item);
  item.gl.canvas.clientWidth = 320; item.gl.canvas.clientHeight = 240;
  item.gl.canvas.width = 400; item.gl.canvas.height = 300; item.gl.drawingBufferWidth = 400; item.gl.drawingBufferHeight = 300;
  item.gpu.state.set('VIEWPORT', [0, 0, 400, 300]);
  item.replace(packet({ presentationRevision: 2,
    allocation: { revision: 2, width: 320, height: 240, pixelRatio: 1.25, padding: { top: 0, right: 0, bottom: 0, left: 0 } } }));
  await item.ready(); item.gpu.draws.length = 0; await item.callback(); assert.equal(item.gpu.draws.length, 0);
  await item.frames(); assert.equal(sampleCalls(item), samples + 1); assert.ok(item.gpu.draws.length > 0);
  assert.ok(item.gpu.draws.every(draw => hasUniform(draw, [12 / 320, 12 / 240])));
  assert.equal(latest(item).allocationRevision, 2); item.stop();
});

for (const [name, value] of [['width', 0], ['height', Infinity], ['pixelRatio', -1]]) {
  test(`invalid allocation ${name} is refused before preparing or drawing`, async () => {
    const allocation = { ...packet().allocation, [name]: value }, item = fixture({ input: packet({ allocation }) });
    let rejected = false;
    try { item.start(); } catch (error) { rejected = error instanceof TypeError; }
    await item.ready(); assert.ok(rejected || refusalCount(item) > 0);
    assert.equal(item.calls.prepare.length, 0); assert.equal(item.calls.add.length, 0); assert.equal(item.gpu.created.size, 0); item.stop();
  });
}

test('context restoration installs a fresh epoch and expired callbacks cannot draw or sample through it', async () => {
  const item = fixture(); item.start(); await item.ready(); await item.frames();
  const oldLayers = item.calls.add.map(value => value.layer), oldHandles = new Set(item.gpu.created), samples = sampleCalls(item);
  item.loss(); await item.ready(); item.restore(); await item.ready(); item.gpu.draws.length = 0;
  await item.callback('prerender', oldLayers); await item.callback('render', oldLayers);
  assert.equal(item.gpu.draws.length, 0); assert.equal(sampleCalls(item), samples);
  await item.frames(); assert.ok(item.gpu.draws.length > 0); assert.equal(sampleCalls(item), samples + 1);
  assert.ok(item.gpu.draws.every(draw => !oldHandles.has(draw.program) && !oldHandles.has(draw.vao)));
  item.stop(); assert.equal(item.canvasEvents.count(), 0);
});

test('terrain hook view reentry drains retired sampler ownership before final listener removal', async () => {
  const item = fixture(), original = item.args.renderTerrainHeightMap; let changed = false;
  item.args.renderTerrainHeightMap = target => {
    original(target);
    if (!changed) { changed = true; item.nativeEvents.emit('move'); }
  };
  item.start(); await item.ready(); await item.frames(1); assert.equal(changed, true); item.stop(); await item.ready();
  for (const kind of ['Program', 'Shader', 'VertexArray', 'Texture', 'Framebuffer', 'Buffer', 'Sync']) assert.equal(ownedLive(item, kind).length, 0);
  assert.equal(item.nativeEvents.count(), 0); assert.equal(item.canvasEvents.count(), 0);
});

test('actual GL loss during glyph allocation stops raw calls before the canvas loss event arrives', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); let boundary;
  item.gpu.afterCall = name => {
    if (name === 'createShader' && boundary === undefined) { item.gpu.lose(); boundary = item.gpu.calls.length; }
  };
  item.start(); await item.ready(); await item.frames(1);
  assert.equal(Number.isInteger(boundary), true);
  assert.ok(item.gpu.calls.slice(boundary).every(call => call[0] === 'isContextLost'));
  assert.equal(item.gpu.draws.length, 0); item.stop();
});

test('failed glyph retirement blocks new same-context renderers across repeated style replay', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); item.start(); await item.ready(); await item.frames(1);
  item.gpu.beforeCall = name => { if (name === 'deleteProgram') throw new Error('retained program'); };
  const programs = callsNamed(item, 'createProgram').length;
  for (let index = 0; index < 3; index++) {
    await item.replaceStyle(); await item.frames(1);
    const live = ['Program', 'Shader', 'VertexArray'].reduce((count, kind) => count + ownedLive(item, kind).length, 0);
    assert.ok(live <= 7, 'the handle ceiling is owned by the context, including retained old renderers');
  }
  assert.equal(callsNamed(item, 'createProgram').length, programs);
  item.stop(); item.loss();
});

test('capture-phase loss authority invalidates owned layers before earlier native bubble listeners', async () => {
  const item = fixture({ input: packet({ markers: [absolute()] }) }); let observed = false;
  item.gl.canvas.addEventListener('webglcontextlost', () => {
    observed = true;
    assert.equal(item.calls.remove.length, 1, 'bridge invalidation precedes native bubble handling');
  });
  item.start(); await item.ready(); await item.frames(1);
  assert.doesNotThrow(() => item.loss()); assert.equal(observed, true); item.stop();
});

test('capture callback retirement cannot authorize another glyph allocation after local ownership changes', async () => {
  for (let offset = 1; offset <= 8; offset++) {
    const item = fixture({ input: packet({ markers: [absolute()] }) }); let armed = false, reads = 0, boundary;
    item.gpu.afterCall = name => { if (name === 'createVertexArray') armed = true; };
    item.controls.onCapture = () => {
      if (armed && ++reads === offset) { boundary = item.gpu.calls.length; item.bridge.invalidateStyle(); }
    };
    item.start(); await item.ready(); await item.frames(1);
    if (boundary !== undefined) assert.equal(item.gpu.calls.slice(boundary).some(call => ['createVertexArray', 'createShader', 'createProgram', 'drawArrays'].includes(call[0])), false,
      `capture callback ${offset} cannot retain stale draw authority`);
    item.stop();
  }
});

test('last status capture cannot publish or count an installation after native ownership changes', async () => {
  for (const invalidation of ['foreign', 'style']) for (let offset = 1; offset <= 10; offset++) {
    const item = fixture({ input: packet({ markers: [absolute()] }) }); item.start(); await item.ready(); await item.frames(1);
    const installed = item.calls.add[0], revision = latest(item).markerInstallationRevision, boundary = item.states.length;
    let captures = 0, changed = false;
    item.controls.onState = value => {
      if (value.state === 'installed' && value.presentationRevision === 2) item.controls.onCapture = undefined;
    };
    item.controls.onCapture = () => {
      if (++captures !== offset) return;
      changed = true;
      if (invalidation === 'foreign') item.layers.set(installed.layer.id, { handle: Object.freeze({ id: installed.layer.id, foreign: true }) });
      else item.bridge.invalidateStyle();
    };
    item.replace(packet({ presentationRevision: 2, markers: [absolute()] })); await item.ready();
    if (changed) {
      assert.equal(item.states.slice(boundary).some(value => value.state === 'installed'), false,
        `${invalidation} at capture ${offset} prevents stale installed publication`);
      item.controls.onCapture = undefined;
      item.replace(packet({ presentationRevision: 3, markers: [] }));
      if (invalidation === 'style') item.nativeEvents.emit('style.load');
      await item.ready();
      assert.equal(latest(item).markerInstallationRevision, revision,
        `${invalidation} at capture ${offset} cannot advance the installation counter`);
    }
    item.stop();
  }
});
