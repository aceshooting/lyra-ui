import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as authority from '../../src/scene/native-frame-authority.mjs';
import { createNativeFramePlugin, nativeFrameSourcesMatch } from '../../scripts/native-frame-transform.mjs';
import { upstreamRoot } from '../pinned-upstream.mjs';
import { createSceneCompletionGl } from './scene-completion-gl.mjs';
import { cameraFacts, completionInput, freeze } from './scene-completion-data.mjs';

export const registryId = fileURLToPath(new URL('../../src/scene/native-frame-authority.mjs', import.meta.url));
export const sourcePaths = { painter: 'render/painter.ts', drawCustom: 'webgl/draw/draw_custom.ts' };
export const sourceHashes = { painter: 'edf08f62a0a52cce51847c154413c9b054b6d9a3d988d82fe50e3fa3d8ad090c',
  drawCustom: 'c029531a50a329339e3b37f419a081c6e50e3e5d5dcde90473099a684a320b74' };
export async function nativeSources() {
  return Object.fromEntries(await Promise.all(Object.entries(sourcePaths).map(async ([name, path]) =>
    [name, await readFile(join(upstreamRoot, 'src', path), 'utf8')])));
}
export const newPlugin = (enabled = true) => createNativeFramePlugin({ enabled, registryId, upstreamRoot });
export { authority, nativeFrameSourcesMatch };
export const flushNativeBuild = async () => { for (let index = 0; index < 24; index++) await Promise.resolve(); };

