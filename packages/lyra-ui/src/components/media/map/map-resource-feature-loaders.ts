import { mapFeatureLoader } from './map-feature-loader-core.js';

/** Fetching, sanitizing and rasterizing `images` descriptors. */
export const loadMapImageRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-images.js'));
/** Basemap paint/layout ownership for `styleOverrides`. */
export const loadMapStyleOverrideRuntime = /* @__PURE__ */ mapFeatureLoader(() => import('./map-style-overrides.js'));
