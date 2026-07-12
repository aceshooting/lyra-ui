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
 * build: referencing only 2 codes via `flagUrl()` now ships only those 2 flags).
 *
 * `flags/eager.js`'s own 249 `new URL()` calls have the exact same "keep all 249 once loaded"
 * property `FLAG_LOADERS` used to have — that's fine and expected, since `flagUrls()` is only
 * for a consumer that already wants every flag.
 *
 * `FLAG_LOADERS[code]()`/`flagUrl()`: each loader is a genuine dynamic `import()` of its own tiny
 * per-code module with a literal (non-templated) specifier, which is exactly the pattern bundlers
 * use to create a real, separate, lazily-fetched chunk per file — calling `FLAG_LOADERS['fr']()`
 * at runtime only ever triggers a network fetch for `fr`'s chunk, never the other 248 (confirmed
 * with a real Vite build: only the 2 referenced codes' loader chunks were non-trivial; the rest
 * were present as unfetched, never-imported build outputs).
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
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const flagsDir = path.join(scriptDir, '..', 'flags');
const loadersDir = path.join(flagsDir, 'loaders');

const SVG_RE = /\.svg$/;

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
    ' * code-split every flag into its own chunk and never fetch/inline a given flag until its\n' +
    ' * specific loader is actually called. This is what `flagUrl()` uses. See index.js — and\n' +
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

function main() {
  const codes = collectCodes();

  mkdirSync(loadersDir, { recursive: true });
  for (const code of codes) {
    writeFileSync(path.join(loadersDir, `${code}.js`), renderLoaderJs(code));
  }
  writeFileSync(path.join(flagsDir, 'generated.js'), renderGeneratedJs(codes));
  writeFileSync(path.join(flagsDir, 'generated.d.ts'), renderGeneratedDts());
  writeFileSync(path.join(flagsDir, 'eager.js'), renderEagerJs(codes));
  writeFileSync(path.join(flagsDir, 'eager.d.ts'), renderEagerDts());

  console.log(
    `Generated flags/generated.js + flags/eager.js (+ .d.ts) + flags/loaders/*.js for ${codes.length} flag(s).`,
  );
}

main();
