import assert from 'node:assert/strict';
import test from 'node:test';
import { createMapSceneOwner } from '../dist/components/media/map/map-scene-owner.js';
import { createSceneBridge } from '@aceshooting/lyra-map/scene';
import { createSceneBridgeGl } from '../../lyra-map/test/fixtures/scene-bridge-gl.mjs';

const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
const marker = (id = 'anchor', longitude = 0) => ({ id, kind: 'marker', label: id,
  position: { lngLat: [longitude, 0], altitude: 7, altitudeReference: 'sea-level' } });
const hasUniform = (draw, expected) => Object.values(draw.uniforms).some(value => value.length === expected.length &&
  value.every((part, index) => Math.abs(part - expected[index]) < 1e-6));

function composition() {
  const gpu = createSceneBridgeGl(), { gl } = gpu, layers = new Map(), events = new Map(), canvasEvents = new Map();
  const abort = new AbortController(), states = [], errors = [], installed = [], removed = [];
  let live = true, styleReady = true, callbackDepth = 0, color = [0.2, 0.4, 0.8, 0.5];
  gl.canvas.addEventListener = (name, callback) => { const set = canvasEvents.get(name) ?? new Set(); set.add(callback); canvasEvents.set(name, set); };
  gl.canvas.removeEventListener = (name, callback) => canvasEvents.get(name)?.delete(callback);
  const owner = createMapSceneOwner({ element: Object.create(null), connection: Object.freeze({}), isCurrentConnection: () => live, changed() {} });
  owner.setViewport({ width: 640, height: 480, pixelRatio: 1, padding: { top: 0, right: 0, bottom: 0, left: 0 } });
  const prepare = () => {
    const publication = owner.captureRenderPublication();
    if (publication.phase !== 'pending') return;
    owner.commitPresentation(publication, { reducedMotion: true,
      markers: publication.accepted.objects.filter(row => row.kind === 'marker').map(row => ({ id: row.id, rgba: [...color] })) });
  };
  let releasePreparation = owner.subscribeRenderPublication(prepare);
  owner.assign({ objects: [marker()] });
  const map = {
    getCanvas: () => gl.canvas, getLayer: id => layers.get(id)?.handle,
    getCenter: () => ({ lng: 0, lat: 0 }), getZoom: () => 0, getPitch: () => 0, getBearing: () => 0,
    getTerrain: () => null, getProjection: () => ({ type: 'mercator' }), isStyleLoaded: () => styleReady,
    prepareFeatures: async () => {}, triggerRepaint() {},
    addLayer(layer) { assert.equal(layers.has(layer.id), false); const handle = Object.freeze({ id: layer.id });
      layers.set(layer.id, { layer, handle }); installed.push(handle); layer.onAdd?.(map, gl); },
    removeLayer(id) { assert.equal(callbackDepth, 0); const entry = layers.get(id); layers.delete(id); removed.push(id); entry?.layer.onRemove?.(map, gl); },
    on(name, callback) { const set = events.get(name) ?? new Set(); set.add(callback); events.set(name, set); return map; },
    off(name, callback) { events.get(name)?.delete(callback); return map; }
  };
  const emit = name => { for (const listener of [...events.get(name) ?? []]) listener({ type: name }); };
  const host = { signal: abort.signal, isCurrent: () => live,
    captureRenderInput: () => owner.captureRenderPublication().input,
    subscribeRenderInput: listener => owner.subscribeRenderPublication(listener),
    onState: value => states.push(value), onError: code => errors.push(code) };
  const args = { shaderData: { variantName: 'mercator', define: '#define PROJECTION_MERCATOR',
    vertexShaderPrelude: 'vec4 projectTileFor3D(vec2 p, float z) { return u_projection_fallback_matrix * vec4(p, z, 1.0); }' },
    getProjectionData({ tileID }) {
      const size = 2 ** tileID.canonical.z;
      return { mainMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        fallbackMatrix: [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 1 / 1000, 0, -1, 1, 0, 1],
        tileMercatorCoords: [tileID.canonical.x / size, tileID.canonical.y / size, 1 / (8192 * size), 1 / (8192 * size)],
        clippingPlane: [0, 0, 1, -1 / 3], projectionTransition: 0 };
    } };
  const bridge = createSceneBridge(map, host);
  return { gpu, owner, host, bridge, layers, installed, removed, states, errors, emit,
    color(value) { color = value; }, style(value) { styleReady = value; },
    pausePreparation() { releasePreparation(); },
    resumePreparation() { releasePreparation = owner.subscribeRenderPublication(prepare); prepare(); },
    async frames(count = 2) {
      for (let index = 0; index < count; index++) {
        for (const method of ['prerender', 'render']) {
          for (const { layer } of [...layers.values()]) {
            if (typeof layer[method] !== 'function') continue;
            callbackDepth++; try { layer[method](gl, args); } finally { callbackDepth--; }
          }
          await flush();
        }
      }
    },
    retireStyle() { for (const [id, { layer }] of [...layers]) { layers.delete(id); layer.onRemove?.(map, gl); } },
    close() { gpu.beforeCall = undefined; live = false; bridge.dispose(); abort.abort(); releasePreparation(); owner.close(); }
  };
}

