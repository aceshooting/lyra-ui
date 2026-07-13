#!/usr/bin/env node
/**
 * Scans `flags/*.svg` and (re)generates:
 *  - `flags/loaders/<code>.js` — one tiny module per flag, each just
 *    `export default new URL('../<code>.svg', import.meta.url).href;`.
 *  - `flags/generated.js` + `flags/generated.d.ts` — exports `FLAG_LOADERS` (lazy,
 *    `Record<string, () => Promise<string>>`, one
 *    `() => import('./loaders/<code>.js').then((m) => m.default)` per code). This is what
 *    `flagUrl()` uses, and the only flags file `index.js` statically imports.
 *  - `flags/eager.js` + `flags/eager.d.ts` — exports `FLAG_URLS` (eager, `Record<string, string>`,
 *    one `new URL(...)` per code), for the opposite, legitimate case: a consumer that genuinely
 *    wants every flag up front (e.g. a flag-picker listing every country).
 *  - `flags/detailed/loaders/<code>.js` + `flags/generated-detailed.js`/`.d.ts` — same lazy-loader
 *    shape as the two above, but scoped to whichever codes have a `flags/detailed/<code>.svg`
 *    (the pristine, pre-optimization original — see `scripts/optimize-flags.mjs`). Most codes have
 *    no detailed variant (`flags/<code>.svg` was never large enough to need optimizing), so
 *    `FLAG_LOADERS_DETAILED` only ever covers a subset of the full code list.
 *  - `flags/compact/loaders/<code>.js` + `flags/generated-compact.js`/`.d.ts` — same lazy-loader
 *    shape again, but scoped to whichever codes have a `flags/compact/<code>.webp` (the icon-scale
 *    WebP raster — see `scripts/build-compact.mjs`), and pointing at a `.webp` asset rather than a
 *    `.svg`. Same subset as the detailed set (the ~65 emblem flags), so `FLAG_LOADERS_COMPACT` also
 *    only covers part of the full code list; `flagUrl(code, { variant: 'compact' })` checks it.
 *
 * Why `FLAG_URLS` is a *separate file*, not just a second export alongside `FLAG_LOADERS`: this
 * was tried first, and it doesn't work — Vite's asset-URL transform scans a module's source for
 * `new URL(literal, import.meta.url)` and registers/emits each match as soon as that *module* is
 * loaded (i.e. reached by the static import graph), independent of and *before* Rollup's later
 * tree-shaking of unused bindings. So if `FLAG_URLS`'s 249 `new URL()` calls lived in the same
 * file as `FLAG_LOADERS`, merely importing `FLAG_LOADERS` for `flagUrl()` would still cause Vite to
 * process and emit all 249 eager entries too, even though the `FLAG_URLS` binding itself is
 * unused (confirmed with a real Vite build: the JS output was byte-identical with or without
 * `"sideEffects": false` in package.json, since that flag governs module-level elision, not
 * whether an already-loaded module's asset references get processed). Putting `FLAG_URLS` in its
 * own file that `index.js` never statically `import`s — only reachable via `flagUrls()`'s dynamic
 * `import()` below — means a `flagUrl()`-only consumer's build never loads/transforms
 * `flags/eager.js` at all, so none of its 249 assets are touched (confirmed with a real Vite
 * build: referencing only 2 codes via `flagUrl()` still leaves the complete lazy graph reachable,
 * even though the browser fetches only the requested assets at runtime).
 *
 * `flags/eager.js`'s own 249 `new URL()` calls have the exact same "keep all 249 once loaded"
 * property `FLAG_LOADERS` used to have — that's fine and expected, since `flagUrls()` is only
 * for a consumer that already wants every flag.
 *
 * `FLAG_LOADERS[code]()`/`flagUrl()`: each loader is a genuine dynamic `import()` of its own tiny
 * per-code module with a literal (non-templated) specifier, which is exactly the pattern bundlers
 * use to create a real, separate, lazily-fetched chunk per file — calling `FLAG_LOADERS['fr']()`
 * at runtime only ever triggers a network fetch for `fr`'s chunk; the other 248 are not fetched
 * until requested. Literal asset subpath imports are the build-time-pruning option.
 *
 * Every loader module — and every `import()` specifier that reaches it — uses
 * `new URL(literal, import.meta.url)` / a literal `.js` specifier, never a bundler-specific
 * suffix like `?url`, so this still works completely unbundled (a plain browser
 * `<script type="module">`, Node, `@web/test-runner`'s unbundled ESM, ...): dynamic `import()` of
 * a plain `.js` file, and `new URL()` of an adjacent asset, are both native, loader-free platform
 * behavior — see `flags/loaders/*.js`.
 *
 * Run via `pnpm run generate` (wired into `prepack`, so it also runs before publish). The
 * generated files are committed — do not hand-edit them, re-run this script instead.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const flagsDir = path.join(scriptDir, '..', 'flags');
const loadersDir = path.join(flagsDir, 'loaders');
const detailedDir = path.join(flagsDir, 'detailed');
const detailedLoadersDir = path.join(detailedDir, 'loaders');
const compactDir = path.join(flagsDir, 'compact');
const compactLoadersDir = path.join(compactDir, 'loaders');

const SVG_RE = /\.svg$/;
const WEBP_RE = /\.webp$/;

// Every shipped code is a plain lowercase a-z string (verified below), which is always a valid
// *unquoted* object-literal property name in JS — including ones that collide with reserved
// words like `do` (Dominican Republic) and `in` (India): reserved words are only disallowed as
// *identifiers* (e.g. a binding name), not as object property names. So, unlike an `import`
// binding, no sanitizing/suffixing is needed here.
const PLAIN_CODE_RE = /^[a-z]+$/;

function collectCodes() {
  const codes = readdirSync(flagsDir)
    .filter((name) => SVG_RE.test(name))
    .map((name) => name.replace(SVG_RE, ''))
    .sort((a, b) => a.localeCompare(b));

  if (codes.length === 0) {
    throw new Error(`No .svg files found in ${flagsDir} — refusing to generate an empty map.`);
  }

  for (const code of codes) {
    if (!PLAIN_CODE_RE.test(code)) {
      // Would need quoting/escaping as an object-literal key; fail loudly instead of silently
      // emitting broken JS, since no shipped code currently needs this.
      throw new Error(
        `flags/${code}.svg: code '${code}' is not a plain lowercase a-z string — ` +
          'generate-index.mjs assumes every code is a safe, unquoted object-literal key.',
      );
    }
  }

  return codes;
}

/** Codes with a preserved pristine original at `flags/detailed/<code>.svg` — a subset of
 *  `collectCodes()`'s full list, populated by `scripts/optimize-flags.mjs`. Returns `[]` if
 *  `flags/detailed/` doesn't exist yet (no flag has ever needed optimizing). */
