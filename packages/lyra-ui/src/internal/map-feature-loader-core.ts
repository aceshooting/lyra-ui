/**
 * Shared lazy-runtime cache. Each loader owns its pending import and resolved runtime;
 * a rejected import is forgotten so the next use retries it.
 */
export interface MapFeatureLoader<T> {
  (): Promise<T>;
  /** The runtime once its import has resolved, so later callers can stay synchronous. */
  readonly loaded: T | undefined;
}

export function mapFeatureLoader<T>(importer: () => Promise<T>): MapFeatureLoader<T> {
  // The cache lives on the loader itself, so it carries no module-level registry.
  const load = Object.assign((): Promise<T> => {
    if (load.pending) return load.pending;
    const attempt: Promise<T> = load.importer().then(
      (runtime) => {
        if (load.pending === attempt) load.loaded = runtime;
        return runtime;
      },
      (error: unknown) => {
        if (load.pending === attempt) load.pending = undefined;
        throw error;
      },
    );
    return (load.pending = attempt);
  }, { importer, pending: undefined as Promise<T> | undefined, loaded: undefined as T | undefined });
  return load;
}
