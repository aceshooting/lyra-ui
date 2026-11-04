import { createEpochGeographicServices, createGeographicFrameLease } from './frame.mjs';
import { createLayerLifetime } from './lifetime.mjs';

const fail = () => { throw new TypeError('Scene layer is unavailable.'); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const viewEvents = ['move', 'resize', 'terrain', 'projectiontransition'];
const codes = new Set(['invalid', 'engine', 'render']);
let sequence = 0;

function field(value, key, optional = false) {
  if (!value || typeof value !== 'object') fail();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) { if (optional) return undefined; fail(); }
  if (!Object.hasOwn(descriptor, 'value')) fail();
  return descriptor.value;
}
function optionalFunction(value, key) {
  const result = field(value, key, true);
  if (result !== undefined && typeof result !== 'function') fail();
  return result;
}

/** Copies one validated pick result; anything else establishes no hit. */
function readPick(value) {
  if (value === null || typeof value !== 'object') return null;
  try {
    const id = field(value, 'id'), position = field(value, 'position', true);
    if (!text(id)) return null;
    if (position === undefined) return Object.freeze({ id });
    const lngLat = field(position, 'lngLat'), altitude = field(position, 'altitude', true);
    const reference = field(position, 'altitudeReference', true);
    if (!Array.isArray(lngLat) || lngLat.length !== 2 || !lngLat.every(finite) || altitude !== undefined && !finite(altitude) ||
        reference !== undefined && reference !== 'sea-level' && reference !== 'terrain') return Object.freeze({ id });
    return Object.freeze({ id, position: Object.freeze({ lngLat: Object.freeze([lngLat[0], lngLat[1]]),
      ...(altitude === undefined ? {} : { altitude }), ...(reference === undefined ? {} : { altitudeReference: reference }) }) });
  } catch { return null; }
}

/**
 * Installs one trusted custom 3D layer on a native map through its own custom-layer support.
 * The layer receives the map's WebGL2 context, geographic services and per-frame projection
 * matrices; each mount epoch (first install, style replacement, context restoration) creates a
 * fresh instance and retires the previous one.
 */