function collectDetailedCodes(allCodes) {
  if (!existsSync(detailedDir)) return [];
  const allCodeSet = new Set(allCodes);
  const codes = readdirSync(detailedDir)
    .filter((name) => SVG_RE.test(name))
    .map((name) => name.replace(SVG_RE, ''))
    .sort((a, b) => a.localeCompare(b));

  for (const code of codes) {
    if (!allCodeSet.has(code)) {
      throw new Error(
        `flags/detailed/${code}.svg has no matching flags/${code}.svg — a detailed variant must ` +
          'pair with a compact base flag of the same code.',
      );
    }
  }

  return codes;
}

/** Codes with a compact icon-scale raster at `flags/compact/<code>.webp` — a subset of
 *  `collectCodes()`'s full list, populated by `scripts/build-compact.mjs` (the ~65 emblem flags
 *  whose vector art is far too heavy for icon use). Returns `[]` if `flags/compact/` doesn't exist
 *  yet (no flag has ever needed a compact raster). */
function collectCompactCodes(allCodes) {
  if (!existsSync(compactDir)) return [];
  const allCodeSet = new Set(allCodes);
  const codes = readdirSync(compactDir)
    .filter((name) => WEBP_RE.test(name))
    .map((name) => name.replace(WEBP_RE, ''))
    .sort((a, b) => a.localeCompare(b));

  for (const code of codes) {
    if (!allCodeSet.has(code)) {
      throw new Error(
        `flags/compact/${code}.webp has no matching flags/${code}.svg — a compact variant must ` +
          'pair with a standard base flag of the same code.',
      );
    }
  }

  return codes;
}

