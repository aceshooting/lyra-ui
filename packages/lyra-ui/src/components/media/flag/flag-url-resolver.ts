import { devWarn } from '../../../internal/dev-mode-attribute-warning.js';
import { classifyOptionalPeerImportError } from '../../../internal/optional-peer-failure.js';

export type LyraFlagFidelity = 'compact' | 'standard' | 'detailed';
export type LyraFlagShape = 'rect' | 'circle';
export type LyraFlagUrlResolver = (
  code: string,
  options?: { variant?: LyraFlagFidelity },
) => Promise<string | undefined>;

function resolverFromModule(module: unknown): LyraFlagUrlResolver | null {
  try {
    if ((typeof module === 'object' && module !== null) || typeof module === 'function') {
      const named = (module as { flagUrl?: unknown }).flagUrl;
      if (typeof named === 'function') return named as LyraFlagUrlResolver;
      const fallback = (module as { default?: unknown }).default ?? module;
      if (typeof fallback === 'function') return fallback as LyraFlagUrlResolver;
      if (typeof fallback === 'object' && fallback !== null) {
        const defaultNamed = (fallback as { flagUrl?: unknown }).flagUrl;
        if (typeof defaultNamed === 'function') return defaultNamed as LyraFlagUrlResolver;
      }
    }
  } catch {
    // Hostile namespace/default getters fail closed through the shared warning below.
  }
  return null;
}

/** The peer could not be imported at all: it is genuinely absent, so say so and how to add it. */
function warnFlagPeerMissing(): void {
  console.warn(
    "<lr-flag> needs the optional peer dependency '@aceshooting/lyra-flags' to render "
      + 'flag images — install it with `pnpm add @aceshooting/lyra-flags`.',
  );
}

/** The peer imported but lacks the capability this entry needs: a version mismatch, not an absent package. */
function warnFlagPeerIncapable(capability: string): void {
  console.warn(
    `<lr-flag> loaded '@aceshooting/lyra-flags' but it does not expose \`${capability}\`. The `
      + 'package is installed, so this is a version mismatch rather than a missing dependency: '
      + 'upgrade it to a release that provides that capability, and check the peer range in '
      + "<lr-flag>'s own package metadata for the floor it expects.",
  );
}

/** The peer resolved but its import rejected (network, chunk or syntax failure): it will be retried. */
function warnFlagPeerLoadFailed(): void {
  console.warn(
    "<lr-flag> found the optional peer '@aceshooting/lyra-flags' but could not load it (a network, "
      + 'chunk or module error, not a missing package). Flags retry the import on their next resolution.',
  );
}

function perCodeResolver(peerModule: unknown): LyraFlagUrlResolver | null {
  const resolver = resolverFromModule(peerModule);
  if (resolver) return resolver;
  warnFlagPeerIncapable('flagUrl');
  return null;
}

async function bulkResolver(peerModule: unknown): Promise<LyraFlagUrlResolver | null> {
  const factory = resolverFactoryFromModule(peerModule);
  try {
    const resolver = await factory?.();
    if (typeof resolver === 'function') return resolver as LyraFlagUrlResolver;
  } catch {
    // Initialization failures share the same capability diagnostic as unusable results.
  }
  warnFlagPeerIncapable('createFlagUrlResolver');
  return null;
}

/**
 * A resolver standing in for a peer whose import rejected transiently: each call shares one
 * re-import, keeps a successful one, and rejects (so the flag fails closed) until then.
 */
function retryingResolver(
  importFlags: () => Promise<unknown>,
  build: (peerModule: unknown) => LyraFlagUrlResolver | null | Promise<LyraFlagUrlResolver | null>,
): LyraFlagUrlResolver {
  let pending: Promise<LyraFlagUrlResolver | null> | undefined;
  return async (code, options) => {
    const current = pending ??= importFlags().then(build);
    const resolver = await current.catch((error: unknown) => {
      if (pending === current) pending = undefined;
      throw error;
    });
    if (!resolver) throw new Error('@aceshooting/lyra-flags does not provide a flag resolver');
    return resolver(code, options);
  };
}

async function loadPeer(
  importFlags: () => Promise<unknown>,
  build: (peerModule: unknown) => LyraFlagUrlResolver | null | Promise<LyraFlagUrlResolver | null>,
): Promise<LyraFlagUrlResolver | null> {
  let peerModule: unknown;
  try {
    peerModule = await importFlags();
  } catch (error) {
    if (classifyOptionalPeerImportError(error) === 'missing') {
      warnFlagPeerMissing();
      return null;
    }
    warnFlagPeerLoadFailed();
    return retryingResolver(importFlags, build);
  }
  return build(peerModule);
}

