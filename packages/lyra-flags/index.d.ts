/**
 * Resolves the URL of a flag SVG shipped in this package, fetching only that one flag —
 * genuinely code-split per code (see the JSDoc on this function in `index.js`), not just a
 * lookup into an eagerly-bundled map.
 * @param code ISO 3166-1 alpha-2 country/territory code, lowercase (e.g. `fr`, `us`).
 */
export declare function flagUrl(code: string): Promise<string | undefined>;

/**
 * Resolves every shipped flag's URL at once — for a consumer that genuinely wants every flag up
 * front (e.g. a flag-picker listing every country), not just one or two. Ships all 249 flags the
 * moment this is called; prefer `flagUrl()` for a single/few known codes.
 */
export declare function flagUrls(): Promise<Record<string, string>>;

/**
 * Lazy map of ISO 3166-1 alpha-2 (or territory) code -> flag SVG URL loader that `flagUrl()`
 * looks up. Exported directly for consumers that want the per-code laziness without going
 * through `flagUrl()` (e.g. to check `code in FLAG_LOADERS` for presence without fetching
 * anything).
 */
export { FLAG_LOADERS } from './flags/generated.js';
