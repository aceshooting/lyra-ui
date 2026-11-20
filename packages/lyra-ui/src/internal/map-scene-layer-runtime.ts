import type { LyraMapCustomLayer, LyraMapCustomLayerCode, LyraMapCustomLayerPick } from './map-custom-layer-types.js';
import { resolveOptionalPeerCapability } from './optional-peer-capabilities.js';

/** The engine-side handle `createSceneLayer()` returns. */
export interface MapSceneLayerHandle {
  invalidateStyle(): void;
  styleReady(): void;
  requestFrame(): void;
  setVisible(visible: boolean): void;
  pick(point: readonly [number, number]): Promise<LyraMapCustomLayerPick | null>;
  dispose(): void;
}
interface MapSceneLayerHost {
  readonly signal: AbortSignal;
  readonly onState?: (state: 'loading' | 'ready' | 'unavailable', code?: LyraMapCustomLayerCode) => void;
  readonly reducedMotion?: () => boolean;
}
export interface MapSceneLayerRuntime {
  createSceneLayer(map: object, layer: LyraMapCustomLayer, host: MapSceneLayerHost): MapSceneLayerHandle;
}

const handleMethods = ['invalidateStyle', 'styleReady', 'requestFrame', 'setVisible', 'pick', 'dispose'] as const;

function isMapSceneLayerRuntime(value: unknown): value is MapSceneLayerRuntime {
  return typeof value === 'object' && value !== null && 'createSceneLayer' in value && typeof value.createSceneLayer === 'function';
}
/** Rejects a factory result that lacks any lifecycle method the owner calls. */
export function isMapSceneLayerHandle(value: unknown): value is MapSceneLayerHandle {
  return typeof value === 'object' && value !== null && handleMethods.every(name => typeof Reflect.get(value, name) === 'function');
}

/** Validates the optional namespace's custom-layer bridge before it enters the shared cache. */
export function resolveMapSceneLayerRuntime(namespace: unknown): MapSceneLayerRuntime {
  const runtime = resolveOptionalPeerCapability(namespace, isMapSceneLayerRuntime);
  if (!runtime) throw new TypeError('Map custom layers are unavailable');
  return runtime;
}

/**
 * Loads the optional custom-layer bridge from `@aceshooting/lyra-map/scene` on first use. A failed
 * import or a module without `createSceneLayer` rejects and is retried by the next call. The cache
 * keeps the shape of `mapFeatureLoader` without importing it, because this module is reached only
 * from on-demand chunks.
 */
export const loadMapSceneLayerRuntime = Object.assign((): Promise<MapSceneLayerRuntime> => {
  const cache = loadMapSceneLayerRuntime;
  if (cache.pending) return cache.pending;
  const attempt = cache.importer();
  cache.pending = attempt;
  attempt.catch(() => { if (cache.pending === attempt) cache.pending = undefined; });
  return attempt;
}, {
  importer: (): Promise<MapSceneLayerRuntime> => import('@aceshooting/lyra-map/scene').then(resolveMapSceneLayerRuntime),
  pending: undefined as Promise<MapSceneLayerRuntime> | undefined,
  loaded: undefined as MapSceneLayerRuntime | undefined,
});
