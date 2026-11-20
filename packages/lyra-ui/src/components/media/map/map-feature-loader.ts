import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';
import type { MapSceneBridgeRuntime } from './map-scene-render-controller.js';
import { mapFeatureLoader } from '../../../internal/map-feature-loader-core.js';

export type { MapFeatureLoader } from '../../../internal/map-feature-loader-core.js';
export { loadMapImageRuntime, loadMapStyleOverrideRuntime } from './map-resource-feature-loaders.js';

/** Placement, focus return and closable Escape ownership for the `anchor` slot. */
export const loadMapAnchorRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-anchor-controller.js'));
/** Native control installation, retirement and geolocation event ownership for `controls`. */
export const loadMapControlRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-controls-lifecycle.js'));
/** Drawing sessions, vertex editing and their temporary native resources. */
export const loadMapDrawingRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-drawing-controller.js'));
/** `exportImage()` capture, encoding and attribution collection. */
export const loadMapImageExportRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-image-export-controller.js'));
/** Named URL-fragment ownership for `hash`. */
export const loadMapHashRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-hash-owner.js'));
/** Desired feature state, its native replay and retirement, for `setFeatureState()`. */
export const loadMapFeatureStateRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-feature-state-routes.js'));
/** Projection and paint expressions for `dataLayers` and `choropleth`. */
export const loadMapDataLayerRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-data-layer-runtime.js'));
/** Native ownership of `overlays`, `images`, `styleOverrides` and external data-layer resources. */
export const loadMapOwnedFeatureRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-owned-features.js'));

/** Optional geographic scene connection; unset maps never load this controller. */
export const loadMapSceneRenderRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-scene-render-controller.js'));

/** Validates the optional scene bridge namespace before it enters the shared cache. */
export function resolveMapSceneBridge(namespace: unknown): MapSceneBridgeRuntime {
  const runtime = resolveOptionalPeerCapability(namespace, (value): value is MapSceneBridgeRuntime =>
    typeof value === 'object' && value !== null && 'createSceneBridge' in value && typeof value.createSceneBridge === 'function');
  if (!runtime) throw new TypeError('Map scene renderer unavailable');
  return runtime;
}
/** Optional geographic scene renderer from the modular companion. */
export const loadMapSceneBridge = /* @__PURE__ */ mapFeatureLoader(() => import('@aceshooting/lyra-map/scene').then(resolveMapSceneBridge));
