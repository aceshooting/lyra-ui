import type { MapLibreMapCapability } from './map-loader.js';
import { sceneLineGrounded } from './map-scene-lines.js';
import type { SceneLineData, SceneLineObject } from './map-scene-lines.js';
import type { SceneDrawOutcome } from './map-scene-status.js';

/** Accepted lines with owned data, or the reason they cannot be drawn. */
export type SceneLineRequest =
  | { readonly revision: number; readonly objects: readonly SceneLineObject[]; readonly data: SceneLineData }
  | { readonly revision: number; readonly failure: 'engine' | 'limit' };

export interface MapSceneLineLayer {
  /** Replaces the owned request; undefined removes every owned native resource. */
  update(request: SceneLineRequest | undefined): void;
  /** The current style finished loading, including after a replacement. */
  styleReady(): void;
  /** Call before replacing the native style. */
  invalidateStyle(): void;
  capture(): { readonly revision: number | undefined; readonly outcome: SceneDrawOutcome };
  dispose(): void;
}

const EMPTY_DATA = Object.freeze({ type: 'FeatureCollection', features: Object.freeze([]) });
const LAYOUT = Object.freeze({ 'line-join': 'round', 'line-cap': 'round' });
const PAINT = Object.freeze({ 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': ['get', 'opacity'] });
/** Marker glyphs render above lines; see `@aceshooting/lyra-map/scene`. */
const MARKER_LAYER = /^scene-markers-\d+$/;
let sequence = 0;

function terrainActive(map: MapLibreMapCapability): boolean {
  try { const terrain = map.getTerrain?.(); return terrain !== null && terrain !== undefined; } catch { return false; }
}

/**
 * Owns one GeoJSON source and one data-driven line layer for a scene's paths and arcs. A style
 * replacement removes both; `styleReady()` reinstalls the latest request. Every asynchronous step is
 * fenced by an epoch so a superseded preparation never mutates the map.
 */
export function createMapSceneLineLayer(options: {
  readonly map: MapLibreMapCapability;
  readonly isCurrent: () => boolean;
  readonly styleLoaded: () => boolean;
  readonly changed: () => void;
}): MapSceneLineLayer {
  const { map } = options;
  const canvas = (() => { try { return map.getCanvas(); } catch { return undefined; } })();
  let request: SceneLineRequest | undefined, ids: { readonly source: string; readonly layer: string } | undefined;
  let phase: 'pending' | 'installed' | 'failed' = 'pending', failure: 'engine' | 'limit' = 'engine';
  let epoch = 0, disposed = false, awaitingStyle = false, contextLost = false, abort: AbortController | undefined;

  const current = (): boolean => !disposed && options.isCurrent();
  function notify(): void { if (current()) { try { options.changed(); } catch { /* Status observers cannot retire owned resources. */ } } }
  function cancel(): void { epoch++; abort?.abort(); abort = undefined; }
  function remove(): void {
    const owned = ids;
    if (!owned) return;
    try { if (map.getLayer(owned.layer)) map.removeLayer(owned.layer); } catch { /* A replaced style already removed it. */ }
    try { if (map.getSource(owned.source)) map.removeSource(owned.source); } catch { /* A replaced style already removed it. */ }
  }
  function allocate(): { readonly source: string; readonly layer: string } {
    for (let attempt = 0; attempt < 512; attempt++) {
      const source = `lr-scene-lines-${++sequence}`, layer = `${source}-line`;
      if (!map.getSource(source) && !map.getLayer(source) && !map.getLayer(layer)) return Object.freeze({ source, layer });
    }
    throw new Error('Scene line identifiers are unavailable.');
  }
  function before(): string | undefined {
    const layers = map.getStyle?.()?.layers;
    return Array.isArray(layers) ? layers.find(layer => typeof layer?.id === 'string' && MARKER_LAYER.test(layer.id))?.id : undefined;
  }
  function fail(): void {
    if (disposed) return;
    cancel(); remove(); phase = 'failed'; failure = 'engine'; notify();
  }

  async function install(data: SceneLineData, attempt: number, signal: AbortSignal): Promise<void> {
    const live = () => current() && attempt === epoch && !signal.aborted && !awaitingStyle && options.styleLoaded();
    try {
      if (typeof map.prepareFeatures === 'function') {
        const owned = ids ?? { source: 'lr-scene-lines', layer: 'lr-scene-lines-line' };
        await map.prepareFeatures({ sources: { [owned.source]: { type: 'geojson', data: EMPTY_DATA } },
          layers: [{ id: owned.layer, type: 'line', source: owned.source }] }, { signal });
      }
      if (!live()) return;
      remove();
      const owned = ids = allocate();
      map.addSource(owned.source, { type: 'geojson', data });
      if (!live()) { remove(); return; }
      map.addLayer({ id: owned.layer, type: 'line', source: owned.source, layout: LAYOUT, paint: PAINT }, before());
      if (!live()) { remove(); return; }
      if (!map.getSource(owned.source) || !map.getLayer(owned.layer)) throw new Error('Scene lines were not installed.');
      phase = 'installed'; abort = undefined; notify();
    } catch {
      if (current() && attempt === epoch && !signal.aborted) fail();
    }
  }

  function apply(): void {
    if (!current()) return;
    const next = request;
    cancel();
    if (!next) { remove(); ids = undefined; phase = 'pending'; notify(); return; }
    if ('failure' in next) { remove(); phase = 'failed'; failure = next.failure; notify(); return; }
    if (awaitingStyle || !options.styleLoaded()) { phase = 'pending'; notify(); return; }
    const owned = ids;
    if (owned && phase !== 'failed') {
      try {
        const source = map.getSource(owned.source);
        if (source && map.getLayer(owned.layer) && typeof source.setData === 'function') {
          source.setData(next.data);
          if (!current() || request !== next) return;
          phase = 'installed'; notify(); return;
        }
      } catch { fail(); return; }
    }
    phase = 'pending'; notify();
    const controller = abort = new AbortController(), attempt = epoch;
    void install(next.data, attempt, controller.signal);
  }

  const terrainChanged = () => { if (current() && phase === 'installed') notify(); };
  const lost = () => { if (!current()) return; contextLost = true; notify(); };
  const restored = () => { if (!current()) return; contextLost = false; apply(); };
  try { Reflect.apply(map.on, map, ['terrain', terrainChanged]); } catch { /* Terrain is also read on every capture. */ }
  canvas?.addEventListener('webglcontextlost', lost);
  canvas?.addEventListener('webglcontextrestored', restored);

  return {
    update(value) {
      if (disposed) return;
      request = value;
      apply();
    },
    styleReady() {
      if (disposed) return;
      awaitingStyle = false;
      if (request) apply();
    },
    invalidateStyle() {
      if (disposed) return;
      cancel(); awaitingStyle = true;
      if (phase === 'installed') { phase = 'pending'; notify(); }
    },
    capture() {
      const revision = request?.revision;
      if (!request) return { revision, outcome: { state: 'none' } };
      if (phase === 'failed') return { revision, outcome: { state: 'failed', code: failure } };
      if (contextLost) return { revision, outcome: { state: 'failed', code: 'context-lost' } };
      if (phase !== 'installed' || 'failure' in request) return { revision, outcome: { state: 'pending' } };
      const terrain = terrainActive(map);
      return { revision, outcome: { state: 'drawn', approximate: request.objects.some(object => !sceneLineGrounded(object, terrain)) } };
    },
    dispose() {
      if (disposed) return;
      cancel(); disposed = true;
      try { map.off?.('terrain' as never, terrainChanged); } catch { /* The native map is being removed. */ }
      canvas?.removeEventListener('webglcontextlost', lost);
      canvas?.removeEventListener('webglcontextrestored', restored);
      remove(); ids = undefined; request = undefined;
    },
  };
}
