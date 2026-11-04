import assert from 'node:assert/strict';
import test from 'node:test';
import { createSceneLayer } from '../src/scene/custom-layer.mjs';

const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

function fixture(options = {}) {
  const layers = new Map(), events = new Map(), canvasEvents = new Map(), calls = { repaint: 0, prepare: 0, removed: [] };
  const gl = { isContextLost: () => lostContext };
  let lostContext = false, styleLoaded = options.styleLoaded ?? true, terrain = null, elevation = 120, zoom = 4.5;
  const canvas = {
    width: 800, height: 600,
    addEventListener(name, listener) { canvasEvents.set(name, listener); },
    removeEventListener(name, listener) { if (canvasEvents.get(name) === listener) canvasEvents.delete(name); }
  };
  const map = {
    addLayer(layer, before) { layers.set(layer.id, { layer, before }); layer.onAdd(map, gl); },
    removeLayer(id) { calls.removed.push(id); const entry = layers.get(id); layers.delete(id); entry?.layer.onRemove?.(map, gl); },
    getLayer: id => layers.get(id)?.layer,
    getCanvas: () => canvas,
    isStyleLoaded: () => styleLoaded,
    triggerRepaint() { calls.repaint++; },
    getCenter: () => ({ lng: 6, lat: 49 }),
    getZoom: () => zoom,
    getTerrain: () => terrain,
    queryTerrainElevation: () => elevation,
    getPixelRatio: () => 2,
    on(name, listener) { const set = events.get(name) ?? new Set(); set.add(listener); events.set(name, set); },
    off(name, listener) { events.get(name)?.delete(listener); },
    ...(options.prepare === false ? {} : { prepareFeatures() { calls.prepare++; return Promise.resolve(); } })
  };
  const args = {
    shaderData: { variantName: 'mercator', define: '#define PROJECTION_MERCATOR', vertexShaderPrelude: 'vec4 projectTileFor3D(vec2 p, float z) { return vec4(p, z, 1.0); }' },
    getProjectionData({ tileID }) {
      const size = 2 ** tileID.canonical.z;
      return {
        mainMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        fallbackMatrix: [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 1 / 1000, 0, -1, 1, 0, 1],
        tileMercatorCoords: [tileID.canonical.x / size, tileID.canonical.y / size, 1 / (8192 * size), 1 / (8192 * size)],
        clippingPlane: [0, 0, 1, -1 / 3], projectionTransition: 0
      };
    }
  };
  const controller = new AbortController(), states = [], instances = [];
  const layer = {
    id: 'cone', label: 'Coverage cone',
    create(context) {
      const instance = { context, frames: [], disposed: 0, contextLostAtDispose: undefined,
        render(frame) { instance.frames.push(frame); options.render?.(frame, instance); },
        dispose() { instance.disposed++; instance.contextLostAtDispose = context.gl.isContextLost(); },
        ...options.instance };
      instances.push(instance);
      return instance;
    },
    ...options.layer
  };
  const host = { signal: controller.signal, onState: (state, code) => states.push(code ? `${state}/${code}` : state),
    ...(options.reducedMotion ? { reducedMotion: options.reducedMotion } : {}) };
  const handle = createSceneLayer(map, layer, host);
  return {
    map, handle, layers, events, canvasEvents, calls, states, instances, controller, args, gl,
    native: () => [...layers.values()][0]?.layer,
    render(method = 'render') { const native = [...layers.values()][0]?.layer; native?.[method]?.(gl, args); },
    fire(name, event = {}) { for (const listener of [...events.get(name) ?? []]) listener(event); },
    canvas(name) { canvasEvents.get(name)?.(); },
    setTerrain(value) { terrain = value; },
    setElevation(value) { elevation = value; },
    setStyleLoaded(value) { styleLoaded = value; },
    setZoom(value) { zoom = value; },
    loseContext(value) { lostContext = value; }
  };
}

test('installs a native 3D custom layer and serves a fresh instance a geographic frame', async () => {
  const item = fixture({ reducedMotion: () => true, layer: { before: 'labels' } });
  item.map.addLayer({ id: 'labels', type: 'background', onAdd() {} });
  await flush();
  const native = item.native();
  assert.equal(native.id === 'labels' ? [...item.layers.values()][1].layer.type : native.type, 'custom');
  const entry = [...item.layers.values()].find(value => value.layer.type === 'custom');
  assert.equal(entry.layer.renderingMode, '3d'); assert.equal(entry.before, 'labels');
  assert.match(entry.layer.id, /^scene-layer-\d+$/u); assert.equal(item.calls.prepare, 1);
  assert.deepEqual(item.states, ['loading']);
  entry.layer.render(item.gl, item.args); await flush();
  assert.equal(item.instances.length, 1);
  const [instance] = item.instances, frame = instance.frames[0];
  assert.equal(instance.context.gl, item.gl);
  assert.equal(frame.width, 400); assert.equal(frame.height, 300); assert.equal(frame.pixelRatio, 2);
  assert.equal(frame.reducedMotion, true); assert.equal(frame.projectionStamp.layout.tileZoom, 4);
  assert.deepEqual(item.states, ['loading', 'ready']);
  item.handle.dispose(); item.handle.dispose();
  assert.equal(instance.disposed, 1); assert.equal(item.layers.has(entry.layer.id), false);
  assert.equal(item.canvasEvents.size, 0);
  assert.equal([...item.events.values()].every(set => set.size === 0), true);
});

