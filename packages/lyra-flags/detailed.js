import { FLAG_LOADERS } from './flags/generated.js';
import { FLAG_LOADERS_DETAILED } from './flags/generated-detailed.js';

/**
 * Tier-committed `flagUrl()` for a consumer that only ever renders the detailed fidelity tier.
 * Imports `flags/generated-detailed.js` plus its `flags/generated.js` fallback — only the ~65
 * emblem codes have a distinct detailed original, every other code falls back to the standard
 * vector — but never `flags/generated-compact.js`, unlike the package root's `flagUrl()`, which
 * imports all three tiers so it can honour a per-call `options.variant`. Prefer the package root
 * instead when a single `<lr-flag>` needs to pick `fidelity` per instance.
 * @param {string} code ISO 3166-1 alpha-2 country/territory code, lowercase (e.g. `fr`, `us`).
 * @returns {Promise<string | undefined>} The flag's detailed-tier URL (falling back to standard
 *   for a code with no detailed original), or `undefined` for an unmapped code.
 */
export function flagUrl(code) {
  return FLAG_LOADERS_DETAILED[code]?.() ?? FLAG_LOADERS[code]?.() ?? Promise.resolve(undefined);
}

export { FLAG_LOADERS_DETAILED };
