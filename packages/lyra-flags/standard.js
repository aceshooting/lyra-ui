import { FLAG_LOADERS } from './flags/generated.js';

/**
 * Tier-committed `flagUrl()` for a consumer that only ever renders the standard fidelity tier.
 * Imports only `flags/generated.js` — never `flags/generated-detailed.js` or
 * `flags/generated-compact.js` — so a bundler's reachable lazy-chunk graph excludes both other
 * tiers entirely, unlike the package root's `flagUrl()`, which imports all three so it can honour
 * a per-call `options.variant`. Prefer the package root instead when a single `<lr-flag>` needs to
 * pick `fidelity` per instance.
 * @param {string} code ISO 3166-1 alpha-2 country/territory code, lowercase (e.g. `fr`, `us`).
 * @returns {Promise<string | undefined>} The flag's standard-tier URL, or `undefined` for an
 *   unmapped code.
 */
export function flagUrl(code) {
  return FLAG_LOADERS[code]?.() ?? Promise.resolve(undefined);
}

/**
 * Resolves every shipped standard-tier flag URL at once. This is the tier-committed twin of the
 * package root's `flagUrls()`: it reaches only `flags/eager.js`, so importing this entry does not
 * make the detailed or compact loader graphs reachable.
 * @returns {Promise<Record<string, string>>} Map of code to standard-tier flag URL.
 */
export async function flagUrls() {
  return (await import('./flags/eager.js')).FLAG_URLS;
}

/**
 * Resolves every shipped standard-tier flag URL at once, then hands back a `flagUrl`-shaped
 * resolver that reads from that one shared map — the tier-committed twin of the package root's
 * `createFlagUrlResolver()`, for a page that renders most or all flags at once (a country table,
 * a full locale picker) where resolving each flag through its own lazy loader chunk costs one
 * fetch per flag.
 *
 * Why this exists here rather than only at the package root: bulk resolution never needed the
 * other two tiers in the first place. It is backed by `flags/eager.js`, which is standard-tier-only
 * by construction (the ~65 detailed originals alone are ~9.7MB — never something to fetch
 * eagerly), so the root version's three-tier import is inherited purely from sharing a module with
 * the variant-aware `flagUrl()`. Reaching back through the root for it therefore re-acquired the
 * whole detailed + compact lazy-chunk graph — precisely the cost this entry point exists to avoid,
 * and measured on a real 12-route production build as +15.8MB of emitted assets no route rendered.
 *
 * Like this module's `flagUrl()`, the returned resolver is committed to the standard tier: it
 * accepts (and ignores) the `options` argument a root-shaped caller passes, so wiring it into
 * `<lr-flag>`'s `setFlagUrlResolver()` keeps working when an individual element asks for
 * `fidelity="compact"`/`"detailed"` — it resolves to the standard asset instead of reaching for a
 * tier this entry deliberately does not ship. Use the package root's `createFlagUrlResolver()`
 * when per-instance fidelity must actually be honoured.
 * @returns {(code: string, options?: unknown) => Promise<string | undefined>} A `flagUrl`-shaped
 *   resolver, suitable for `<lr-flag>`'s `setFlagUrlResolver()`.
 */
export function createFlagUrlResolver() {
  const urlsPromise = flagUrls();
  return async function resolveFlagUrl(code) {
    return (await urlsPromise)[code];
  };
}

export { FLAG_LOADERS };