test('built owner publication coalesces metadata and theme without replacing the ordinary native owner', async () => {
  const h = composition();
  try {
    await flush(); await h.frames(); assert.ok(h.gpu.draws.length > 0);
    const handle = h.installed[0], target = h.owner.state.capture().targets[0], created = h.gpu.created.size;
    h.owner.assign({ objects: [{ ...marker(), label: 'Renamed' }] });
    h.color([0.8, 0.3, 0.1, 0.25]); h.owner.invalidatePresentation();
    assert.equal(h.host.isCurrent(), true); assert.equal(h.owner.captureRenderPublication().phase, 'resolved');
    await flush(); h.gpu.draws.length = 0; await h.frames();
    assert.equal(h.installed.length, 1); assert.equal([...h.layers.values()][0].handle, handle);
    assert.equal(h.gpu.created.size, created); assert.equal(h.owner.state.capture().targets[0], target);
    assert.ok(h.gpu.draws.length > 0); assert.ok(h.gpu.draws.every(draw => hasUniform(draw, [0.8, 0.3, 0.1, 0.25])));
    assert.equal(h.owner.captureView().status.state, 'unavailable');
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('built owner disposal retires only owned native resources and retains accepted intent', async () => {
  const h = composition();
  try {
    await flush(); await h.frames(); const accepted = h.owner.captureAccepted();
    const foreign = { layer: { id: 'foreign' }, handle: Object.freeze({ id: 'foreign' }) }; h.layers.set('foreign', foreign);
    h.bridge.dispose(); h.bridge.dispose(); await flush();
    assert.deepEqual([...h.layers.keys()], ['foreign']); assert.equal(h.layers.get('foreign'), foreign);
    assert.equal(h.owner.captureAccepted(), accepted); assert.ok(h.removed.length > 0);
    assert.equal([...h.gpu.created].filter(handle => !h.gpu.deleted.has(handle)).length, 0);
    h.gpu.draws.length = 0; await h.frames(); assert.equal(h.gpu.draws.length, 0); assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('style readiness replay installs the latest accepted owner packet after an early style event', async () => {
  const h = composition();
  try {
    await flush(); await h.frames(); const first = h.installed[0];
    h.bridge.invalidateStyle(); h.style(false); h.retireStyle();
    h.owner.assign({ objects: [marker('new', 10)] }); h.color([0.1, 0.7, 0.2, 1]); h.owner.invalidatePresentation();
    h.emit('style.load'); await flush(); assert.equal(h.installed.length, 1);
    h.style(true); h.emit('render'); await flush(); h.gpu.draws.length = 0; await h.frames();
    assert.equal(h.installed.length, 2); assert.notEqual(h.installed[1], first);
    assert.equal(h.states.at(-1).acceptedSceneRevision, h.owner.captureAccepted().acceptedSceneRevision);
    assert.ok(h.gpu.draws.length > 0); assert.ok(h.gpu.draws.every(draw => hasUniform(draw, [0.1, 0.7, 0.2, 1])));
    assert.deepEqual(h.errors, []);
    assert.equal(h.owner.captureView().status.state, 'unavailable');
  } finally { h.close(); }
});

test('native callback reentry suppresses stale draw and recovers the resolved publication without revoking lifetime', async () => {
  const h = composition();
  try {
    await flush(); await h.frames(); h.gpu.draws.length = 0; let reentered = false;
    h.gpu.beforeCall = name => {
      if (name !== 'useProgram' || reentered) return;
      reentered = true; h.pausePreparation(); h.owner.invalidatePresentation();
    };
    await h.frames(1); h.gpu.beforeCall = undefined;
    assert.equal(reentered, true); assert.equal(h.host.isCurrent(), true);
    assert.equal(h.owner.captureRenderPublication().phase, 'pending'); assert.equal(h.gpu.draws.length, 0);
    h.color([0.6, 0.2, 0.4, 1]); h.resumePreparation(); await flush(); await h.frames(3);
    assert.equal(h.owner.captureRenderPublication().phase, 'resolved'); assert.ok(h.gpu.draws.length > 0);
    assert.ok(h.gpu.draws.every(draw => hasUniform(draw, [0.6, 0.2, 0.4, 1])));
    assert.equal(h.owner.captureView().status.state, 'unavailable');
  } finally { h.close(); }
});

function publishResizedAllocation(h) {
  const { gl } = h.gpu;
  gl.drawingBufferWidth = 960; gl.drawingBufferHeight = 720;
  gl.canvas.width = 960; gl.canvas.height = 720;
  gl.canvas.clientWidth = 480; gl.canvas.clientHeight = 360;
  gl.viewport(0, 0, 960, 720);
  h.owner.setViewport({ width: 480, height: 360, pixelRatio: 2,
    padding: { top: 0, right: 0, bottom: 0, left: 0 } });
  h.emit('move'); h.emit('resize');
}

test('native resize notifications preserve a committed owner while its new allocation awaits reconciliation', async () => {
  const h = composition();
  try {
    await flush(); await h.frames();
    const handle = h.installed[0], created = h.gpu.created.size;
    publishResizedAllocation(h);
    const input = h.host.captureRenderInput(), radius = input.markers[0].radiusCss;
    assert.deepEqual([input.allocation.width, input.allocation.height, input.allocation.pixelRatio], [480, 360, 2]);
    await flush(); h.gpu.draws.length = 0; await h.frames();
    assert.equal(h.installed.length, 1); assert.equal([...h.layers.values()][0]?.handle, handle);
    assert.equal(h.gpu.created.size, created); assert.deepEqual(h.removed, []);
    assert.ok(h.gpu.draws.length > 0);
    assert.ok(h.gpu.draws.every(draw => hasUniform(draw, [2 * radius / 480, 2 * radius / 360])));
    assert.deepEqual(h.errors, []);
  } finally { h.close(); }
});

test('synchronous native redraw skips an unreconciled allocation without retiring the committed owner', async () => {
  const h = composition();
  try {
    await flush(); await h.frames();
    const handle = h.installed[0], created = h.gpu.created.size;
    publishResizedAllocation(h); h.gpu.draws.length = 0;
    const radius = h.host.captureRenderInput().markers[0].radiusCss;
    // The first prerender runs in this stack, before the fixture drains pending microtasks.
    const redraw = h.frames(1), immediateDraws = h.gpu.draws.length;
    await redraw; await h.frames();
    assert.equal(immediateDraws, 0);
    assert.equal(h.installed.length, 1); assert.equal([...h.layers.values()][0]?.handle, handle);
    assert.equal(h.gpu.created.size, created); assert.deepEqual(h.removed, []);
    assert.ok(h.gpu.draws.length > 0);
    assert.ok(h.gpu.draws.every(draw => hasUniform(draw, [2 * radius / 480, 2 * radius / 360])));
    assert.deepEqual(h.errors, []);
    assert.equal(h.owner.captureView().status.state, 'unavailable');
  } finally { h.close(); }
});
