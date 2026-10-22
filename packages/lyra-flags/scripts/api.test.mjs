import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as root from '../index.js';
import * as standard from '../standard.js';
import * as compact from '../compact.js';
import * as detailed from '../detailed.js';

/** A code with all three fidelity tiers, and one that only has the standard vector. */
const EMBLEM = 'es';
const PLAIN = 'fr';

const resolvers = {
  'root flagUrl': root.flagUrl,
  'standard flagUrl': standard.flagUrl,
  'compact flagUrl': compact.flagUrl,
  'detailed flagUrl': detailed.flagUrl,
  'root bulk resolver': root.createFlagUrlResolver(),
  'standard bulk resolver': standard.createFlagUrlResolver(),
};

const pathOf = url => new URL(url).pathname;
const exportsOf = namespace => Object.keys(namespace).sort();

test('every entry point exposes exactly its documented names and shares the loader maps', () => {
  assert.deepEqual(exportsOf(root), ['FLAG_LOADERS', 'FLAG_LOADERS_COMPACT', 'FLAG_LOADERS_DETAILED', 'createFlagUrlResolver', 'flagUrl', 'flagUrls']);
  assert.deepEqual(exportsOf(standard), ['FLAG_LOADERS', 'createFlagUrlResolver', 'flagUrl', 'flagUrls']);
  assert.deepEqual(exportsOf(compact), ['FLAG_LOADERS_COMPACT', 'flagUrl']);
  assert.deepEqual(exportsOf(detailed), ['FLAG_LOADERS_DETAILED', 'flagUrl']);
  assert.equal(standard.FLAG_LOADERS, root.FLAG_LOADERS);
  assert.equal(compact.FLAG_LOADERS_COMPACT, root.FLAG_LOADERS_COMPACT);
  assert.equal(detailed.FLAG_LOADERS_DETAILED, root.FLAG_LOADERS_DETAILED);
});

test('codes that are not shipped lowercase codes never resolve, whatever the resolver or tier', async () => {
  const unknown = ['FR', 'Fr', ' fr', 'fr ', '', 'fr.svg', '../fr', 'fr/../us', 'detailed/es', 'zz', undefined, null, 0, false, {}];
  for (const [name, resolve] of Object.entries(resolvers)) {
    for (const code of unknown) {
      for (const options of [undefined, { variant: 'standard' }, { variant: 'compact' }, { variant: 'detailed' }]) {
        const result = resolve(code, options);
        assert.ok(result instanceof Promise, `${name}(${String(code)}) must keep the Promise contract`);
        assert.equal(await result, undefined, `${name}(${String(code)}, ${options?.variant}) must not produce a URL that would 404`);
      }
    }
  }
});

test('the fidelity variant picks its own asset, and falls back to the standard vector when a code has none', async () => {
  const urls = {
    standard: await root.flagUrl(EMBLEM),
    compact: await root.flagUrl(EMBLEM, { variant: 'compact' }),
    detailed: await root.flagUrl(EMBLEM, { variant: 'detailed' }),
  };
  assert.equal(pathOf(urls.standard).endsWith(`/flags/${EMBLEM}.svg`), true);
  assert.equal(pathOf(urls.compact).endsWith(`/flags/compact/${EMBLEM}.webp`), true);
  assert.equal(pathOf(urls.detailed).endsWith(`/flags/detailed/${EMBLEM}.svg`), true);
  assert.equal(new Set(Object.values(urls)).size, 3, 'the three tiers are three different files');

  const plain = await root.flagUrl(PLAIN);
  assert.equal(pathOf(plain).endsWith(`/flags/${PLAIN}.svg`), true);
  for (const variant of ['compact', 'detailed']) assert.equal(await root.flagUrl(PLAIN, { variant }), plain, variant);

  // Options that name no tier select the standard one instead of failing.
  for (const options of [null, {}, { variant: 'standard' }, { variant: 'bogus' }, { variant: undefined }, { variant: 'Compact' }]) {
    assert.equal(await root.flagUrl(EMBLEM, options), urls.standard, JSON.stringify(options));
  }

  // The tier-committed entries ignore a variant that names another tier, and honour their own.
  assert.equal(await standard.flagUrl(EMBLEM, { variant: 'detailed' }), urls.standard);
  assert.equal(await compact.flagUrl(EMBLEM), urls.compact);
  assert.equal(await detailed.flagUrl(EMBLEM), urls.detailed);
  assert.equal(await compact.flagUrl(PLAIN), plain);
  assert.equal(await detailed.flagUrl(PLAIN), plain);

  // The bulk resolvers agree with the lazy ones.
  const bulk = root.createFlagUrlResolver();
  assert.equal(await bulk(EMBLEM), urls.standard);
  assert.equal(await bulk(EMBLEM, { variant: 'compact' }), urls.compact);
  assert.equal(await bulk(EMBLEM, { variant: 'detailed' }), urls.detailed);
  assert.equal(await bulk(EMBLEM, { variant: 'bogus' }), urls.standard);
  assert.equal(await bulk(PLAIN, { variant: 'compact' }), plain);
});

test('flagUrls() is one shared, prototype-free map holding exactly the shipped codes', async () => {
  const urls = await root.flagUrls();
  assert.equal(await root.flagUrls(), urls, 'repeated calls reuse the one eager map');
  assert.equal(await standard.flagUrls(), urls);
  assert.equal(Object.getPrototypeOf(urls), null);
  assert.deepEqual(Object.keys(urls).sort(), Object.keys(root.FLAG_LOADERS).sort());
  assert.equal(pathOf(urls[PLAIN]).endsWith(`/flags/${PLAIN}.svg`), true);
});

test('every loader resolves to a file that is shipped in the package', async () => {
  for (const [tier, loaders] of Object.entries({
    standard: root.FLAG_LOADERS, compact: root.FLAG_LOADERS_COMPACT, detailed: root.FLAG_LOADERS_DETAILED,
  })) {
    for (const [code, load] of Object.entries(loaders)) {
      const url = await load();
      assert.equal(existsSync(fileURLToPath(url)), true, `${tier} ${code} points at a missing asset: ${url}`);
    }
  }
});

test('every standard and detailed flag is a square 1000-unit SVG and every compact flag a 128 px WebP', async () => {
  for (const loaders of [root.FLAG_LOADERS, root.FLAG_LOADERS_DETAILED]) {
    for (const [code, load] of Object.entries(loaders)) {
      const svg = readFileSync(fileURLToPath(await load()), 'utf8');
      assert.match(svg, /^<svg\b/u, `${code} is an SVG document`);
      assert.equal(svg.includes('viewBox="0 0 1000 1000"'), true, `${code} must keep the shared framing`);
    }
  }
  for (const [code, load] of Object.entries(root.FLAG_LOADERS_COMPACT)) {
    const { format, width, height } = await sharp(fileURLToPath(await load())).metadata();
    assert.deepEqual({ format, width, height }, { format: 'webp', width: 128, height: 128 }, code);
  }
});