// Only imported dependencies are adapted. The actual transformed Painter.render and
// drawCustom bodies, including their injected imports/transport, execute unchanged.
export async function loadTransformedNative({ enabled = true } = {}) {
  const sources = await nativeSources(), plugin = newPlugin(enabled), events = [], calls = new Map(), modules = new Map();
  const phaseReads = { pass: 0, layer: 0 };
  const transport = { allocations: 0, writes: 0 };
  const wrappedAuthority = Object.fromEntries(Object.entries(authority).map(([name, work]) => [name, (...args) => {
    calls.set(name, (calls.get(name) ?? 0) + 1); events.push(name); return work(...args);
  }]));
  class FrameRenderContext {
    constructor(options) {
      let pass = options.currentPass, layer = 0;
      Object.defineProperties(this, {
        currentPass: { get() { phaseReads.pass++; return pass; }, set(value) { pass = value; } },
        currentLayer: { get() { phaseReads.layer++; return layer; }, set(value) { layer = value; } }
      });
      Object.assign(this, options); this.isRenderingToTexture = false; this.depthRangeFor3D = [0, 1];
    }
    clearStencil() { this.context.clear({ stencil: 0 }); }
    setDepthRangeFor3D() { this.depthRangeFor3D = [0, 0.99]; }
    opaquePassEnabledForLayer() { return this.currentLayer < this.opaquePassCutoff; }
    renderTileClippingMasks() {}
    colorModeForRenderPass() { return {}; }
    getDepthModeFor3D() { return { func: 'LEQUAL', mask: true, range: this.depthRangeFor3D }; }
    getDepthModeForSublayer() { return { func: 'LEQUAL', mask: false, range: [0, 1] }; }
  }
  const dependencies = { FrameRenderContext, Color: { black: {}, transparent: {} },
    updateFrameUniformBuffer(buffer) { buffer.upload(); }, releaseProjectionUniformBuffers() { events.push('release-projection'); },
    selectDebugSource: () => ({}), DepthMode: { ReadOnly: false, disabled: {} }, StencilMode: { disabled: {} },
    OverscaledTileID: class { constructor(z, wrap, canonicalZ, x, y) { this.canonical = { z: canonicalZ, x, y }; this.wrap = wrap; } },
    drawTerrainHeightMap() { assert.fail('terrain height work is outside the phase-hook fixture'); } };
  const inert = name => function () { assert.fail(`Unexpected native dependency ${name}`); };
  async function imported(specifier, importer) {
    if (specifier === registryId || specifier === pathToFileURL(registryId).href) return wrappedAuthority;
    const resolved = await plugin.resolveId?.(specifier, importer);
    const id = typeof resolved === 'string' ? resolved : resolved?.id;
    if (id) {
      if (!modules.has(id)) {
        const loaded = await plugin.load(id), code = typeof loaded === 'string' ? loaded : loaded?.code;
        assert.equal(typeof code, 'string', 'injected module is supplied by the real transform plugin');
        modules.set(id, evaluate(code, id));
      }
      return modules.get(id);
    }
    const absolute = specifier.startsWith('.') ? resolve(dirname(importer), specifier) : specifier;
    if (absolute === registryId) return wrappedAuthority;
    assert.ok(!specifier.includes('native-frame'), `unresolved hook dependency ${specifier}`);
    return new Proxy(dependencies, { get: (target, name) => name === 'then' ? undefined : target[name] ?? inert(String(name)) });
  }
  async function evaluate(source, id, explicitNames) {
    let javascript = stripTypeScriptTypes(source, { mode: 'transform' });
    const bindings = {};
    if (!explicitNames) bindings.WeakMap = class extends WeakMap {
      constructor(...args) { super(...args); transport.allocations++; }
      set(key, value) { transport.writes++; return super.set(key, value); }
    };
    const imports = [...javascript.matchAll(/^import\s+([\s\S]*?)\s+from\s+(['"])(.*?)\2\s*;?/gm)];
    for (const match of imports) {
      const namespace = await imported(match[3], id), clause = match[1].trim();
      if (clause.startsWith('{')) {
        for (const field of clause.slice(1, -1).split(',').map(value => value.trim()).filter(Boolean)) {
          const [name, local = name] = field.split(/\s+as\s+/u); bindings[local] = namespace[name];
        }
      } else if (clause.startsWith('* as ')) bindings[clause.slice(5)] = namespace;
      else { assert.ok(!clause.includes(','), 'fixture uses explicit single default or named imports'); bindings[clause] = namespace.default; }
      javascript = javascript.replace(match[0], '');
    }
    assert.doesNotMatch(javascript, /^import\b/mu, 'no injected import is silently stripped or skipped');
    const exports = explicitNames ? explicitNames.map(name => [name, name]) :
      [...javascript.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let)\s+(\w+)/gm)].map(match => [match[1], match[1]]);
    for (const match of javascript.matchAll(/^export\s*\{([^}]+)\}\s*;?/gm)) {
      for (const field of match[1].split(',').map(value => value.trim()).filter(Boolean)) {
        const [local, name = local] = field.split(/\s+as\s+/u); exports.push([name, local]);
      }
    }
    javascript = javascript.replace(/^export\s*\{[^}]*\}\s*;?/gm, '').replace(/^export\s+(?=(?:async\s+)?(?:function|class|const|let)\b)/gm, '');
    assert.doesNotMatch(javascript, /^export\b/mu, 'the transport has no unhandled export form');
    return new Function(...Object.keys(bindings), `${javascript}\nreturn {${exports.map(([name, local]) => `${JSON.stringify(name)}:${local}`).join(',')}};`)(...Object.values(bindings));
  }
  const native = {};
  for (const [name, relative] of Object.entries(sourcePaths)) {
    const id = join(upstreamRoot, 'src', relative), result = await plugin.transform(sources[name], id);
    const code = result?.code ?? sources[name];
    Object.assign(native, await evaluate(code, id, [name === 'painter' ? 'Painter' : 'drawCustom']));
  }
  return { ...native, plugin, sources, events, calls, phaseReads, transport, authority };
}

