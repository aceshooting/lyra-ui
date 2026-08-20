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

export { FLAG_LOADERS };
