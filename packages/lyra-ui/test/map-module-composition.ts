import type { LyraMapOverlays } from '../src/components/media/map/map.js';

/** Application example, shared by the composition story and its tests. */
export const MAP_MODULE_ORDER = Object.freeze([
  'districts', 'parcels', 'roads', 'transit', 'water', 'sensors', 'alerts', 'selection',
] as const);
export type MapModuleName = typeof MAP_MODULE_ORDER[number];
export type MapModuleSnapshot = Required<LyraMapOverlays>;
export type MapModules = Readonly<Partial<Record<MapModuleName, MapModuleSnapshot>>>;

/** Match descriptor admission limits before publication, without visiting GeoJSON contents.
 * This example accepts plain immutable application descriptors, not canvas/other native objects. */
function validateDescriptors(sources: NonNullable<LyraMapOverlays['sources']>, layers: NonNullable<LyraMapOverlays['layers']>): void {
  if (sources.length > 128 || layers.length > 128) throw new Error('limit');
  let values = 0, text = 0;
  const visiting = new WeakSet<object>();
  const fail = (): never => { throw new Error('invalid-descriptor'); };
  const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const plainArray = (value: unknown): value is unknown[] => Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
  const own = (value: object, key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return undefined;
    if (!Object.hasOwn(descriptor, 'value')) return fail();
    return descriptor.value;
  };
  const safeKey = (key: string): void => { if (['__proto__', 'prototype', 'constructor'].includes(key)) fail(); };
  const addText = (value: string): void => { text += value.length; if (text > 1_048_576) throw new Error('limit'); };
  const walk = (value: unknown, depth: number): void => {
    values += 1;
    if (values > 50_000 || depth > 24) throw new Error('limit');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'string') { addText(value); return; }
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail(); return; }
    if (typeof value !== 'object' || visiting.has(value)) return fail();
    visiting.add(value);
    try {
      if (plainArray(value)) {
        if (value.length > 10_000) throw new Error('limit');
        for (let i = 0; i < value.length; i++) walk(own(value, String(i)), depth + 1);
      } else {
        if (!plain(value)) fail();
        const keys = Object.keys(value);
        if (keys.length > 10_000) throw new Error('limit');
        for (const key of keys) {
          safeKey(key);
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail();
          addText(key); walk(descriptor!.value, depth + 1);
        }
      }
    } finally { visiting.delete(value); }
  };
  for (const { source } of sources) {
    if (!plain(source)) fail();
    const type = own(source, 'type');
    if (typeof type !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(type)) fail();
    const data = own(source, 'data');
    const envelope = plain(data) && (own(data, 'type') === 'FeatureCollection' && plainArray(own(data, 'features')) ||
      own(data, 'type') === 'Feature' && (own(data, 'geometry') === null || plain(own(data, 'geometry'))));
    if (type === 'geojson' && envelope) {
      const keys = Object.keys(source);
      if (keys.length > 10_000) throw new Error('limit');
      for (const key of keys) {
        safeKey(key); addText(key);
        const value = own(source, key);
        if (key !== 'data') walk(value, 1);
      }
      continue;
    }
    walk(source, 0);
  }
  for (const { layer } of layers) {
    if (typeof layer.type !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(layer.type)) fail();
    if (layer['source'] !== undefined && typeof layer['source'] !== 'string') fail();
    walk(layer, 0);
  }
}
function canonicalId(id: string): string {
  if (!id || id !== id.trim() || id.length > 128 || ['__proto__', 'prototype', 'constructor'].includes(id))
    throw new Error('noncanonical-id');
  return id;
}

/** Compose trusted application snapshots. IDs are never rewritten. External dependencies are
 * declared explicitly; callers must refresh those inventories when their basemap changes. */
export function composeMapModules(modules: MapModules, external: {
  readonly sources: readonly string[]; readonly layers: readonly string[];
} = { sources: [], layers: [] }): LyraMapOverlays {
  const sources = MAP_MODULE_ORDER.flatMap(name => modules[name]?.sources ?? []);
  const layers = MAP_MODULE_ORDER.flatMap(name => modules[name]?.layers ?? []);
  validateDescriptors(sources, layers);
  const sourceIds = new Set(external.sources.map(canonicalId)), layerIds = new Set(external.layers.map(canonicalId));
  for (const entry of sources) {
    canonicalId(entry.id);
    if (sourceIds.has(entry.id)) throw new Error(`duplicate-source:${entry.id}`);
    sourceIds.add(entry.id);
  }
  for (const entry of layers) {
    canonicalId(entry.layer.id);
    if (layerIds.has(entry.layer.id)) throw new Error(`duplicate-layer:${entry.layer.id}`);
    layerIds.add(entry.layer.id);
  }
  for (const entry of layers) {
    const source = entry.layer['source'];
    if (typeof source === 'string') canonicalId(source);
    if (entry.before !== undefined) canonicalId(entry.before);
    if (typeof source === 'string' && !sourceIds.has(source)) throw new Error(`missing-source:${source}`);
    if (entry.before !== undefined && !layerIds.has(entry.before)) throw new Error(`missing-layer:${entry.before}`);
  }
  const before = new Map(layers.map(entry => [entry.layer.id, entry.before]));
  for (const { layer } of layers) {
    const seen = new Set<string>(); let next: string | undefined = layer.id;
    while (next !== undefined && before.has(next)) {
      if (seen.has(next)) throw new Error(`cycle:${next}`);
      seen.add(next); next = before.get(next);
    }
  }
  // The component remains responsible for native order planning and bounded descriptor admission.
  return Object.freeze({ sources: Object.freeze(sources), layers: Object.freeze(layers) });
}

/** An application controller calls this once after batching its module changes. Validation runs
 * before the sole assignment; failures leave both the map and the last successful input intact. */
export function createMapModulePublisher(assign: (overlays: LyraMapOverlays) => void) {
  let previous: MapModules | undefined;
  return (modules: MapModules): boolean => {
    if (previous && MAP_MODULE_ORDER.every(name => previous?.[name] === modules[name])) return false;
    const overlays = composeMapModules(modules);
    assign(overlays);
    previous = Object.freeze({ ...modules });
    return true;
  };
}

/** Each controller publishes fresh immutable descriptors while retaining its large data object. */
export function createMapModule(name: MapModuleName, data: object, color: string): MapModuleSnapshot {
  const sourceId = `city:${name}:data`, layerId = `city:${name}:fill`;
  return Object.freeze({
    sources: Object.freeze([Object.freeze({ id: sourceId, source: Object.freeze({ type: 'geojson', data }) })]),
    layers: Object.freeze([Object.freeze({ interactive: true, layer: Object.freeze({
      id: layerId, type: 'fill', source: sourceId, paint: Object.freeze({
        'fill-color': Object.freeze(['coalesce', Object.freeze(['feature-state', 'color']), color]), 'fill-opacity': 1,
      }),
    }) })]),
  });
}

export function createMapModuleDemo(color: string): MapModules {
  return Object.freeze(Object.fromEntries(MAP_MODULE_ORDER.map((name, index) => {
    const x = index % 4 * 3 - 6, y = Math.floor(index / 4) * 3 - 3;
    const data = Object.freeze({ type: 'FeatureCollection', features: Object.freeze([Object.freeze({
      type: 'Feature', id: 1, properties: Object.freeze({ name }), geometry: Object.freeze({
        type: 'Polygon', coordinates: Object.freeze([Object.freeze([[x, y], [x + 2, y], [x + 2, y + 2], [x, y + 2], [x, y]].map(point => Object.freeze(point)))]),
      }),
    })]) });
    return [name, createMapModule(name, data, color)];
  })));
}
