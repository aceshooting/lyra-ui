/**
 * Tier-committed `flagUrl()` for a consumer that only ever renders the standard fidelity tier —
 * see the module's own JSDoc in `standard.js` for why this exists and how it differs from the
 * package root's `flagUrl()`.
 * @param code ISO 3166-1 alpha-2 country/territory code, lowercase (e.g. `fr`, `us`).
 */
export declare function flagUrl(code: string): Promise<string | undefined>;

/** Resolves every shipped standard-tier flag URL without reaching another fidelity tier. */
export declare function flagUrls(): Promise<Record<string, string>>;

/**
 * Builds a `flagUrl`-shaped resolver backed by one shared eager map of every standard-tier flag
 * URL, for a page that renders most/all flags at once instead of resolving each `<lr-flag>`
 * instance through its own lazy per-code loader. The tier-committed twin of the package root's
 * `createFlagUrlResolver()`: it reaches only `flags/eager.js` (standard-tier-only by
 * construction), never the detailed or compact loader maps — see the module's own JSDoc in
 * `standard.js`. The returned resolver accepts and ignores an `options` argument, resolving the
 * standard asset for every code.
 */
export declare function createFlagUrlResolver(): (
  code: string,
  options?: unknown,
) => Promise<string | undefined>;

export { FLAG_LOADERS } from './flags/generated.js';
