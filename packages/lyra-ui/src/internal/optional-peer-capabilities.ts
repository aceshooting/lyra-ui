import { devWarnOnce } from './dev-warning.js';
import { classifyOptionalPeerImportError } from './optional-peer-failure.js';

/**
 * The sanitizer capability Lyra consumes from DOMPurify.
 *
 * This owned structural type keeps optional peer declarations out of Lyra's
 * public declaration graph while still requiring loaders to validate the
 * method they call.
 */
export interface HtmlSanitizer {
  sanitize(input: string, options?: Record<string, unknown>): unknown;
}

/** Returns an ESM default export when present, otherwise the original value. */
export function unwrapOptionalPeerDefault(value: unknown): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return value;
  return 'default' in value ? value.default : value;
}

/**
 * Selects an optional peer by capability, preferring the module namespace before its default.
 *
 * Some CJS/ESM interop wrappers expose both shapes. The namespace may carry the real named API
 * while an unrelated or stale `default` is also present, so property presence alone is not enough
 * to choose safely.
 */
export function resolveOptionalPeerCapability<Capability>(
  value: unknown,
  isCapability: (candidate: unknown) => candidate is Capability,
): Capability | null {
  if (isCapability(value)) return value;
  const defaultExport = unwrapOptionalPeerDefault(value);
  return isCapability(defaultExport) ? defaultExport : null;
}

/** Narrows an unknown optional-peer value to the sanitizer capability Lyra uses. */
export function isHtmlSanitizer(value: unknown): value is HtmlSanitizer {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'sanitize' in value &&
    typeof value.sanitize === 'function'
  );
}

export interface OptionalPeerLoaderOptions<Capability> {
  /** Imports the peer, normally a literal dynamic `import()` so bundlers can split it. */
  readonly load: () => Promise<unknown>;
  /** Validates the capability Lyra calls, on the namespace before its default export. */
  readonly isCapability: (candidate: unknown) => candidate is Capability;
  /** Dev-mode dedupe key for {@link OptionalPeerLoaderOptions.warning}. */
  readonly warningKey: string;
  /** Fixed development diagnostic; importer errors are never included (they can carry paths). */
  readonly warning: string;
  /** Diagnostic for an import that rejected although the peer resolves (network, chunk or syntax failure); defaults to `warning`. */
  readonly failedWarning?: string;
  /**
   * Cache policy. `'success-only'` (default) keeps only an in-flight or successful load, so every
   * failure (import rejection or unusable module) is retried by the next call. `'generation'`
   * additionally keeps a module that imported but lacks the capability (a permanent condition)
   * while still retrying an import rejection (a transient network/chunk failure); {@link
   * OptionalPeerLoader.reset} starts a new generation.
   */
  readonly cache?: 'success-only' | 'generation';
}

export interface OptionalPeerLoader<Capability> {
  /** Imports through `importer` (default: the configured `load`) and resolves the capability. */
  loadWith(importer?: () => Promise<unknown>): Promise<Capability | null>;
  /** One shared load for every caller. Only an in-flight or successful load is kept: a failed
   * import or an unusable module resolves `null` and the next call tries again. */
  get(): Promise<Capability | null>;
  /** Forgets the shared load. */
  clear(): void;
  /** Alias of {@link OptionalPeerLoader.get}. */
  load(): Promise<Capability | null>;
  /** Alias of {@link OptionalPeerLoader.clear}; an older in-flight load can no longer repopulate the cache. */
  reset(): void;
  /** Replaces the shared import (tests simulating a missing peer); `undefined` restores `load`. */
  override(importer?: () => Promise<unknown>): void;
}

/**
 * The one cached-import template every optional-peer loader repeats: dynamic import, capability
 * validation on either module shape, a dev-gated warning (once per key) for an import failure or a
 * wrong-shape module, and a shared cache that never keeps a failure for the page lifetime.
 */
export function createOptionalPeerLoader<Capability>(
  options: OptionalPeerLoaderOptions<Capability>,
): OptionalPeerLoader<Capability> {
  let shared: Promise<Capability | null> | undefined;
  let generation = 0;
  let importerOverride: (() => Promise<unknown>) | undefined;
  const keepInvalid = options.cache === 'generation';
  /** `transient` is true for an import rejection, false for a module that imported but is unusable. */
  const attempt = async (
    importer: () => Promise<unknown>,
  ): Promise<{ capability: Capability | null; transient: boolean }> => {
    let module: unknown;
    try {
      module = await importer();
    } catch (error) {
      const failed = classifyOptionalPeerImportError(error) === 'failed';
      devWarnOnce(options.warningKey, failed ? (options.failedWarning ?? options.warning) : options.warning);
      return { capability: null, transient: true };
    }
    const capability = resolveOptionalPeerCapability(module, options.isCapability);
    if (capability === null) devWarnOnce(options.warningKey, options.warning);
    return { capability, transient: false };
  };
  const loadWith = async (importer = importerOverride ?? options.load): Promise<Capability | null> =>
    (await attempt(importer)).capability;
  const get = (): Promise<Capability | null> => {
    if (!shared) {
      const started = generation;
      const pending = attempt(importerOverride ?? options.load);
      const result = pending.then((outcome) => outcome.capability);
      shared = result;
      void pending.then((outcome) => {
        const keep = outcome.capability !== null || (keepInvalid && !outcome.transient);
        if (!keep && shared === result && generation === started) shared = undefined;
      });
    }
    return shared;
  };
  const clear = () => {
    generation += 1;
    shared = undefined;
  };
  return {
    loadWith,
    get,
    load: get,
    clear,
    reset: clear,
    override(importer) {
      importerOverride = importer;
      clear();
    },
  };
}
