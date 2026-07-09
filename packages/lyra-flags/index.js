/**
 * Resolves the URL of a flag PNG shipped in this package, relative to this
 * module's own location — works unbundled in a browser and is understood by
 * every major bundler (Vite/webpack/Rollup) as a static asset reference.
 * @param {string} code ISO 3166-1 alpha-2 country/territory code, lowercase (e.g. `fr`, `us`).
 * @returns {string}
 */
export function flagUrl(code) {
  return new URL(`./flags/${code}.png`, import.meta.url).href;
}