test('frames project sea-level and terrain-relative positions through engine projection data', async () => {
  const seen = [];
  const item = fixture({ render(frame, instance) {
    const sea = frame.geographic.resolve({ lngLat: [6, 49], altitude: 50 });
    const relative = frame.geographic.resolve({ lngLat: [6, 49], altitude: 10, altitudeReference: 'terrain' });
    const origin = instance.context.geographic.frameFor(sea);
    const shader = frame.geographic.shader(origin);
    seen.push({ sea, relative, key: shader.key, encoded: frame.geographic.encode(sea, origin) });
  } });
  await flush();
  item.render(); await flush();
  assert.equal(seen[0].sea.altitude, 50); assert.equal(seen[0].relative.status, 'terrain-unavailable');
  assert.match(seen[0].key, /mercator$/u); assert.equal(seen[0].encoded[2], 50);
  item.setTerrain({ source: 'dem' }); item.fire('terrain');
  item.render(); await flush();
  assert.deepEqual([seen[1].relative.status, seen[1].relative.altitude], ['resolved', 130]);
  item.setElevation(null); item.fire('move');
  item.render(); await flush();
  assert.equal(seen[2].relative.status, 'terrain-pending');
  item.handle.dispose();
});

test('a terrain query without engine support reports unavailable terrain', async () => {
  const seen = [];
  const item = fixture({ render(frame) { seen.push(frame.geographic.resolve({ lngLat: [0, 0], altitudeReference: 'terrain' }).status); } });
  item.setTerrain({ source: 'dem' }); delete item.map.queryTerrainElevation;
  item.map.getTerrain = () => { throw new Error('removed'); };
  await flush(); item.render(); await flush();
  assert.deepEqual(seen, ['terrain-unavailable']);
  item.handle.dispose();
});

test('style replacement retires the instance and the next style load remounts a fresh one', async () => {
  const item = fixture({ prepare: false });
  await flush(); item.render(); await flush();
  const first = item.native();
  item.handle.invalidateStyle();
  assert.equal(item.instances[0].disposed, 1); assert.equal(item.layers.size, 0);
  item.handle.requestFrame();
  item.fire('style.load'); await flush();
  assert.notEqual(item.native(), first); item.render(); await flush();
  assert.equal(item.instances.length, 2);
  item.handle.invalidateStyle(); item.handle.styleReady(); item.handle.styleReady(); await flush();
  item.render(); await flush();
  assert.equal(item.instances.length, 3); assert.equal(item.instances[1].disposed, 1);
  item.handle.dispose();
});

test('context loss disposes without GL work and restoration remounts', async () => {
  const item = fixture();
  await flush(); item.render(); await flush();
  item.loseContext(true); item.canvas('webglcontextlost'); item.canvas('webglcontextlost');
  assert.equal(item.instances[0].disposed, 1); assert.equal(item.instances[0].contextLostAtDispose, true);
  assert.equal(item.states.at(-1), 'unavailable/context-lost');
  assert.equal(await item.handle.pick([1, 2]), null);
  item.loseContext(false); item.canvas('webglcontextrestored'); item.canvas('webglcontextrestored'); await flush();
  item.render(); await flush();
  assert.equal(item.instances.length, 2); assert.equal(item.states.at(-1), 'ready');
  item.handle.dispose();
  item.canvas('webglcontextrestored');
});

test('picking asks the current instance and rejects stale or malformed results', async () => {
  let result = { id: 'beam', position: { lngLat: [6, 49], altitude: 30, altitudeReference: 'terrain' } }, gate;
  const item = fixture({ instance: {
    pick: async (point, revision) => { if (gate) await gate; return typeof result === 'function' ? result(point, revision) : result; },
    items: () => [{ id: 'beam', label: 'Beam', position: { lngLat: [6, 49] } }, { id: 'x', label: '', position: { lngLat: [0, 0] } }, null]
  } });
  assert.equal(await item.handle.pick([1, 2]), null, 'no instance before the first frame');
  await flush(); item.render(); await flush();
  assert.deepEqual(await item.handle.pick([1, 2]), { id: 'beam', position: { lngLat: [6, 49], altitude: 30, altitudeReference: 'terrain' } });
  assert.deepEqual(item.handle.items(), [{ id: 'beam', label: 'Beam', position: { lngLat: [6, 49] } }]);
  for (const [value, expected] of [
    [{ id: 'plain' }, { id: 'plain' }], [{ id: ' ' }, null], [null, null], [{ id: 'bad', position: { lngLat: [1] } }, { id: 'bad' }],
    [{ id: 'bad', position: { lngLat: [1, 2], altitudeReference: 'moon' } }, { id: 'bad' }],
    [Object.defineProperty({}, 'id', { get: () => 'x' }), null]
  ]) { result = value; assert.deepEqual(await item.handle.pick([1, 2]), expected); }
  result = () => { throw new Error('gpu'); };
  assert.equal(await item.handle.pick([1, 2]), null);
  for (const point of [[1], [1, Number.NaN], 'xy']) assert.equal(await item.handle.pick(point), null);
  let release; gate = new Promise(done => { release = done; }); result = { id: 'late' };
  const late = item.handle.pick([1, 2]); item.fire('move'); release();
  assert.equal(await late, null, 'a newer view makes the pick stale');
  item.instances[0].items = () => { throw new Error('items'); };
  assert.deepEqual(item.handle.items(), []);
  item.instances[0].items = () => 'nope';
  assert.deepEqual(item.handle.items(), []);
  item.handle.dispose();
  assert.deepEqual(item.handle.items(), []);
});

