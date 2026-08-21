import type { place } from './positioner.js';

/** The positioning capability loaded on the first anchored surface open. */
export interface AnchoredOverlayRuntime {
  place: typeof place;
}

type AnchoredOverlayRuntimeLoader = () => Promise<AnchoredOverlayRuntime>;

const defaultRuntimeLoader: AnchoredOverlayRuntimeLoader = () => import('./positioner.js');
let runtimeLoader = defaultRuntimeLoader;
let runtimePromise: Promise<AnchoredOverlayRuntime> | undefined;

/** Loads and caches the positioning runtime shared by every deferred anchored surface. */
export function loadAnchoredOverlayRuntime(): Promise<AnchoredOverlayRuntime> {
  if (runtimePromise) return runtimePromise;
  const pending = runtimeLoader();
  let cached!: Promise<AnchoredOverlayRuntime>;
  cached = pending.catch((error: unknown) => {
    if (runtimePromise === cached) runtimePromise = undefined;
    throw error;
  });
  runtimePromise = cached;
  return runtimePromise;
}

/** @internal Replaces and clears the cached loader for deterministic deferred-runtime tests. */
export function __setAnchoredOverlayRuntimeLoaderForTesting(
  loader: AnchoredOverlayRuntimeLoader | undefined,
): void {
  runtimeLoader = loader ?? defaultRuntimeLoader;
  runtimePromise = undefined;
}
