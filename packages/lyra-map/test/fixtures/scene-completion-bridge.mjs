import { createSceneBridge } from '../../src/scene/bridge.mjs';
import { hasNativeFrameDemand, beginNativeFrame, enterNativeCustomRender, leaveNativeCustomRender, sealNativeFrame, abortNativeFrame } from '../../src/scene/native-frame-authority.mjs';
import { createSceneCompletionGl } from './scene-completion-gl.mjs';
import { cameraFacts, completionInput, freeze } from './scene-completion-data.mjs';

export const flushCompletion = async () => { for (let index = 0; index < 24; index++) await Promise.resolve(); };
const events = () => {
  const callbacks = new Map();
  return { add(name, callback) { if (!callbacks.has(name)) callbacks.set(name, new Set()); callbacks.get(name).add(callback); },
    remove(name, callback) { callbacks.get(name)?.delete(callback); },
    emit(name, event = {}) { for (const callback of [...callbacks.get(name) ?? []]) callback(event); } };
};

export function completionBridgeFixture(options = {}) {
  let input = freeze(options.input ?? completionInput()), current = true, serial = 0, bridge, terrain = null;
  let styleGeneration = 1;
  const gpu = createSceneCompletionGl({ pixelRatio: input.renderInput.allocation?.pixelRatio ?? 1.25 });
  const { gl, raf } = gpu, nativeEvents = events(), canvasEvents = events(), documentEvents = events();
  const layers = new Map(), packetListeners = new Set(), completionListeners = new Set(), frames = [], errors = [], states = [];
  const hooks = {}, controller = new AbortController();
  const calls = { add: 0, remove: 0, repaint: 0, completionSubscriptions: 0, claims: 0, camera: 0, phaseFacts: 0, scopes: 0 };
  gl.canvas.ownerDocument = { hidden: false, defaultView: {
    requestAnimationFrame: callback => raf.request(callback), cancelAnimationFrame: handle => raf.cancel(handle), performance: { now: () => raf.now() }
  }, addEventListener: (name, callback) => documentEvents.add(name, callback), removeEventListener: (name, callback) => documentEvents.remove(name, callback) };
  gl.canvas.addEventListener = (name, callback) => canvasEvents.add(name, callback);
  gl.canvas.removeEventListener = (name, callback) => canvasEvents.remove(name, callback);
  const map = {
    getCanvas: () => gl.canvas, isStyleLoaded: () => true, loaded: () => true, isMoving: () => false,
    getCenter: () => ({ lng: 0, lat: 0 }), getZoom: () => 0, getPitch: () => 0, getBearing: () => 0,
    getTerrain: () => terrain, getProjection: () => ({ type: 'mercator' }),
    prepareFeatures: () => Promise.resolve(),
    getLayer: id => layers.get(id)?.handle,
    addLayer(layer) { calls.add++; layers.set(layer.id, { layer, handle: Object.freeze({ id: layer.id }) }); layer.onAdd?.(map, gl); hooks.add?.(); },
    removeLayer(id) { calls.remove++; const old = layers.get(id); layers.delete(id); old?.layer.onRemove?.(map, gl); },
    triggerRepaint() { calls.repaint++; },
    on(name, callback) { nativeEvents.add(name, callback); return map; }, off(name, callback) { nativeEvents.remove(name, callback); return map; }
  };
  const subscribe = (set, callback) => { set.add(callback); return () => set.delete(callback); };
  const host = { signal: controller.signal, isCurrent: () => current,
    captureRenderInput: () => input.renderInput, subscribeRenderInput: callback => subscribe(packetListeners, callback),
    onState: value => states.push(value), onError: value => errors.push(value) };
  const completion = { captureInput() { hooks.capture?.(); return input; },
    subscribeInput(callback) { calls.completionSubscriptions++; return subscribe(completionListeners, callback); },
    claimPaintSerial(expected) { calls.claims++; return expected === input && current ? ++serial : undefined; },
    captureCameraFacts(expected) { calls.camera++; hooks.camera?.(); return expected === input && current ? cameraFacts() : undefined; } };
  if (options.completion !== false) host.completion = completion;
  const args = {
    shaderData: { variantName: 'mercator', define: '#define PROJECTION_MERCATOR',
      vertexShaderPrelude: 'vec4 projectTileFor3D(vec2 p, float z) { return u_projection_fallback_matrix * vec4(p, z, 1.0); }' },
    getProjectionData({ tileID }) { const size = 2 ** tileID.canonical.z;
      return { mainMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        fallbackMatrix: [1 / 4096, 0, 0, 0, 0, -1 / 4096, 0, 0, 0, 0, 1 / 1000, 0, -1, 1, 0, 1],
        tileMercatorCoords: [tileID.canonical.x / size, tileID.canonical.y / size, 1 / (8192 * size), 1 / (8192 * size)],
        clippingPlane: [0, 0, 1, -1 / 3], projectionTransition: 0 }; },
    renderTerrainHeightMap: target => gpu.renderTerrainHeightMap(target)
  };
  const item = { gpu, gl, raf, map, host, completion, layers, frames, states, errors, hooks, calls, args, controller, nativeEvents,
    get input() { return input; }, get bridge() { return bridge; },
    async start(watch = 'anchor') { bridge = createSceneBridge(map, host);
      if (bridge.completion) { bridge.completion.subscribeCompletedFrames(frame => frames.push(frame)); if (watch) bridge.completion.watchTarget(watch); }
      await flushCompletion(); return bridge; },
    replace(next, notify = true) { input = freeze(next); if (notify) {
      for (const callback of [...packetListeners]) callback(); for (const callback of [...completionListeners]) callback(); } },
    expire() { current = false; }, setTerrain(value) { terrain = value; nativeEvents.emit('terrain'); },
    async render(change = {}) {
      // This fixture drives private phase enrollment; query booleans remain synthetic, never pixel proof.
      const entries = [...layers.values()];
      let facts;
      if (hasNativeFrameDemand(gl)) {
        calls.phaseFacts++;
        facts = { styleGeneration,
          orderedLayers: [{ id: 'background', type: 'background' }, ...entries.map(({ layer }) => ({ id: layer.id, type: 'custom' }))],
          terrainEnabled: terrain !== null, projection: 'mercator', projectionTransition: 0, debug: false, tailDraws: false, ...change.facts };
      }
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gpu.state.set(gl.VIEWPORT, [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]);
      gpu.state.set(gl.DEPTH_FUNC, gl.LEQUAL); gpu.state.set(gl.DEPTH_RANGE, [0, 1]);
      gpu.state.set(gl.SCISSOR_BOX, [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]);
      for (const flag of ['RASTERIZER_DISCARD', 'STENCIL_TEST', 'POLYGON_OFFSET_FILL', 'SAMPLE_ALPHA_TO_COVERAGE', 'SAMPLE_COVERAGE']) gpu.enabled.delete(gl[flag]);
      const frame = beginNativeFrame(gl, {}, facts);
      for (let index = 0; index < entries.length; index++) {
        const layer = entries[index].layer; layer.prerender?.call(layer, gl, args);
        const scope = enterNativeCustomRender(frame, layer, layer.render, args, frame ? { pass: 'translucent', currentLayer: index + 1 } : undefined);
        if (scope) calls.scopes++;
        let normal = false;
        try { layer.render.call(layer, gl, args); normal = true; }
        finally { leaveNativeCustomRender(scope, normal); }
      }
      if (change.abort) abortNativeFrame(frame); else if (change.seal !== false) sealNativeFrame(frame);
      nativeEvents.emit('render'); await flushCompletion(); return frame;
    },
    async settle(results = true) { gpu.settleQueries(results); gpu.signal(); raf.step(); await flushCompletion(); },
    async replay() { bridge.invalidateStyle(); styleGeneration++;
      for (const { layer } of [...layers.values()]) map.removeLayer(layer.id); nativeEvents.emit('style.load'); await flushCompletion(); },
    loss() { gpu.lose(); canvasEvents.emit('webglcontextlost', { preventDefault() {} }); },
    restore() { gpu.restore(); canvasEvents.emit('webglcontextrestored'); },
    close() { bridge?.dispose(); }
  };
  return item;
}
