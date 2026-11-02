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
export interface MapSceneLayerHost {
  readonly signal: AbortSignal;
  readonly onState?: (state: 'loading' | 'ready' | 'unavailable', code?: LyraMapCustomLayerCode) => void;
  readonly reducedMotion?: () => boolean;
}
export interface MapSceneLayerRuntime {
  createSceneLayer(map: object, layer: LyraMapCustomLayer, host: MapSceneLayerHost): MapSceneLayerHandle;
}

const handleMethods = ['invalidateStyle', 'styleReady', 'requestFrame', 'setVisible', 'pick', 'dispose'] as const;

export function isMapSceneLayerRuntime(value: unknown): value is MapSceneLayerRuntime {
  return typeof value === 'object' && value !== null && 'createSceneLayer' in value && typeof value.createSceneLayer === 'function';
}
/** Rejects a factory result that lacks any lifecycle method the owner calls. */
export function isMapSceneLayerHandle(value: unknown): value is MapSceneLayerHandle {
  return typeof value === 'object' && value !== null && handleMethods.every(name => typeof Reflect.get(value, name) === 'function');
}

const defaultImporter = (): Promise<unknown> => import('@aceshooting/lyra-map/scene');
let importer = defaultImporter;
let pending: Promise<MapSceneLayerRuntime> | undefined;

/**
 * Loads the optional custom-layer bridge from `@aceshooting/lyra-map/scene` on first use. A failed
 * import or a module without `createSceneLayer` rejects and is retried by the next call.
 */
export function loadMapSceneLayerRuntime(): Promise<MapSceneLayerRuntime> {
  if (pending) return pending;
  const attempt: Promise<MapSceneLayerRuntime> = importer().then(module => {
    const runtime = resolveOptionalPeerCapability(module, isMapSceneLayerRuntime);
    if (!runtime) throw new TypeError('Map custom layers are unavailable');
    return runtime;
  });
  pending = attempt;
  attempt.catch(() => { if (pending === attempt) pending = undefined; });
  return attempt;
}

/** @internal Replaces the raw optional namespace; omit to restore the real module. */
export function __setMapSceneLayerImporterForTesting(next?: () => Promise<unknown>): void {
  importer = next ?? defaultImporter;
  pending = undefined;
}
