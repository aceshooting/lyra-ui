import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readTranslationCatalogInventory } from './check-translations.mjs';
import { messageSnapshot } from './translation-review.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'lyra-regional-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['src/internal', 'scripts', 'src/translations/de', 'src/translations/de-CH'])
    await mkdir(path.join(root, directory), { recursive: true });
  const entries = Array.from({ length: 101 }, (_, index) => [`key${index}`, `Message ${index}`]);
  entries[1] = ['key1', { one: 'One item', other: '{count} items' }];
  const object = (values) => values.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(',\n');
  await writeFile(path.join(root, 'src/internal/localization.ts'), `const DEFAULT_STRINGS = {${object(entries)}};`);
  await writeFile(path.join(root, 'scripts/component-families.json'), JSON.stringify({ families: [{ key: 'forms' }, { key: 'layout' }] }));
  const put = async (file, source) => writeFile(path.join(root, 'src/translations', file), source);
  for (const tag of ['de', 'de-CH']) await put(`${tag}.ts`, `import './${tag}/forms.js';\nimport './${tag}/layout.js';`);
  await put('de/forms.ts', `const strings = {${object(entries.slice(0, 100))}}; registerLyraLocale('de', strings);`);
  await put('de/layout.ts', `const strings = {${object(entries.slice(100))}}; registerLyraLocale('de', strings);`);
  await put('de-CH/forms.ts', `import '../de/forms.js'; const strings = {key0: 'Swiss'}; registerLyraLocaleDelta('de-CH', 'de', strings, {dir: 'ltr'});`);
  await put('de-CH/layout.ts', `import '../de/layout.js'; const strings = {}; registerLyraLocaleDelta('de-CH', 'de', strings, {dir: 'ltr'});`);
  return { root, entries, put };
}

test('resolves sparse catalogs in English order while retaining authored counts and empty family modules', async (t) => {
  const { root, entries } = await fixture(t);
  const inventory = await readTranslationCatalogInventory({ packageDir: root });
  const expected = entries.map(([key, value]) => [key, key === 'key0' ? 'Swiss' : value]);
  assert.deepEqual(inventory.catalogs.get('de-CH'), expected);
  assert.deepEqual(inventory.authoredCatalogs.get('de-CH'), [['key0', 'Swiss']]);
  const module = inventory.modules.find(({ locale }) => locale === 'de-CH');
  assert.equal(module.parent, 'de');
  assert.deepEqual(Object.keys(module.familyPaths), ['forms', 'layout']);
  assert.deepEqual(messageSnapshot(inventory.catalogs.get('de-CH')), messageSnapshot(expected));
});

for (const [name, file, source, error] of [
  ['unknown parent', 'de-CH/forms.ts', "import '../xx/forms.js'; const strings = {}; registerLyraLocaleDelta('de-CH', 'xx', strings);", /parent/u],
  ['self parent', 'de-CH/forms.ts', "import '../de-CH/forms.js'; const strings = {}; registerLyraLocaleDelta('de-CH', 'de-CH', strings);", /parent|cycle/u],
  ['missing matching parent import', 'de-CH/forms.ts', "const strings = {}; registerLyraLocaleDelta('de-CH', 'de', strings);", /parent.*import|import.*parent/u],
  ['unrelated parent family import', 'de-CH/forms.ts', "import '../de/layout.js'; const strings = {}; registerLyraLocaleDelta('de-CH', 'de', strings);", /parent.*import|import.*parent/u],
  ['wrong override family', 'de-CH/layout.ts', "import '../de/layout.js'; const strings = {key2: 'Wrong family'}; registerLyraLocaleDelta('de-CH', 'de', strings);", /family/u],
  ['inconsistent metadata', 'de-CH/layout.ts', "import '../de/layout.js'; const strings = {}; registerLyraLocaleDelta('de-CH', 'de', strings, {dir: 'rtl'});", /metadata/u],
  ['invented override', 'de-CH/forms.ts', "import '../de/forms.js'; const strings = {typo: 'Oops'}; registerLyraLocaleDelta('de-CH', 'de', strings);", /typo|unknown|invented/u],
  ['duplicate override', 'de-CH/forms.ts', "import '../de/forms.js'; const strings = {key0: 'A', key0: 'B'}; registerLyraLocaleDelta('de-CH', 'de', strings);", /duplicate/u],
  ['out-of-order overrides', 'de-CH/forms.ts', "import '../de/forms.js'; const strings = {key2: 'A', key0: 'B'}; registerLyraLocaleDelta('de-CH', 'de', strings);", /order/u],
  ['nonliteral parent', 'de-CH/forms.ts', "import '../de/forms.js'; const strings = {}; registerLyraLocaleDelta('de-CH', parent, strings);", /literal|parent/u],
  ['nonliteral metadata', 'de-CH/forms.ts', "import '../de/forms.js'; const strings = {}; registerLyraLocaleDelta('de-CH', 'de', strings, meta);", /metadata|literal/u],
  ['mixed full and delta slices', 'de-CH/forms.ts', "const strings = {key0: 'Swiss'}; registerLyraLocale('de-CH', strings);", /parent|mixed/u],
  ['resolved missing key', 'de/layout.ts', "const strings = {}; registerLyraLocale('de', strings);", /missing|complete/u],
]) test(`rejects ${name}`, async (t) => {
  const { root, put } = await fixture(t);
  await put(file, source);
  await assert.rejects(readTranslationCatalogInventory({ packageDir: root }), error);
});