function banner() {
  return (
    '// AUTO-GENERATED FILE. Do not edit by hand.\n' +
    '// Run `pnpm --filter @aceshooting/lyra-flags run generate` (scripts/generate-index.mjs) to\n' +
    '// regenerate after adding/removing/renaming a file in flags/.\n'
  );
}

function renderLoaderJs(code) {
  return `${banner()}\nexport default new URL('../${code}.svg', import.meta.url).href;\n`;
}

function renderGeneratedJs(codes) {
  const loaderLines = codes
    .map((code) => `  ${code}: () => import('./loaders/${code}.js').then((m) => m.default),`)
    .join('\n');

  return (
    `${banner()}\n` +
    '/**\n' +
    ' * Lazy map of ISO 3166-1 alpha-2 (or territory) code -> flag SVG URL loader. Each entry is a\n' +
    " * `() => import('./loaders/xx.js')` with a literal (non-templated) specifier, so bundlers\n" +
    ' * code-split every flag into its own lazy loader and never fetch a given flag until its\n' +
    ' * specific loader is actually called. Bundlers may still emit the complete reachable lazy\n' +
    ' * graph; this is what `flagUrl()` uses. See index.js — and\n' +
    ' * critically, do NOT add an eager (`new URL()`-per-code) export to *this* file; see\n' +
    ' * generate-index.mjs for why that defeats the whole point.\n' +
    ' * @type {Record<string, () => Promise<string>>}\n' +
    ' */\n' +
    `export const FLAG_LOADERS = {\n${loaderLines}\n};\n`
  );
}

function renderGeneratedDts() {
  return (
    `${banner()}\n` +
    '/** Lazy map of ISO 3166-1 alpha-2 (or territory) code -> flag SVG URL loader. */\n' +
    'export declare const FLAG_LOADERS: Record<string, () => Promise<string>>;\n'
  );
}

function renderEagerJs(codes) {
  const urlLines = codes.map((code) => `  ${code}: new URL('./${code}.svg', import.meta.url).href,`).join('\n');

  return (
    `${banner()}\n` +
    '/**\n' +
    ' * Eager map of ISO 3166-1 alpha-2 (or territory) code -> flag SVG URL. Importing this file\n' +
    ' * pulls in all 249 flags at once — only use this (via `flagUrls()` in index.js) for a\n' +
    ' * consumer that genuinely wants every flag up front (e.g. a flag-picker listing every\n' +
    ' * country). Deliberately its own file, not a second export alongside FLAG_LOADERS — see\n' +
    ' * generate-index.mjs.\n' +
    ' * @type {Record<string, string>}\n' +
    ' */\n' +
    `export const FLAG_URLS = {\n${urlLines}\n};\n`
  );
}

function renderEagerDts() {
  return (
    `${banner()}\n` +
    '/** Eager map of ISO 3166-1 alpha-2 (or territory) code -> flag SVG URL. */\n' +
    'export declare const FLAG_URLS: Record<string, string>;\n'
  );
}

function renderDetailedLoaderJs(code) {
  return `${banner()}\nexport default new URL('../${code}.svg', import.meta.url).href;\n`;
}

function renderGeneratedDetailedJs(codes) {
  const loaderLines = codes
    .map((code) => `  ${code}: () => import('./detailed/loaders/${code}.js').then((m) => m.default),`)
    .join('\n');

  return (
    `${banner()}\n` +
    '/**\n' +
    ' * Lazy map of ISO 3166-1 alpha-2 (or territory) code -> *detailed* (pre-optimization,\n' +
    ' * full-fidelity) flag SVG URL loader — a subset of FLAG_LOADERS, one entry per code that has\n' +
    ' * a flags/detailed/<code>.svg. `flagUrl(code, { variant: \'detailed\' })` checks this map\n' +
    ' * first, falling back to FLAG_LOADERS for a code with no detailed variant. See\n' +
    ' * scripts/optimize-flags.mjs for how flags/detailed/ is populated.\n' +
    ' * @type {Record<string, () => Promise<string>>}\n' +
    ' */\n' +
    `export const FLAG_LOADERS_DETAILED = {\n${loaderLines}\n};\n`
  );
}

