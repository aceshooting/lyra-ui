import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import {
  capturePluralCategoryPin,
  pinnedPluralCategories,
  validatePluralCategoryPin,
} from './cldr-plural-categories.mjs';

const example = () => ({
  schemaVersion: 1,
  runtime: { node: '22.23.2', icu: '78.2', cldr: '48.0', unicode: '17.0' },
  source: 'Captured from the exact pinned cardinal plural rules implementation.',
  locales: { en: ['one', 'other'], fr: ['many', 'one', 'other'] },
});

test('category lookup uses the reviewed snapshot without consulting host plural rules', () => {
  const pin = example();
  const previous = Intl.PluralRules;
  Intl.PluralRules = class { constructor() { throw new Error('host ICU must not be queried'); } };
  try {
    assert.deepEqual(pinnedPluralCategories(pin, 'fr'), ['many', 'one', 'other']);
    const result = pinnedPluralCategories(pin, 'en');
    result.push('many');
    assert.deepEqual(pin.locales.en, ['one', 'other']);
    assert.throws(() => pinnedPluralCategories(pin, 'fr-CA'), /no exact entry/);
  } finally {
    Intl.PluralRules = previous;
  }
});

test('lookup rejects inherited or malformed category entries', () => {
  assert.throws(() => pinnedPluralCategories({ locales: Object.create({ en: ['other'] }) }, 'en'), /no exact entry/);
  assert.throws(() => pinnedPluralCategories({ locales: { en: ['one'] } }, 'en'), /category/);
});

test('pin validation rejects provenance drift and malformed categories', () => {
  assert.deepEqual(validatePluralCategoryPin(example()), []);
  for (const [field, value] of [['node', '22.0.0'], ['icu', '77.1'], ['cldr', '47.0'], ['unicode', '16.0']]) {
    const pin = example();
    pin.runtime[field] = value;
    assert.ok(validatePluralCategoryPin(pin).some((error) => error.includes(`runtime.${field}`)));
  }
  for (const categories of [[], ['one'], ['other', 'one'], ['other', 'other'], ['invalid', 'other']]) {
    const pin = example();
    pin.locales.en = categories;
    assert.ok(validatePluralCategoryPin(pin).some((error) => error.includes('locales.en')));
  }
  assert.ok(validatePluralCategoryPin({ ...example(), locales: {} }).some((error) => error.includes('English')));
  assert.ok(validatePluralCategoryPin({ ...example(), locales: { EN: ['other'] } }).some((error) => error.includes('canonical')));
});

test('explicit capture requires the exact contributor runtime and supported canonical tags', () => {
  assert.throws(() => capturePluralCategoryPin(['en'], { ...process.versions, icu: '0' }), /capture requires/);
  assert.deepEqual(Object.keys(capturePluralCategoryPin(['EN']).locales), ['en']);
  assert.throws(() => capturePluralCategoryPin(['qzz']), /unsupported/);
  const pin = capturePluralCategoryPin(['fr', 'en', 'fr']);
  assert.deepEqual(Object.keys(pin.locales), ['en', 'fr']);
  assert.deepEqual(validatePluralCategoryPin(pin), []);
});

test('canonicalizes shipped aliases and records the unsupported Lahnda compatibility fallback honestly', () => {
  const pin = capturePluralCategoryPin(['tl', 'pnb']);
  assert.deepEqual(Object.keys(pin.locales), ['en', 'fil', 'lah']);
  assert.deepEqual(pinnedPluralCategories(pin, 'tl'), pin.locales.fil);
  assert.deepEqual(pinnedPluralCategories(pin, 'pnb'), pin.locales.lah);
  assert.deepEqual(pin.locales.lah, ['one', 'other']);
  assert.equal(pin.runtimeFallbacks.lah.resolvedLocale, 'en-US');
  assert.match(pin.runtimeFallbacks.lah.reason, /not Lahnda grammatical certification/);
  assert.deepEqual(validatePluralCategoryPin(pin), []);
  delete pin.runtimeFallbacks.lah;
  assert.ok(validatePluralCategoryPin(pin).some((error) => error.includes('provenance')));
});

test('the checked-in snapshot covers every shipped aggregate and pseudo tag at the pinned runtime', () => {
  const pin = JSON.parse(readFileSync(new URL('./fixtures/cldr-plural-categories.json', import.meta.url), 'utf8'));
  assert.deepEqual(validatePluralCategoryPin(pin), []);
  const tags = ['en', ...['../src/translations/', '../src/translations/pseudo/'].flatMap((directory) =>
    readdirSync(new URL(directory, import.meta.url))
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map((file) => file.slice(0, -3)))];
  for (const tag of tags) assert.ok(pinnedPluralCategories(pin, tag).includes('other'), tag);
  assert.deepEqual(pin, capturePluralCategoryPin(tags));
});