test('detects parent cycles even when each slice imports the matching family', async (t) => {
  const { root, put } = await fixture(t);
  for (const family of ['forms', 'layout']) await put(`de/${family}.ts`, `import '../de-CH/${family}.js'; const strings = {}; registerLyraLocaleDelta('de', 'de-CH', strings);`);
  await assert.rejects(readTranslationCatalogInventory({ packageDir: root }), /cycle/u);
});

test('a changed inherited value invalidates the resolved review snapshot without rewriting an override', async (t) => {
  const { root, put } = await fixture(t);
  const before = await readTranslationCatalogInventory({ packageDir: root });
  const source = await readFile(path.join(root, 'src/translations/de/layout.ts'), 'utf8');
  await put('de/layout.ts', source.replace('Message 100', 'Changed parent'));
  const after = await readTranslationCatalogInventory({ packageDir: root });
  assert.notEqual(messageSnapshot(before.catalogs.get('de-CH')).sha256, messageSnapshot(after.catalogs.get('de-CH')).sha256);
  assert.deepEqual(after.authoredCatalogs.get('de-CH'), before.authoredCatalogs.get('de-CH'));
});

test('a plural override replaces the complete parent message without merging its categories', async (t) => {
  const { root, put } = await fixture(t);
  await put('de-CH/forms.ts', "import '../de/forms.js'; const strings = {key1: {other: '{count} regional'}}; registerLyraLocaleDelta('de-CH', 'de', strings, {dir: 'ltr'});");
  const inventory = await readTranslationCatalogInventory({ packageDir: root });
  assert.deepEqual(new Map(inventory.catalogs.get('de-CH')).get('key1'), {other: '{count} regional'});
  assert.deepEqual(new Map(inventory.catalogs.get('de')).get('key1'), {one: 'One item', other: '{count} items'});
});

test('flat pt-PT slices must match the nonpublished regional authoring map', async (t) => {
  const { root, put } = await fixture(t);
  const translations = path.join(root, 'src/translations');
  for (const tag of ['pt-BR', 'pt-PT']) {
    await mkdir(path.join(translations, tag), { recursive: true });
    await put(`${tag}.ts`, `import './${tag}/forms.js';\nimport './${tag}/layout.js';`);
    for (const family of ['forms', 'layout']) {
      const source = await readFile(path.join(translations, `de/${family}.ts`), 'utf8');
      await put(`${tag}/${family}.ts`, source.replaceAll("'de'", `'${tag}'`)
        .replace('Message 0', tag === 'pt-PT' ? 'European message' : 'Message 0'));
    }
  }
  const overrideFile = path.join(root, 'scripts/fixtures/pt-PT-overrides.ts');
  await mkdir(path.dirname(overrideFile), { recursive: true });
  await writeFile(overrideFile, "const strings = { key0: 'European message' };\n");
  const inventory = await readTranslationCatalogInventory({ packageDir: root });
  assert.equal(new Map(inventory.catalogs.get('pt-PT')).get('key0'), 'European message');
  const formsFile = path.join(translations, 'pt-PT/forms.ts');
  const forms = await readFile(formsFile, 'utf8');
  await writeFile(formsFile, forms.replace('European message', 'Unreviewed drift'));
  await assert.rejects(readTranslationCatalogInventory({ packageDir: root }), /generated message key0 differs/u);
  await writeFile(formsFile, forms);
  await writeFile(overrideFile, "const strings = { key0: 'Message 0' };\n");
  await assert.rejects(readTranslationCatalogInventory({ packageDir: root }), /duplicates its base value/u);
});

test('enforces the runtime parent-depth limit even when every earlier parent was already resolved', async (t) => {
  const { root, entries, put } = await fixture(t);
  const tag = (index) => `x-depth-${String(index).padStart(2, '0')}`;
  await put(`${tag(0)}.ts`, `const strings = ${JSON.stringify(Object.fromEntries(entries))}; registerLyraLocale('${tag(0)}', strings);`);
  for (let index = 1; index <= 32; index++) {
    await put(`${tag(index)}.ts`, `import './${tag(index - 1)}.js'; const strings = {}; registerLyraLocaleDelta('${tag(index)}', '${tag(index - 1)}', strings);`);
  }
  assert.equal((await readTranslationCatalogInventory({ packageDir: root })).catalogs.get(tag(32)).length, 101);
  await put(`${tag(33)}.ts`, `import './${tag(32)}.js'; const strings = {}; registerLyraLocaleDelta('${tag(33)}', '${tag(32)}', strings);`);
  await assert.rejects(readTranslationCatalogInventory({ packageDir: root }), /32 edges/u);
});
