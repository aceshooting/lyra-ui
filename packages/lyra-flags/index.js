import { FLAG_LOADERS } from './flags/generated.js';
import { FLAG_LOADERS_DETAILED } from './flags/generated-detailed.js';
import { FLAG_LOADERS_COMPACT } from './flags/generated-compact.js';

/**
 * Resolves the URL of one flag SVG. The browser fetches only the requested flag at runtime; a
 * bundler may still emit the complete reachable lazy-chunk graph because every supported code is
 * represented by a literal loader import. See the package README for artifact-pruning options.
 *
 * Backing story: this used to be a synchronous lookup into `FLAG_URLS`, a single object literal
 * with one `new URL('./xx.svg', import.meta.url)` per code, evaluated eagerly the moment the
 * module loaded. That fixed the *original* bug (a dynamic template literal —
 * `new URL(\`./flags/${code}.svg\`, import.meta.url)` — which defeats bundler static analysis
 * outright and made bundlers fall back to inlining the entire `flags/` directory) but introduced
 * a subtler one: `FLAG_URLS[code]` is a runtime-dynamic bracket lookup into one eagerly-evaluated
 * object, and no static bundler can tell which property a caller will actually read, so it had to
 * keep every one of the 249 entries — confirmed with a real Vite build referencing only 2 codes,
 * which still shipped all 249, whether or not `FLAG_URLS` itself was ever imported by the caller
 * (`"sideEffects": false` doesn't help — it governs whether an unused *module* can be skipped
 * entirely, not whether an already-loaded module's asset references get processed; merely
 * importing `FLAG_LOADERS` from the same file was enough to make Vite emit all 249 `FLAG_URLS`
 * assets too).
 *
 * `flagUrl()` now goes through `FLAG_LOADERS` instead: one `() => import('./loaders/xx.js')` per
 * code, each with a literal (non-templated) specifier pointing at its own tiny per-flag module —
 * and, critically, `FLAG_LOADERS` lives in its own file (`flags/generated.js`) that never itself
 * `import`s the eager map, so loading it doesn't drag in `flags/eager.js` too. A dynamic
 * `import()` of a literal specifier is exactly the pattern bundlers use to create a genuinely
 * separate, lazily-fetched chunk per file — calling `flagUrl('fr')` only ever triggers a network
 * fetch for `fr`'s chunk; the other flags are not fetched until requested. Every loader module
 * (see `flags/loaders/*.js`) itself
 * uses `new URL(literal, import.meta.url)`, and every `import()` here uses a literal `.js`
 * specifier — never a bundler-specific suffix like `?url` — so this still works completely
 * unbundled (a plain browser `<script type="module">`, Node, `@web/test-runner`'s unbundled
 * ESM, ...): dynamic `import()` of a plain `.js` file, and `new URL()` of an adjacent asset, are
 * both native, loader-free platform behavior.
 * The default (no `variant`, or `'standard'`) is the icon-optimized vector for card/row sizes.
 * `options.variant` picks a different fidelity tier for the ~65 codes whose source art embeds a
 * coat of arms / seal / emblem (`code in FLAG_LOADERS_DETAILED`); for every other code all tiers
 * resolve to the same standard file, so any variant is a safe no-op rather than an error:
 *   - `'compact'` — a tiny WebP raster (`code in FLAG_LOADERS_COMPACT`, see `scripts/build-compact.mjs`)
 *     for icon-scale use (menus, language selectors; ~12-28px), where the emblem detail is invisible
 *     anyway. Falls back to the standard vector for a code with no compact raster.
 *   - `'detailed'` — the pristine, pre-optimization original vector (`scripts/optimize-flags.mjs`),
 *     for rendering larger than icon scale (e.g. a hero display) with the full illustrative detail.
 * @param {string} code ISO 3166-1 alpha-2 country/territory code, lowercase (e.g. `fr`, `us`).
 * @param {{ variant?: 'compact' | 'standard' | 'detailed' }} [options]
 * @returns {Promise<string | undefined>} The flag's URL. For a `code` with no matching shipped
 *   flag, resolves `undefined` (same non-crashing "no image" outcome as the old code's
 *   now-404ing URL, for `<lyra-flag>`'s `<img src>` use).
 */
export function flagUrl(code, options) {
  if (options?.variant === 'detailed' && FLAG_LOADERS_DETAILED[code]) {
    return FLAG_LOADERS_DETAILED[code]();
  }
  if (options?.variant === 'compact' && FLAG_LOADERS_COMPACT[code]) {
    return FLAG_LOADERS_COMPACT[code]();
  }
  return FLAG_LOADERS[code]?.() ?? Promise.resolve(undefined);
}

/**
 * Resolves *every* shipped flag's URL at once — the opposite, legitimate case from `flagUrl()`:
 * for a consumer that genuinely wants every flag up front (e.g. a flag-picker UI listing every
 * country), not just one or two. A real dynamic `import()` of `flags/eager.js` (a separate file
 * from `FLAG_LOADERS` — see `flagUrl()`'s doc for why that separation matters), so a caller that
 * never calls this never pays for any of the 249 flags; a caller that does pays for all 249 at
 * once, deliberately (there is no per-code laziness once you're in this function — that's the
 * whole point of wanting "every flag").
 * @returns {Promise<Record<string, string>>} Map of ISO 3166-1 alpha-2 (or territory) code -> flag
 *   SVG URL, one entry per shipped flag.
 */
export async function flagUrls() {
  return (await import('./flags/eager.js')).FLAG_URLS;
}

export { FLAG_LOADERS, FLAG_LOADERS_DETAILED, FLAG_LOADERS_COMPACT };
