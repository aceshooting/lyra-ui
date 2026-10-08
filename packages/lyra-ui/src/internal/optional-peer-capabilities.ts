import { devWarnOnce } from './dev-warning.js';

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
}

export interface OptionalPeerLoader<Capability> {
  /** Imports through `importer` (default: the configured `load`) and resolves the capability. */
  loadWith(importer?: () => Promise<unknown>): Promise<Capability | null>;
  /** One shared load for every caller. Only an in-flight or successful load is kept: a failed
   * import or an unusable module resolves `null` and the next call tries again. */
  get(): Promise<Capability | null>;
  /** Forgets the shared load. */
  clear(): void;
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
  let importerOverride: (() => Promise<unknown>) | undefined;
  const loadWith = async (importer = importerOverride ?? options.load): Promise<Capability | null> => {
    let module: unknown;
    try {
      module = await importer();
    } catch {
      devWarnOnce(options.warningKey, options.warning);
      return null;
    }
    const capability = resolveOptionalPeerCapability(module, options.isCapability);
    if (capability === null) devWarnOnce(options.warningKey, options.warning);
    return capability;
  };
  return {
    loadWith,
    get() {
      if (!shared) {
        const pending = loadWith();
        shared = pending;
        void pending.then((capability) => {
          if (capability === null && shared === pending) shared = undefined;
        });
      }
      return shared;
    },
    clear() {
      shared = undefined;
    },
    override(importer) {
      importerOverride = importer;
      shared = undefined;
    },
  };
}