// Scalar/native dependency adapters for executing the real render methods. This
// fixture records call order and query evidence; it does not rasterize pixels.
export function nativePaintFixture(native, { registry = authority, gpu = createSceneCompletionGl() } = {}) {
  const { gl } = gpu, events = native.events ?? [], hooks = {}, captures = [], renderInputs = [], renderReceivers = [];
  let projectionReads = 0, renderingReads = 0, offscreen = false, tile = false, renderResult = 'native-result';
  const layerReads = { id: 0, type: 0 };
  const projectionData = () => ({ mainMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    fallbackMatrix: [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 1 / 1000, 0, -1, 1, 0, 1],
    tileMercatorCoords: [0, 0, 1 / 8192, 1 / 8192], clippingPlane: [0, 0, 1, -1 / 3], projectionTransition: 0 });
  const transform = { zoom: 0, pitch: 0, width: 640, height: 480, pixelsToGLUnits: [1 / 320, 1 / 240], cameraToCenterDistance: 1,
    farZ: 1000, nearZ: 0.1, fov: 45, modelViewProjectionMatrix: projectionData().mainMatrix, projectionMatrix: projectionData().mainMatrix,
    getProjectionDataForCustomLayer: projectionData, getProjectionData: projectionData };
  const context = { gl, programCache: {}, freeProjectionUniformBuffers: [], keyedProjectionUniformBuffers: new Map(),
    frameUniformBuffer: { pending: new Float32Array(64), context: { gl }, upload() { events.push('uniform'); hooks.work?.(); } },
    viewport: { set: value => gl.viewport(...value), get: () => [0, 0, 640, 480] },
    bindFramebuffer: { set(value) { events.push('framebuffer'); gl.bindFramebuffer(gl.FRAMEBUFFER, value); }, get: () => null },
    clear() { events.push('clear'); }, setColorMode() {}, setStencilMode() {},
    setDepthMode(mode) { if (mode.func !== undefined) gl.depthFunc(mode.func); if (mode.range) gl.depthRange(...mode.range); },
    setCustomLayerDefaults() {
      gpu.state.set(gl.READ_FRAMEBUFFER_BINDING, null); gpu.state.set(gl.DRAW_FRAMEBUFFER_BINDING, null);
      for (const name of ['RASTERIZER_DISCARD', 'STENCIL_TEST', 'POLYGON_OFFSET_FILL', 'SAMPLE_ALPHA_TO_COVERAGE', 'SAMPLE_COVERAGE']) gpu.enabled.delete(gl[name]);
    },
    setDirty() { events.push('dirty'); }, setDefault() { events.push('reset'); hooks.reset?.(); } };
  const implementation = { renderingMode: '3d', prerender() { events.push('prerender'); hooks.prerender?.(); },
    renderToTerrainTile() { events.push('terrain-tile'); hooks.tile?.(); } };
  const originalRender = function (actualGl, args) {
    assert.equal(actualGl, gl); renderInputs.push(args); renderReceivers.push(this); events.push('render');
    const capture = registry.captureNativeFrameAuthority(gl, implementation, originalRender, args); captures.push(capture);
    hooks.render?.(capture, args); return renderResult;
  };
  Object.defineProperty(implementation, 'render', { configurable: true, get() { renderingReads++; return originalRender; } });
  const styleLayer = (id, implementation, hasOffscreenPass = () => offscreen) => ({
    get id() { layerReads.id++; return id; }, get type() { layerReads.type++; return 'custom'; },
    implementation, is3D: () => true, isHidden: () => false, hasOffscreenPass, isTileClipped: () => false });
  const layer = styleLayer('scene', implementation);
  const style = { map: { terrain: null }, _order: ['scene'], _layers: { scene: layer }, tileManagers: {},
    imageManager: { beginFrame() { events.push('images'); } }, projection: { get name() { projectionReads++; hooks.projection?.(); return 'mercator'; } } };
  const data = { showOverdrawInspector: false, showTileBoundaries: false, showPadding: false, isRenderingGlobe: false,
    projectionTransition: 0, moving: false, pixelRatio: 1, fadeDuration: 0, symbolFadeChange: 0,
    projectionShaderVariant: { name: 'mercator', define: '#define PROJECTION_MERCATOR', prelude: {
      vertexSource: 'vec4 projectTileFor3D(vec2 p, float z) { return u_projection_fallback_matrix * vec4(p, z, 1.0); }' } } };
  const painter = Object.assign(Object.create(native.Painter.prototype), { context, width: 640, height: 480, programCache: {},
    renderToTexture: undefined, drawFunctions: { atmosphere() { events.push('tail'); hooks.tail?.(); },
      debugPadding() { events.push('tail'); hooks.tail?.(); }, sky() {} },
    maybeDrawDepth() { events.push('depth'); }, setBaseState() { events.push('base'); }, clearRTTPool() {},
    renderLayer(self, manager, currentLayer, coords, frame) {
      if (currentLayer.type !== 'custom') return;
      frame.isRenderingToTexture = tile;
      native.drawCustom(self, manager, currentLayer, coords ?? [{ canonical: { z: 0, x: 0, y: 0 }, wrap: 0 }], frame);
    } });
  return { gl, gpu, registry, context, painter, style, transform, data, implementation, originalRender, layer, styleLayer, layerReads, hooks, events, captures, renderInputs, renderReceivers,
    get projectionReads() { return projectionReads; }, get renderingReads() { return renderingReads; },
    setOffscreen(value) { offscreen = value; }, setTile(value) { tile = value; }, setRenderResult(value) { renderResult = value; },
    render() { return painter.render(style, transform, data); },
    enroll() { return registry.registerNativeFrameDemand(gl, implementation, originalRender); } };
}

