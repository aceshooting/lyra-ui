/**
 * Shared lazy-runtime cache. Each loader owns its pending import and resolved runtime;
 * a rejected import is forgotten so the next use retries it.
 */
export interface MapFeatureLoader<T> {
  (): Promise<T>;
  /** The runtime once its import has resolved, so later callers can stay synchronous. */
  readonly loaded: T | undefined;
}

type MapFeatureImporter<T> = () => Promise<T>;
const importers = new WeakMap<MapFeatureLoader<unknown>, (importer?: MapFeatureImporter<unknown>) => void>();

export function mapFeatureLoader<T>(importer: MapFeatureImporter<T>): MapFeatureLoader<T> {
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
