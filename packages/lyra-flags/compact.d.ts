/**
 * Tier-committed `flagUrl()` for a consumer that only ever renders the compact fidelity tier —
 * see the module's own JSDoc in `compact.js` for why this exists and how it differs from the
 * package root's `flagUrl()`.
 * @param code ISO 3166-1 alpha-2 country/territory code, lowercase (e.g. `fr`, `us`).
 */
export declare function flagUrl(code: string): Promise<string | undefined>;

export { FLAG_LOADERS_COMPACT } from './flags/generated-compact.js';