function renderGeneratedDetailedDts() {
  return (
    `${banner()}\n` +
    '/** Lazy map of ISO 3166-1 alpha-2 (or territory) code -> detailed flag SVG URL loader. */\n' +
    'export declare const FLAG_LOADERS_DETAILED: Record<string, () => Promise<string>>;\n'
  );
}

function renderCompactLoaderJs(code) {
  return `${banner()}\nexport default new URL('../${code}.webp', import.meta.url).href;\n`;
}

function renderGeneratedCompactJs(codes) {
  const loaderLines = codes
    .map((code) => `  ${code}: () => import('./compact/loaders/${code}.js').then((m) => m.default),`)
    .join('\n');

  return (
    `${banner()}\n` +
    '/**\n' +
    ' * Lazy map of ISO 3166-1 alpha-2 (or territory) code -> *compact* (icon-scale WebP raster)\n' +
    ' * flag URL loader — a subset of FLAG_LOADERS, one entry per code that has a\n' +
    " * flags/compact/<code>.webp. `flagUrl(code, { variant: 'compact' })` checks this map first,\n" +
    ' * falling back to FLAG_LOADERS (the standard vector) for a code with no compact variant. See\n' +
    ' * scripts/build-compact.mjs for how flags/compact/ is populated. Note the entries point at a\n' +
    ' * .webp asset, not a .svg — the compact tier is a raster (see build-compact.mjs for why).\n' +
    ' * @type {Record<string, () => Promise<string>>}\n' +
    ' */\n' +
    `export const FLAG_LOADERS_COMPACT = {\n${loaderLines}\n};\n`
  );
}

function renderGeneratedCompactDts() {
  return (
    `${banner()}\n` +
    '/** Lazy map of ISO 3166-1 alpha-2 (or territory) code -> compact flag WebP URL loader. */\n' +
    'export declare const FLAG_LOADERS_COMPACT: Record<string, () => Promise<string>>;\n'
  );
}

function main() {
  const codes = collectCodes();
  const detailedCodes = collectDetailedCodes(codes);
  const compactCodes = collectCompactCodes(codes);

  mkdirSync(loadersDir, { recursive: true });
  for (const code of codes) {
    writeFileSync(path.join(loadersDir, `${code}.js`), renderLoaderJs(code));
  }
  writeFileSync(path.join(flagsDir, 'generated.js'), renderGeneratedJs(codes));
  writeFileSync(path.join(flagsDir, 'generated.d.ts'), renderGeneratedDts());
  writeFileSync(path.join(flagsDir, 'eager.js'), renderEagerJs(codes));
  writeFileSync(path.join(flagsDir, 'eager.d.ts'), renderEagerDts());

  if (detailedCodes.length > 0) mkdirSync(detailedLoadersDir, { recursive: true });
  for (const code of detailedCodes) {
    writeFileSync(path.join(detailedLoadersDir, `${code}.js`), renderDetailedLoaderJs(code));
  }
  writeFileSync(path.join(flagsDir, 'generated-detailed.js'), renderGeneratedDetailedJs(detailedCodes));
  writeFileSync(path.join(flagsDir, 'generated-detailed.d.ts'), renderGeneratedDetailedDts());

  if (compactCodes.length > 0) mkdirSync(compactLoadersDir, { recursive: true });
  for (const code of compactCodes) {
    writeFileSync(path.join(compactLoadersDir, `${code}.js`), renderCompactLoaderJs(code));
  }
  writeFileSync(path.join(flagsDir, 'generated-compact.js'), renderGeneratedCompactJs(compactCodes));
  writeFileSync(path.join(flagsDir, 'generated-compact.d.ts'), renderGeneratedCompactDts());

  console.log(
    `Generated flags/generated.js + flags/eager.js (+ .d.ts) + flags/loaders/*.js for ${codes.length} flag(s), ` +
      `plus flags/generated-detailed.js (+ .d.ts) + flags/detailed/loaders/*.js for ${detailedCodes.length} ` +
      `detailed variant(s), plus flags/generated-compact.js (+ .d.ts) + flags/compact/loaders/*.js for ` +
      `${compactCodes.length} compact variant(s).`,
  );
}

main();