export function createSceneLayer(map, layer, host) {
  for (const name of ['addLayer', 'removeLayer', 'getLayer', 'getCanvas', 'isStyleLoaded', 'triggerRepaint',
    'getCenter', 'getZoom', 'on', 'off']) if (typeof map?.[name] !== 'function') fail();
  const id = field(layer, 'id'), label = field(layer, 'label'), create = field(layer, 'create'), before = field(layer, 'before', true);
  const signal = field(host, 'signal'), onState = optionalFunction(host, 'onState'), reducedMotion = optionalFunction(host, 'reducedMotion');
  if (!text(id) || !text(label) || typeof create !== 'function' || before !== undefined && !text(before) ||
      !signal || typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function') fail();
  const canvas = map.getCanvas();
  if (!canvas || typeof canvas.addEventListener !== 'function' || typeof canvas.removeEventListener !== 'function') fail();
  const nativeId = `scene-layer-${++sequence}`, owner = new AbortController(), roots = new Map(), listeners = [];
  let disposed = false, lost = false, awaitingStyle = false, waiting = false, visible = true;
  let viewRevision = 1, requestRevision = 0, request, instance, layout;

  function notify(state, code) {
    if (disposed) return;
    try { if (code === undefined) onState?.(state); else onState?.(state, code); } catch { /* Host callbacks cannot escape native drawing. */ }
  }
  function readView() {
    const center = map.getCenter(), zoom = map.getZoom();
    if (!finite(center?.lng) || !finite(zoom)) fail();
    layout = Object.freeze({ revision: viewRevision, tileZoom: Math.max(0, Math.min(30, Math.floor(zoom))), centerLongitude: center.lng });
  }
  function resolveTerrain(lngLat) {
    let terrain;
    try { terrain = map.getTerrain?.(); } catch { terrain = undefined; }
    if (!terrain || typeof map.queryTerrainElevation !== 'function') return { status: 'terrain-unavailable' };
    // The engine's query includes displayed exaggeration; a missing DEM tile is still loading.
    const height = map.queryTerrainElevation([lngLat[0], lngLat[1]]);
    return finite(height) ? { status: 'resolved', height } : { status: 'terrain-pending' };
  }
  const live = () => !disposed && !lost && !signal.aborted;
  const lifetime = createLayerLifetime(map, {
    signal: owner.signal,
    isCurrent: value => live() && value === request,
    // A committed native layer keeps its style; source loading does not revoke it.
    isStyleReady: () => !awaitingStyle && (map.getLayer(nativeId) !== undefined || map.isStyleLoaded() !== false),
    onState: (_id, state, code) => notify(state, code),
    onError(_id, code) { instance = undefined; notify('unavailable', codes.has(code) ? code : 'render'); }
  }, {
    prepare: (native, nativeSignal) => typeof map.prepareFeatures === 'function'
      ? map.prepareFeatures({ layers: [native] }, { signal: nativeSignal }) : Promise.resolve(),
    geographic(epoch, nativeSignal) {
      roots.clear();
      const services = createEpochGeographicServices({ epoch, isCurrent: () => live() && !nativeSignal.aborted,
        layout: () => layout, resolveTerrain });
      roots.set(epoch, services);
      return services;
    },
    openFrame(args, epoch, nativeSignal) {
      const services = roots.get(epoch), getProjectionData = args?.getProjectionData;
      if (!services || typeof getProjectionData !== 'function') fail();
      const ratio = typeof map.getPixelRatio === 'function' ? map.getPixelRatio() : 1;
      let open = true;
      const lease = createGeographicFrameLease({ services, epoch, revision: viewRevision,
        time: performance.now(), width: canvas.width / ratio, height: canvas.height / ratio, pixelRatio: ratio,
        reducedMotion: Boolean(reducedMotion?.()), isCurrent: () => open && live() && !nativeSignal.aborted,
        projectionFor(origin) {
          const data = getProjectionData.call(args, { tileID: { canonical: { z: origin.tile.z, x: origin.tile.x, y: origin.tile.y },
            wrap: origin.tile.wrap }, applyGlobeMatrix: true, applyTerrainMatrix: false });
          return { ...data, shaderData: args.shaderData };
        } });
      return Object.freeze({ frame: lease.frame, terrainHook: undefined, close() { open = false; lease.close(); } });
    },
    // The native engine marks its cached GL state dirty after every custom-layer callback.
    withState: (_gl, work) => work()
  });
  function remount() {
    if (!live()) return;
    instance = undefined; waiting = false;
    try { readView(); } catch { notify('unavailable', 'engine'); return; }
    const value = request = Object.freeze({ descriptor: Object.freeze({ id: nativeId, label,
      create(context) { const result = create(context); if (request === value) instance = result; return result; },
      ...(before === undefined ? {} : { before }) }), revision: ++requestRevision, styleRevision: 1 });
    void lifetime.mount(value).then(() => {
      // A style that was still loading leaves the request desired; the next render retries it.
      if (request === value && live() && !awaitingStyle && map.getLayer(nativeId) === undefined) waiting = true;
    });
  }
  function retire(reason) { instance = undefined; lifetime.invalidate(reason); }
  function viewChanged() {
    if (!live()) return;
    viewRevision++;
    try { readView(); } catch { notify('unavailable', 'engine'); }
  }
  function styleReady() {
    if (!live() || !awaitingStyle) return;
    awaitingStyle = false; remount();
  }
  function rendered() {
    if (!waiting || !live() || awaitingStyle || map.isStyleLoaded() === false) return;
    remount();
  }
  function contextLost() {
    if (!live()) return;
    lost = true; retire('context-lost'); notify('unavailable', 'context-lost');
  }
  function contextRestored() {
    if (disposed || signal.aborted || !lost) return;
    lost = false; viewRevision++; remount();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; instance = undefined; request = undefined; roots.clear();
    signal.removeEventListener('abort', dispose);
    for (const [name, listener] of listeners) { try { map.off(name, listener); } catch { /* The native map may be removed. */ } }
    canvas.removeEventListener('webglcontextlost', contextLost);
    canvas.removeEventListener('webglcontextrestored', contextRestored);
    owner.abort(); lifetime.dispose();
  }
  const listen = (name, listener) => { listeners.push([name, listener]); map.on(name, listener); };
  for (const name of viewEvents) listen(name, viewChanged);
  listen('style.load', styleReady);
  listen('render', rendered);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  signal.addEventListener('abort', dispose, { once: true });
  if (signal.aborted) dispose(); else remount();

  return Object.freeze({
    invalidateStyle() {
      if (!live()) return;
      awaitingStyle = true; waiting = false; retire('style');
    },
    styleReady,
    requestFrame() {
      if (!live() || !visible) return;
      try { map.triggerRepaint(); } catch { notify('unavailable', 'engine'); }
    },
    setVisible(value) { visible = Boolean(value); lifetime.setVisible(visible); },
    async pick(point) {
      const target = instance, revision = viewRevision;
      if (!live() || !target || typeof target.pick !== 'function' || !Array.isArray(point) || point.length !== 2 ||
          !point.every(finite)) return null;
      let result;
      try { result = await target.pick(Object.freeze([point[0], point[1]]), revision); } catch { return null; }
      // A newer view, epoch or removal makes the completed GPU result stale.
      return live() && instance === target && revision === viewRevision ? readPick(result) : null;
    },
    items() {
      const target = instance;
      if (!live() || !target || typeof target.items !== 'function') return Object.freeze([]);
      try {
        const values = target.items();
        if (!Array.isArray(values)) return Object.freeze([]);
        return Object.freeze(values.flatMap(value => {
          const pick = readPick(value), itemLabel = value && typeof value === 'object' ? value.label : undefined;
          return pick?.position && text(itemLabel) ? [Object.freeze({ id: pick.id, label: itemLabel, position: pick.position })] : [];
        }));
      } catch { return Object.freeze([]); }
    },
    dispose
  });
}
