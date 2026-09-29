import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { analyzeLocaleInventory, artifactProblems, canonicalCatalogIdentities, countCoverage, renderLocaleArtifacts, renderLocaleLoaderMap } from './locale-manifest.mjs';
import { pinnedPluralCategories } from './cldr-plural-categories.mjs';
import { validateTranslationReviews } from './translation-review.mjs';

const pinnedRuntime = { node: '22.23.2', icu: '78.2', cldr: '48.0', unicode: '17.0' };
const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('coverage counts report untranslated source keys instead of claiming fallback completeness', () => {
  assert.deepEqual(countCoverage({
    locale: 'fr',
    ownKeys: ['one', 'two'],
    sourceKeys: ['one', 'two', 'three'],
    parent: null,
  }), { translatedOwnKeyCount: 2, inheritedKeyCount: 0, missingKeyCount: 1 });
});

test('canonical catalog identities reject colliding authored aliases and unknown plural pins', () => {
  assert.equal(canonicalCatalogIdentities(['tl']).get('fil'), 'tl');
  assert.throws(() => canonicalCatalogIdentities(['tl', 'fil']), /both canonicalize to fil/u);
  assert.throws(() => pinnedPluralCategories({ locales: { en: ['one', 'other'] } }, 'zz-ZZ'), /no exact entry/u);
});

test('manifest and loader map preserve authored aliases while publishing canonical tags', async () => {
  const { manifest, loaderLocales, inventory } = await analyzeLocaleInventory({ runtime: pinnedRuntime });
  const byLocale = new Map(manifest.locales.map((entry) => [entry.locale, entry]));

  assert.equal(inventory.catalogs.size, 66);
  assert.equal(byLocale.get('fil').sourceLocale, 'tl');
  assert.equal(byLocale.get('fil').aggregateImport, '@aceshooting/lyra-ui/translations/tl.js');
  assert.equal(byLocale.get('lah').sourceLocale, 'pnb');
  assert.equal(byLocale.get('lah').aggregateImport, '@aceshooting/lyra-ui/translations/pnb.js');
  assert.equal(byLocale.get('lah').pluralCategories.join(','), 'one,other');
  assert.equal(manifest.runtimeFallbacks.lah.resolvedLocale, 'en-US');
  assert.equal(loaderLocales.find((entry) => entry.locale === 'fil').importPath, '../translations/tl.js');
  assert.equal(loaderLocales.find((entry) => entry.locale === 'lah').importPath, '../translations/pnb.js');
  assert.equal(loaderLocales.some((entry) => entry.locale === 'en'), false);
  assert.equal(loaderLocales.some((entry) => entry.locale === 'en-XA' || entry.locale === 'ar-XB'), false);
});

test('literal loader map contains one exact import per canonical catalog', () => {
  const source = renderLocaleLoaderMap([
    { locale: 'lah', sourceLocale: 'pnb', importPath: '../translations/pnb.js' },
    { locale: 'fil', sourceLocale: 'tl', importPath: '../translations/tl.js' },
  ]);
  assert.match(source, /'fil': \(\) => import\('\.\.\/translations\/tl\.js'\)/u);
  assert.match(source, /'lah': \(\) => import\('\.\.\/translations\/pnb\.js'\)/u);
  assert.throws(
    () => renderLocaleLoaderMap([{ locale: 'fil', importPath: '../translations/../internal/localization.js' }]),
    /import path is invalid/u,
  );
});

test('generated artifact check reports missing and stale outputs', async () => {
  const { manifest, loaderLocales } = await analyzeLocaleInventory({ runtime: pinnedRuntime });
  const artifacts = renderLocaleArtifacts({ manifest, loaderLocales });
  const problems = await artifactProblems(artifacts, { read: async (file) => file.endsWith('locales.json') ? '{}' : Promise.reject(new Error('missing')) });
  assert.equal(problems.length, 2);
  assert.match(problems[0], /locales\.json is stale/u);
  assert.match(problems[1], /locale-loaders\.generated\.ts is missing/u);
});

test('review snapshots fail closed when a shipped catalog changes after review', async () => {
  const { inventory } = await analyzeLocaleInventory({ runtime: pinnedRuntime });
  const reviews = JSON.parse(await readFile(path.join(packageDir, 'scripts/fixtures/translation-reviews.json'), 'utf8'));
  const upstream = JSON.parse(await readFile(path.join(packageDir, 'scripts/fixtures/upstream-tags.json'), 'utf8'));
  const changed = structuredClone(reviews);
  changed.catalogs[0].catalog.sha256 = '0'.repeat(64);
  const errors = validateTranslationReviews(changed, {
    englishEntries: inventory.englishEntries,
    catalogs: inventory.catalogs,
    upstreamPins: { webawesome: upstream.webawesome, shoelace: upstream.shoelace },
    requireApproved: false,
  });
  assert.ok(errors.some((error) => error.includes('.catalog.sha256 is stale')));
});

test('delta coverage counts only actual inherited keys that are not overridden', () => {
  assert.deepEqual(countCoverage({
    locale: 'de-CH', ownKeys: ['one'], sourceKeys: ['one', 'two', 'three'],
    parent: 'de', parentKeys: ['one', 'two'],
  }), { translatedOwnKeyCount: 1, inheritedKeyCount: 1, missingKeyCount: 1 });
  assert.throws(() => countCoverage({ locale: 'de-CH', ownKeys: [], sourceKeys: ['one'], parent: 'de' }), /parent.*keys|parent.*coverage/u);
});
