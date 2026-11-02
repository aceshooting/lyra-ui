import { createMapCustomLayerController } from './internal/map-custom-layer-controller.js';
import type { LyraMapCustomLayer, LyraMapCustomLayerHandle, LyraMapCustomLayerOptions } from './internal/map-custom-layer-types.js';

export type {
  LyraMapCustomLayer, LyraMapCustomLayerContext, LyraMapCustomLayerFrame, LyraMapCustomLayerInstance,
  LyraMapCustomLayerPick, LyraMapCustomLayerHandle, LyraMapCustomLayerOptions, LyraMapCustomLayerStatus,
  LyraMapCustomLayerState, LyraMapCustomLayerCode, LyraMapGeographicServices, LyraMapGeographicFrame,
  LyraMapGeographicShader, LyraMapGeographicUniform, LyraMapGeographicOrigin, LyraMapResolvedPosition,
  LyraMapProjectedPosition,
} from './internal/map-custom-layer-types.js';

/**
 * Adds a trusted custom WebGL2 layer (a beam, coverage cone, cloud or particle effect) to a
 * connected `lr-map` that uses `@aceshooting/lyra-map` or a native engine with the same
 * custom-layer support. Registers no elements; the bridge loads from the optional
 * `@aceshooting/lyra-map/scene` entry on first use.
 *
 * The layer shares the map's WebGL context, camera and depth buffer. `create()` runs for each mount
 * epoch: on first install, after a style replacement and after WebGL context restoration, and the
 * previous instance is disposed first. Positions are degrees with meter altitude above `sea-level`
 * or displayed `terrain`. A pointer click asks `pick()`, and a hit emits `lr-map-scene-activate`
 * with `kind: 'custom'` and `layerId`. Disconnecting the map removes the layer permanently.
 *
 * @throws {TypeError} When `map` is not a connected `lr-map` or the descriptor is malformed.
 */
export function addMapCustomLayer(map: HTMLElement, layer: LyraMapCustomLayer,
  options?: LyraMapCustomLayerOptions): LyraMapCustomLayerHandle {
  return createMapCustomLayerController(map, layer, options);
}
