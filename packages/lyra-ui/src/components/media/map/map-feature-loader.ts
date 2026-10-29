import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';
import type { MapSceneBridgeRuntime } from './map-scene-render-controller.js';
import { mapFeatureLoader, __setMapFeatureImporterForTesting as setImporter, type MapFeatureLoader } from './map-feature-loader-core.js';

export type { MapFeatureLoader } from './map-feature-loader-core.js';
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
/** Native ownership of `overlays`, `images`, `styleOverrides` and external data-layer resources. */
export const loadMapOwnedFeatureRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-owned-features.js'));

/** @internal Replaces one runtime's importer and forgets its cached import. */
export function __setMapFeatureImporterForTesting<T>(
  loader: MapFeatureLoader<T>,
  importer?: () => Promise<T>,
): void {
  setImporter(loader, importer);
}

/** Optional geographic scene connection; unset maps never load this controller. */
export const loadMapSceneRenderRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-scene-render-controller.js'));

const sceneBridgeImporter = () => import('@aceshooting/lyra-map/scene');
let importSceneBridge: () => Promise<unknown> = sceneBridgeImporter;
async function importSceneBridgeRuntime(): Promise<MapSceneBridgeRuntime> {
  const runtime = resolveOptionalPeerCapability(await importSceneBridge(), (value): value is MapSceneBridgeRuntime =>
    typeof value === 'object' && value !== null && 'createSceneBridge' in value && typeof value.createSceneBridge === 'function');
  if (!runtime) throw new TypeError('Map scene renderer unavailable');
  return runtime;
}
/** Validates the factory before a successful optional import enters the shared cache. */
export const loadMapSceneBridge = /* @__PURE__ */ mapFeatureLoader(importSceneBridgeRuntime);

/** @internal Replaces the raw optional namespace while retaining capability validation. */
export function __setMapSceneBridgeImporterForTesting(importer?: () => Promise<unknown>): void {
  importSceneBridge = importer ?? sceneBridgeImporter;
  setImporter(loadMapSceneBridge);
}