/**
 * Resolves the optional peer dependency `@aceshooting/lyra-flags`'s `flagUrl`
 * via the given importer. Uncached and
 * dependency-injectable — unlike `loadFlagUrlResolver()` below — so the
 * caught-error warning path is directly testable without needing to
 * actually uninstall the package. Resolves `null` when the peer is absent or
 * lacks `flagUrl`; a transient import failure resolves a resolver that retries
 * the import on its next call.
 */
export function loadFlagUrl(
  importFlags: () => Promise<unknown>,
): Promise<LyraFlagUrlResolver | null> {
  return loadPeer(importFlags, perCodeResolver);
}

function resolverFactoryFromModule(module: unknown): (() => unknown) | null {
  try {
    if ((typeof module === 'object' && module !== null) || typeof module === 'function') {
      const named = (module as { createFlagUrlResolver?: unknown }).createFlagUrlResolver;
      if (typeof named === 'function') return named as () => unknown;
      const fallback = (module as { default?: unknown }).default ?? module;
      if (typeof fallback === 'object' && fallback !== null) {
        const defaultNamed = (fallback as { createFlagUrlResolver?: unknown }).createFlagUrlResolver;
        if (typeof defaultNamed === 'function') return defaultNamed as () => unknown;
      }
    }
  } catch {
    // Hostile namespace/default getters fail closed through the shared warning below.
  }
  return null;
}

/**
 * Resolves `@aceshooting/lyra-flags`'s `createFlagUrlResolver` via the given importer and calls
 * it once, the bulk-resolution twin of `loadFlagUrl()` above. Backs `flag-peer-bulk.js` — the
 * opt-in alternative to `flag-peer.js` for a page that renders most/all flags at once, where one
 * shared `flagUrls()` fetch beats resolving every `<lr-flag>` instance independently. Same
 * dependency-injectable, uncached shape and failure handling as `loadFlagUrl()`.
 */
export function loadBulkFlagUrl(
  importFlags: () => Promise<unknown>,
): Promise<LyraFlagUrlResolver | null> {
  return loadPeer(importFlags, bulkResolver);
}

let flagUrlResolver: Promise<LyraFlagUrlResolver | null> | undefined;
let flagResolverGeneration = 0;
const flagResolverSubscribers = new Set<(generation: number) => void>();
/**
 * One-shot guard for `warnMissingFlagResolver()`. A table of 200 flags shares one diagnostic
 * rather than emitting 200 identical lines. Re-armed by `setFlagUrlResolver()`, so a later
 * registration generation that is still resolver-less warns again.
 */
let warnedMissingFlagResolver = false;

/**
 * Explains the one failure this component otherwise reports only as a visible
 * `[part="error"]`: `country`/`language` was set, but nothing ever registered a resolver, so
 * there is no way to turn a code into a URL. The core component deliberately keeps the optional
 * peer out of its module graph (see `loadFlagUrlResolver()`), which means this is a *setup*
 * omission a developer can fix in one import — but only if they are told about it. Distinct from
 * `loadFlagUrl()`'s warning, which fires when the peer entry WAS imported and the peer package
 * itself is missing.
 */
export function warnMissingFlagResolver(code: string): void {
  if (warnedMissingFlagResolver) return;
  warnedMissingFlagResolver = true;
  devWarn(
    `<lr-flag> could not resolve the code "${code}" because no flag resolver is registered. `
      + `Import the optional peer entry once at startup -- import `
      + `'@aceshooting/lyra-ui/components/media/flag/flag-peer.js' -- and install `
      + `'@aceshooting/lyra-flags', or pass an already-resolved URL through 'src' instead.`,
  );
}

/** Install an optional flag resolver supplied by a peer-registration entry. */
export function setFlagUrlResolver(
  value: LyraFlagUrlResolver | Promise<LyraFlagUrlResolver | null> | null,
): void {
  flagUrlResolver = value === null ? Promise.resolve(null) : Promise.resolve(value);
  warnedMissingFlagResolver = false;
  flagResolverGeneration++;
  for (const subscriber of [...flagResolverSubscribers]) subscriber(flagResolverGeneration);
}

/**
 * Lazily loads the optional peer dependency '@aceshooting/lyra-flags' once per
 * page. Resolves to `null` (with a one-time warning, see `loadFlagUrl()`) if
 * it isn't installed.
 */
export function loadFlagUrlResolver(): Promise<LyraFlagUrlResolver | null> {
  if (!flagUrlResolver) {
    // The core component intentionally has no optional-peer import in its
    // module graph. Import `flag-peer.js` when country/language resolution is
    // wanted; otherwise a flag with no pre-resolved `src` simply renders empty.
    flagUrlResolver = Promise.resolve(null);
  }
  return flagUrlResolver;
}


export function getFlagResolverGeneration(): number { return flagResolverGeneration; }

export function subscribeFlagResolver(subscriber: (generation: number) => void): () => void {
  flagResolverSubscribers.add(subscriber);
  return () => flagResolverSubscribers.delete(subscriber);
}