export async function attachBuiltBridge(item, createSceneBridge, completion = true) {
  const base = completionInput();
  const allocation = { ...base.renderInput.allocation, width: item.transform.width, height: item.transform.height,
    pixelRatio: item.data.pixelRatio, padding: { top: 0, right: 0, bottom: 0, left: 0 } };
  const input = freeze({ ...base, renderInput: { ...base.renderInput, allocation } });
  const nativeListeners = new Map(), layers = new Map(), completed = [], errors = [];
  const { gl, gpu, style } = item; let serial = 0;
  const backing = [Math.round(allocation.width * allocation.pixelRatio), Math.round(allocation.height * allocation.pixelRatio)];
  assert.deepEqual([gl.canvas.width, gl.canvas.height], backing, 'bridge allocation matches the native canvas');
  assert.deepEqual([gl.drawingBufferWidth, gl.drawingBufferHeight], backing, 'bridge allocation matches the native drawing buffer');
  assert.deepEqual(item.context.viewport.get(), [0, 0, ...backing], 'bridge allocation matches the native viewport');
  gl.canvas.ownerDocument = { hidden: false, defaultView: { requestAnimationFrame: callback => gpu.raf.request(callback),
    cancelAnimationFrame: id => gpu.raf.cancel(id), performance: { now: () => gpu.raf.now() } }, addEventListener() {}, removeEventListener() {} };
  style._order = []; style._layers = {};
  const map = { getCanvas: () => gl.canvas, isStyleLoaded: () => true, loaded: () => true, isMoving: () => false,
    getCenter: () => ({ lng: 0, lat: 0 }), getZoom: () => 0, getPitch: () => 0, getBearing: () => 0,
    getTerrain: () => null, getProjection: () => ({ type: 'mercator' }), prepareFeatures: () => Promise.resolve(),
    getLayer: id => layers.get(id)?.handle,
    addLayer(layer) { layers.set(layer.id, { layer, handle: Object.freeze({ id: layer.id }) });
      style._order.push(layer.id); style._layers[layer.id] = item.styleLayer(layer.id, layer, () => Boolean(layer.prerender));
      layer.onAdd?.(map, gl); },
    removeLayer(id) { const old = layers.get(id); layers.delete(id); style._order = style._order.filter(value => value !== id);
      delete style._layers[id]; old?.layer.onRemove?.(map, gl); }, triggerRepaint() {},
    on(name, callback) { if (!nativeListeners.has(name)) nativeListeners.set(name, new Set()); nativeListeners.get(name).add(callback); return map; },
    off(name, callback) { nativeListeners.get(name)?.delete(callback); return map; } };
  const host = { captureRenderInput: () => input.renderInput, subscribeRenderInput: () => () => {}, isCurrent: () => true,
    signal: new AbortController().signal, onState() {}, onError: error => errors.push(error) };
  if (completion) host.completion = { captureInput: () => input, subscribeInput: () => () => {},
    claimPaintSerial: expected => expected === input ? ++serial : undefined,
    captureCameraFacts: expected => expected === input ? cameraFacts({ zoom: item.transform.zoom }) : undefined };
  const bridge = createSceneBridge(map, host);
  if (completion) { bridge.completion.subscribeCompletedFrames(frame => completed.push(frame)); bridge.completion.watchTarget('anchor'); }
  await flushNativeBuild();
  return { bridge, map, input, layers, completed, errors,
    async paint() { item.render(); for (const callback of nativeListeners.get('render') ?? []) callback(); await flushNativeBuild(); },
    async settle() { gpu.settleQueries(true); gpu.signal(); gpu.raf.step(); await flushNativeBuild(); },
    close() { bridge.dispose(); } };
}
