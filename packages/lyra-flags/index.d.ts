/**
 * Resolves the URL of a flag SVG shipped in this package, fetching only that one flag —
 * genuinely code-split per code (see the JSDoc on this function in `index.js`), not just a
 * lookup into an eagerly-bundled map.
 * @param code ISO 3166-1 alpha-2 country/territory code, lowercase (e.g. `fr`, `us`).
 * @param options `variant` picks a fidelity tier for the ~65 emblem codes (a safe no-op for every
 *   other code — same file either way): `'compact'` = a tiny WebP raster for icon-scale use
 *   (menus, language selectors), `'detailed'` = the pristine full-fidelity original for large/hero
 *   display, default (`'standard'`) = the icon-optimized vector for card/row sizes.
 */
export declare function flagUrl(
  code: string,
  options?: { variant?: 'compact' | 'standard' | 'detailed' },
): Promise<string | undefined>;

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

/**
 * Lazy map of ISO 3166-1 alpha-2 (or territory) code -> *detailed* (pre-optimization,
 * full-fidelity) flag SVG URL loader — a subset of `FLAG_LOADERS`, one entry per code whose
 * source art was large enough to need icon-scale optimization. `flagUrl(code, { variant:
 * 'detailed' })` checks this first.
 */
export { FLAG_LOADERS_DETAILED } from './flags/generated-detailed.js';

/**
 * Lazy map of ISO 3166-1 alpha-2 (or territory) code -> *compact* (icon-scale WebP raster) flag
 * URL loader — the same subset of codes as `FLAG_LOADERS_DETAILED` (the ~65 emblem flags), one
 * entry per code with a `flags/compact/<code>.webp`. `flagUrl(code, { variant: 'compact' })`
 * checks this first, falling back to `FLAG_LOADERS` for a code with no compact raster.
 */
export { FLAG_LOADERS_COMPACT } from './flags/generated-compact.js';
