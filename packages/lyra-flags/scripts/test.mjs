#!/usr/bin/env node
/**
 * Plain Node assertion script.
 *
 * This package has no test runner configured (no wtr/mocha/vitest, unlike lyra-ui's
 * @open-wc/testing setup), so this stands in for the usual `*.test.ts` pattern. Run via
 * `pnpm run test` — also picked up automatically by the repo root's
 * `pnpm -r --if-present run test`.
 *
 * Verifies:
 *  - flags/generated.js's FLAG_LOADERS has exactly one `() => import('./loaders/xx.js')` entry
 *    per flags/*.svg file on disk, and flags/eager.js's FLAG_URLS has exactly one matching
 *    `new URL('./xx.svg', import.meta.url)` entry (i.e. the committed generated output is not
 *    stale relative to flags/, and the eager/lazy split didn't drop anything).
 *  - flags/loaders/ has exactly one `<code>.js` file per flags/*.svg file, each a faithful
 *    `new URL('../xx.svg', import.meta.url)` re-export (i.e. loaders aren't stale either).
 *  - `await flagUrl('fr')` / `await flagUrl('us')` resolve to the exact same value
 *    `(await flagUrls()).fr` / `.us` does (flagUrl is a passthrough to `FLAG_LOADERS[code]()`,
 *    which resolves to the same URL `flagUrls()`'s eager map holds).
 *  - The two codes that collide with JS reserved words (`do` — Dominican Republic, `in` — India)
 *    still resolve correctly (reserved words are valid *unquoted* object-literal property names,
 *    so they need no special-casing; this just guards against a future regression).
 *  - `await flagUrl()` of an unmapped code resolves `undefined` rather than a URL that would 404.
 *
 * Unlike a literal `import x from './x.svg'` (which needs a bundler-provided `.svg` loader and
 * so can't be `import`ed by plain Node or served unbundled by e.g. `@web/test-runner`), every
 * asset reference here — `flags/eager.js`'s `new URL('./x.svg', import.meta.url)` entries,
 * `flags/loaders/*.js`'s `new URL('../x.svg', import.meta.url)`, and the literal `.js` specifiers
 * `FLAG_LOADERS`/`flagUrls()` dynamically `import()` — is native platform behavior, no loader
 * required. So the real index.js/flags/generated.js/flags/eager.js/flags/loaders source can be
 * `import`ed directly here, no stubbing/rewriting needed.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { flagUrl, flagUrls, FLAG_LOADERS, FLAG_LOADERS_DETAILED, FLAG_LOADERS_COMPACT } from '../index.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.join(scriptDir, '..');
const flagsDir = path.join(pkgDir, 'flags');
const loadersDir = path.join(flagsDir, 'loaders');
const detailedDir = path.join(flagsDir, 'detailed');
const detailedLoadersDir = path.join(detailedDir, 'loaders');
const compactDir = path.join(flagsDir, 'compact');
const compactLoadersDir = path.join(compactDir, 'loaders');

const svgCodes = readdirSync(flagsDir)
  .filter((name) => name.endsWith('.svg'))
  .map((name) => name.replace(/\.svg$/, ''))
  .sort((a, b) => a.localeCompare(b));

assert.equal(svgCodes.length, 249, `expected 249 flags/*.svg files, found ${svgCodes.length}`);

const eagerSrc = readFileSync(path.join(flagsDir, 'eager.js'), 'utf8');

const urlEntryLines = eagerSrc.match(/^ {2}\S+: new URL\('\.\/.+\.svg', import\.meta\.url\)\.href,$/gm) ?? [];
assert.equal(
  urlEntryLines.length,
  svgCodes.length,
  `expected ${svgCodes.length} FLAG_URLS entries in flags/eager.js, found ${urlEntryLines.length} — ` +
    'run `pnpm run generate` to regenerate.',
);

const urlMappedCodes = urlEntryLines
  .map((line) => line.match(/^ {2}(\S+): new URL\('\.\/(.+)\.svg', import\.meta\.url\)\.href,$/))
  .map(([, key, specifierCode]) => {
    assert.equal(key, specifierCode, `FLAG_URLS key '${key}' does not match its own './${specifierCode}.svg'`);
    return key;
  })
  .sort((a, b) => a.localeCompare(b));
assert.deepEqual(
  urlMappedCodes,
  svgCodes,
  'flags/eager.js FLAG_URLS entries do not match flags/*.svg on disk — run `pnpm run generate`.',
);

const generatedSrc = readFileSync(path.join(flagsDir, 'generated.js'), 'utf8');

const loaderEntryLines =
  generatedSrc.match(/^ {2}\S+: \(\) => import\('\.\/loaders\/.+\.js'\)\.then\(\(m\) => m\.default\),$/gm) ?? [];
assert.equal(
  loaderEntryLines.length,
  svgCodes.length,
  `expected ${svgCodes.length} FLAG_LOADERS entries in flags/generated.js, found ${loaderEntryLines.length} — ` +
    'run `pnpm run generate` to regenerate.',
);
const loaderMappedCodes = loaderEntryLines
  .map((line) => line.match(/^ {2}(\S+): \(\) => import\('\.\/loaders\/(.+)\.js'\)\.then\(\(m\) => m\.default\),$/))
  .map(([, key, specifierCode]) => {
    assert.equal(key, specifierCode, `FLAG_LOADERS key '${key}' does not match its own './loaders/${specifierCode}.js'`);
    return key;
  })
  .sort((a, b) => a.localeCompare(b));
assert.deepEqual(
  loaderMappedCodes,
  svgCodes,
  'flags/generated.js FLAG_LOADERS entries do not match flags/*.svg on disk — run `pnpm run generate`.',
);

const loaderFiles = readdirSync(loadersDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => name.replace(/\.js$/, ''))
  .sort((a, b) => a.localeCompare(b));
assert.deepEqual(
  loaderFiles,
  svgCodes,
  'flags/loaders/*.js does not have exactly one file per flags/*.svg — run `pnpm run generate`.',
);
for (const code of svgCodes) {
  const src = readFileSync(path.join(loadersDir, `${code}.js`), 'utf8');
  assert.match(
    src,
    new RegExp(`export default new URL\\('\\.\\./${code}\\.svg', import\\.meta\\.url\\)\\.href;`),
    `flags/loaders/${code}.js is stale or malformed — run \`pnpm run generate\`.`,
  );
}

const urls = await flagUrls();
assert.equal(Object.keys(urls).length, svgCodes.length, 'flagUrls() entry count mismatch');
assert.equal(Object.keys(FLAG_LOADERS).length, svgCodes.length, 'FLAG_LOADERS entry count mismatch');
for (const code of svgCodes) {
  assert.ok(code in urls, `flagUrls() missing entry for '${code}'`);
  assert.equal(typeof urls[code], 'string');
  assert.ok(code in FLAG_LOADERS, `FLAG_LOADERS missing entry for '${code}'`);
  assert.equal(typeof FLAG_LOADERS[code], 'function');
  // eslint-disable-next-line no-await-in-loop -- plain assertion script, sequential is fine here
  const resolved = await flagUrl(code);
  assert.equal(resolved, urls[code], `flagUrl('${code}') must resolve to the same URL flagUrls().${code} does`);
}

assert.ok(await flagUrl('fr'), "flagUrl('fr') should resolve to a truthy URL");
assert.ok(await flagUrl('us'), "flagUrl('us') should resolve to a truthy URL");
assert.equal(await flagUrl('fr'), urls.fr);
assert.equal(await flagUrl('us'), urls.us);

// Reserved-word codes: valid unquoted object-literal property names, so they need no
// sanitizing — guard against a future regeneration reintroducing that complexity incorrectly.
assert.ok(await flagUrl('do'), "flagUrl('do') (Dominican Republic) should still resolve");
assert.ok(await flagUrl('in'), "flagUrl('in') (India) should still resolve");

// Unknown code -> undefined, not a URL that will 404.
assert.equal(await flagUrl('zz-not-a-real-code'), undefined);
assert.equal(urls['zz-not-a-real-code'], undefined);
assert.equal(FLAG_LOADERS['zz-not-a-real-code'], undefined);

// --- Detailed-variant pipeline (scripts/optimize-flags.mjs / the `detailed` half of
// --- generate-index.mjs) ---

const detailedCodes = existsSync(detailedDir)
  ? readdirSync(detailedDir)
      .filter((name) => name.endsWith('.svg'))
      .map((name) => name.replace(/\.svg$/, ''))
      .sort((a, b) => a.localeCompare(b))
  : [];

assert.equal(
  Object.keys(FLAG_LOADERS_DETAILED).length,
  detailedCodes.length,
  'FLAG_LOADERS_DETAILED entry count does not match flags/detailed/*.svg on disk — run `pnpm run generate`.',
);
for (const code of detailedCodes) {
  assert.ok(code in FLAG_LOADERS, `flags/detailed/${code}.svg has no matching flags/${code}.svg`);
  assert.ok(code in FLAG_LOADERS_DETAILED, `FLAG_LOADERS_DETAILED missing entry for '${code}'`);
  // eslint-disable-next-line no-await-in-loop -- plain assertion script, sequential is fine here
  const detailedUrl = await flagUrl(code, { variant: 'detailed' });
  assert.ok(detailedUrl, `flagUrl('${code}', { variant: 'detailed' }) should resolve to a truthy URL`);
  // eslint-disable-next-line no-await-in-loop
  const defaultUrl = await flagUrl(code);
  assert.notEqual(
    detailedUrl,
    defaultUrl,
    `'${code}' has a detailed variant, so its default and detailed URLs must differ`,
  );
}

if (existsSync(detailedLoadersDir)) {
  const detailedLoaderFiles = readdirSync(detailedLoadersDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => name.replace(/\.js$/, ''))
    .sort((a, b) => a.localeCompare(b));
  assert.deepEqual(
    detailedLoaderFiles,
    detailedCodes,
    'flags/detailed/loaders/*.js does not have exactly one file per flags/detailed/*.svg — run `pnpm run generate`.',
  );
}

// A code with no detailed variant falls back to the same URL for both — requesting `detailed`
// must never 404 or diverge just because a flag was never large enough to need optimizing.
const nonDetailedCode = svgCodes.find((code) => !detailedCodes.includes(code));
if (nonDetailedCode) {
  assert.equal(
    await flagUrl(nonDetailedCode, { variant: 'detailed' }),
    await flagUrl(nonDetailedCode),
    `'${nonDetailedCode}' has no detailed variant, so both flagUrl() calls must resolve identically`,
  );
}

// --- Compact-variant pipeline (scripts/build-compact.mjs / the `compact` half of
// --- generate-index.mjs). Same lazy-loader shape as the detailed half, but the assets are .webp
// --- rasters, not .svg. ---

const compactCodes = existsSync(compactDir)
  ? readdirSync(compactDir)
      .filter((name) => name.endsWith('.webp'))
      .map((name) => name.replace(/\.webp$/, ''))
      .sort((a, b) => a.localeCompare(b))
  : [];

assert.equal(
  Object.keys(FLAG_LOADERS_COMPACT).length,
  compactCodes.length,
  'FLAG_LOADERS_COMPACT entry count does not match flags/compact/*.webp on disk — run `pnpm run generate`.',
);
for (const code of compactCodes) {
  assert.ok(code in FLAG_LOADERS, `flags/compact/${code}.webp has no matching flags/${code}.svg`);
  assert.ok(code in FLAG_LOADERS_COMPACT, `FLAG_LOADERS_COMPACT missing entry for '${code}'`);
  // eslint-disable-next-line no-await-in-loop -- plain assertion script, sequential is fine here
  const compactUrl = await flagUrl(code, { variant: 'compact' });
  assert.ok(compactUrl, `flagUrl('${code}', { variant: 'compact' }) should resolve to a truthy URL`);
  assert.match(compactUrl, /\.webp(?:[?#]|$)/, `compact URL for '${code}' should point at a .webp asset`);
  // eslint-disable-next-line no-await-in-loop
  const defaultUrl = await flagUrl(code);
  assert.notEqual(compactUrl, defaultUrl, `'${code}' has a compact variant, so its default and compact URLs must differ`);
}

if (existsSync(compactLoadersDir)) {
  const compactLoaderFiles = readdirSync(compactLoadersDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => name.replace(/\.js$/, ''))
    .sort((a, b) => a.localeCompare(b));
  assert.deepEqual(
    compactLoaderFiles,
    compactCodes,
    'flags/compact/loaders/*.js does not have exactly one file per flags/compact/*.webp — run `pnpm run generate`.',
  );
  for (const code of compactCodes) {
    const src = readFileSync(path.join(compactLoadersDir, `${code}.js`), 'utf8');
    assert.match(
      src,
      new RegExp(`export default new URL\\('\\.\\./${code}\\.webp', import\\.meta\\.url\\)\\.href;`),
      `flags/compact/loaders/${code}.js is stale or malformed — run \`pnpm run generate\`.`,
    );
  }
}

// A code with no compact variant falls back to the standard URL — requesting `compact` must never
// 404 or diverge just because a flag was never heavy enough to need a raster.
const nonCompactCode = svgCodes.find((code) => !compactCodes.includes(code));
if (nonCompactCode) {
  assert.equal(
    await flagUrl(nonCompactCode, { variant: 'compact' }),
    await flagUrl(nonCompactCode),
    `'${nonCompactCode}' has no compact variant, so both flagUrl() calls must resolve identically`,
  );
}

// The compact and detailed sets must cover exactly the same codes (both are the emblem outliers,
// derived from the same flags/detailed/ originals) — a mismatch means build-compact/optimize were
// not both re-run after a source change.
assert.deepEqual(
  compactCodes,
  detailedCodes,
  'compact and detailed variants must cover the same set of codes — run `pnpm run optimize && pnpm run build-compact && pnpm run generate`.',
);

// --- Standard-tier size budget. The default tier renders at card/row sizes and must stay
// --- lightweight; scripts/optimize-flags.mjs is tuned to keep every flag under this ceiling. ---
const STANDARD_BUDGET_BYTES = 80_000;
for (const code of svgCodes) {
  const size = statSync(path.join(flagsDir, `${code}.svg`)).size;
  assert.ok(
    size <= STANDARD_BUDGET_BYTES,
    `flags/${code}.svg is ${size} B, over the ${STANDARD_BUDGET_BYTES} B standard-tier budget — run \`pnpm run optimize\`.`,
  );
}

console.log(
  `OK — ${svgCodes.length} flags verified (${detailedCodes.length} with detailed + ${compactCodes.length} with ` +
    `compact variants, all standard flags <= ${STANDARD_BUDGET_BYTES / 1000} KB); flagUrl()/FLAG_LOADERS agree ` +
    "with flagUrls()'s eager map.",
);