test('render failures report unavailable and remain retired until a remount', async () => {
  const item = fixture({ render() { throw new Error('shader'); } });
  await flush(); item.render(); await flush();
  assert.equal(item.states.at(-1), 'unavailable/render'); assert.equal(item.layers.size, 0);
  assert.deepEqual(item.handle.items(), []);
  item.handle.dispose();
});

test('a style that is still loading defers installation until a later render', async () => {
  const item = fixture({ styleLoaded: false });
  await flush();
  assert.equal(item.layers.size, 0);
  item.fire('render'); await flush();
  assert.equal(item.layers.size, 0);
  item.setStyleLoaded(true); item.fire('render'); await flush();
  assert.equal(item.layers.size, 1);
  item.fire('render');
  item.handle.setVisible(false); item.handle.requestFrame(); assert.equal(item.calls.repaint, 0);
  item.handle.setVisible(true); item.handle.requestFrame(); assert.ok(item.calls.repaint >= 1);
  item.map.triggerRepaint = () => { throw new Error('removed'); };
  item.handle.requestFrame(); assert.equal(item.states.at(-1), 'unavailable/engine');
  item.handle.dispose();
});

test('invalid view, layer and host input is refused', async () => {
  const item = fixture();
  await flush();
  item.setZoom(Number.NaN); item.fire('move');
  assert.equal(item.states.at(-1), 'unavailable/engine');
  item.handle.invalidateStyle(); item.fire('style.load');
  assert.equal(item.states.at(-1), 'unavailable/engine');
  item.handle.dispose();
  const base = fixture();
  for (const [map, layer, host] of [
    [{}, {}, {}],
    [base.map, { id: '', label: 'x', create() {} }, { signal: base.controller.signal }],
    [base.map, { id: 'x', label: 'x', create() {}, before: '' }, { signal: base.controller.signal }],
    [base.map, { id: 'x', label: 'x', create() {} }, { signal: {} }],
    [base.map, { id: 'x', label: 'x', create() {} }, { signal: base.controller.signal, onState: 1 }],
    [base.map, Object.defineProperty({ label: 'x', create() {} }, 'id', { get: () => 'x' }), { signal: base.controller.signal }],
    [base.map, null, { signal: base.controller.signal }],
    [{ ...base.map, getCanvas: () => ({}) }, { id: 'x', label: 'x', create() {} }, { signal: base.controller.signal }]
  ]) assert.throws(() => createSceneLayer(map, layer, host), TypeError);
  base.handle.dispose();
});

test('aborting the host signal disposes, and an aborted signal never installs', async () => {
  const item = fixture({ render(_frame, instance) { void instance; } });
  await flush(); item.render(); await flush();
  item.map.off = () => { throw new Error('removed'); };
  item.controller.abort();
  assert.equal(item.instances[0].disposed, 1); assert.equal(item.layers.size, 0);
  item.handle.invalidateStyle(); item.fire('render');
  const controller = new AbortController(); controller.abort();
  const states = [];
  createSceneLayer(item.map, { id: 'x', label: 'x', create() {} }, { signal: controller.signal, onState: state => states.push(state) });
  await flush();
  assert.equal(item.layers.size, 0); assert.deepEqual(states, []);
});

test('host state callbacks that throw stay isolated', async () => {
  const controller = new AbortController(), layers = new Map();
  const item = fixture();
  const map = { ...item.map, addLayer(layer) { layers.set(layer.id, layer); layer.onAdd(map, item.gl); },
    getLayer: id => layers.get(id), removeLayer: id => layers.delete(id) };
  const handle = createSceneLayer(map, { id: 'x', label: 'x', create: () => ({ render() {}, dispose() {} }) },
    { signal: controller.signal, onState() { throw new Error('host'); } });
  await flush();
  [...layers.values()][0].render(item.gl, item.args); await flush();
  assert.equal(layers.size, 1);
  handle.dispose(); item.handle.dispose();
});
