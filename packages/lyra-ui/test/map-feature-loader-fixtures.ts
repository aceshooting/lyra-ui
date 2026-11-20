import type { MapFeatureLoader } from '../src/internal/map-feature-loader-core.js';

interface LoaderCache<T> { importer: () => Promise<T>; pending?: Promise<T>; loaded?: T }
const originals = new WeakMap<object, () => Promise<unknown>>();

/**
 * Replaces one lazy runtime's importer and forgets its cached import, so a test can hold a runtime
 * unloaded, fail it, or restore the real module (omit `importer`).
 */
export function setMapFeatureImporter<T>(loader: MapFeatureLoader<T>, importer?: () => Promise<T>): void {
  const cache = loader as unknown as LoaderCache<T>;
  if (!originals.has(loader)) originals.set(loader, cache.importer);
  cache.importer = importer ?? (originals.get(loader) as () => Promise<T>);
  cache.pending = undefined;
  cache.loaded = undefined;
}

/** Replaces the raw namespace an optional-peer loader resolves, keeping its capability validation. */
export function setOptionalNamespaceImporter<T>(loader: MapFeatureLoader<T>, resolve: (namespace: unknown) => T,
  importer?: () => Promise<unknown>): void {
  setMapFeatureImporter(loader, importer && (() => importer().then(resolve)));
}
