/**
 * On-demand imports for optional `<lr-map>` runtimes. Literal specifiers let bundlers emit each
 * runtime as its own chunk, so a map that never draws, exports, owns a URL field or registers
 * native resources never downloads that code. Every element shares one import per runtime; a
 * rejected import is forgotten so the next use retries it.
 */
export interface MapFeatureLoader<T> {
  (): Promise<T>;
  /** The runtime once its import has resolved, so later callers can stay synchronous. */
  readonly loaded: T | undefined;
}

type MapFeatureImporter<T> = () => Promise<T>;
const importers = new WeakMap<MapFeatureLoader<unknown>, (importer?: MapFeatureImporter<unknown>) => void>();

function mapFeatureLoader<T>(importer: MapFeatureImporter<T>): MapFeatureLoader<T> {
  let active = importer;
  let pending: Promise<T> | undefined;
  let loaded: T | undefined;
  const load = (() => {
    if (pending) return pending;
    const attempt: Promise<T> = active().then(
      (runtime) => {
        if (pending === attempt) loaded = runtime;
        return runtime;
      },
      (error: unknown) => {
        if (pending === attempt) pending = undefined;
        throw error;
      },
    );
    return (pending = attempt);
  }) as MapFeatureLoader<T>;
  Object.defineProperty(load, 'loaded', { get: () => loaded });
  importers.set(load as MapFeatureLoader<unknown>, (next) => {
    active = (next as MapFeatureImporter<T> | undefined) ?? importer;
    pending = undefined;
    loaded = undefined;
  });
  return load;
}

/** Placement, focus return and closable Escape ownership for the `anchor` slot. */
export const loadMapAnchorRuntime = mapFeatureLoader(() => import('./map-anchor-controller.js'));
/** Native control installation, retirement and geolocation event ownership for `controls`. */
export const loadMapControlRuntime = mapFeatureLoader(() => import('./map-controls-lifecycle.js'));
/** Drawing sessions, vertex editing and their temporary native resources. */
export const loadMapDrawingRuntime = mapFeatureLoader(() => import('./map-drawing-controller.js'));
/** `exportImage()` capture, encoding and attribution collection. */
export const loadMapImageExportRuntime = mapFeatureLoader(() => import('./map-image-export-controller.js'));
/** Named URL-fragment ownership for `hash`. */
export const loadMapHashRuntime = mapFeatureLoader(() => import('./map-hash-owner.js'));
/** Desired feature state, its native replay and retirement, for `setFeatureState()`. */
export const loadMapFeatureStateRuntime = mapFeatureLoader(() => import('./map-feature-state-routes.js'));
/** Native ownership of `overlays`, `images`, `styleOverrides` and external data-layer resources. */
export const loadMapOwnedFeatureRuntime = mapFeatureLoader(() => import('./map-owned-features.js'));
/** Fetching, sanitizing and rasterizing `images` descriptors. */
export const loadMapImageRuntime = mapFeatureLoader(() => import('./map-images.js'));
/** Basemap paint/layout ownership for `styleOverrides`. */
export const loadMapStyleOverrideRuntime = mapFeatureLoader(() => import('./map-style-overrides.js'));

/**
 * @internal Replaces one runtime's importer and forgets its cached import, so a test can hold a
 * runtime unloaded, fail it, or restore the real module (omit `importer`).
 */
export function __setMapFeatureImporterForTesting<T>(
  loader: MapFeatureLoader<T>,
  importer?: MapFeatureImporter<T>,
): void {
  importers.get(loader as MapFeatureLoader<unknown>)?.(importer as MapFeatureImporter<unknown> | undefined);
}
