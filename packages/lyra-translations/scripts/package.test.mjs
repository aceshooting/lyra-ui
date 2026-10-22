import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { buildTranslations } from './build.mjs';
import {
  relativeSpecifiersOutsideCatalog,
  retargetCatalogImports,
  retargetLocaleLoaders,
} from '../../lyra-ui/scripts/translations-companion.mjs';

test('catalog modules import the public localization entry', () => {
  assert.equal(
    retargetCatalogImports('import{registerLyraLocale}from"../../internal/localization-runtime.js";x()'),
    'import{registerLyraLocale}from"@aceshooting/lyra-ui/localization.js";x()',
  );
  assert.deepEqual(relativeSpecifiersOutsideCatalog('import"./fr/forms.js";import{a}from"../../internal/x.js"'), ['../../internal/x.js']);
  assert.deepEqual(relativeSpecifiersOutsideCatalog('import"../de/forms.js";import"../../internal/x.js"', 'de-CH/forms.js'), ['../../internal/x.js']);
});

test('locale loaders import the companion package', () => {
  assert.equal(
    retargetLocaleLoaders('{fr:()=>import("../translations/fr.js"),"de-CH":()=>import("../translations/de-CH.js")}'),
    '{fr:()=>import("@aceshooting/lyra-translations/fr.js"),"de-CH":()=>import("@aceshooting/lyra-translations/de-CH.js")}',
  );
});

test('catalog boundary accepts sibling imports and rejects traversal in module specifiers', () => {
  assert.deepEqual(relativeSpecifiersOutsideCatalog('import "../de/forms.js"; const text = "../outside.js";', 'de-CH/forms.js'), []);
  for (const specifier of ['../../outside.js', './../../../outside.js', './x/../../../outside.js']) {
    assert.deepEqual(relativeSpecifiersOutsideCatalog(`import "${specifier}";`, 'de-CH/forms.js'), [specifier]);
  }
  assert.deepEqual(relativeSpecifiersOutsideCatalog('export { x } from "../../outside.js";', 'de-CH/forms.js'), ['../../outside.js']);
  assert.deepEqual(relativeSpecifiersOutsideCatalog('import("../../outside.js")', 'de-CH/forms.js'), ['../../outside.js']);
});

function assemblyFixture(context, entries = {}) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-translations-build-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'catalogs');
  const target = join(root, 'output');
  mkdirSync(source);
  for (const [file, content] of Object.entries(entries)) {
    const path = join(source, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return { source, target };
}

test('assembles nested catalogs with public imports and replaces stale output', context => {
  const nested = `import '../de/forms.js';\nimport { registerLyraLocale } from '../../internal/localization-runtime.js';\n`;
  const { source, target } = assemblyFixture(context, {
    'de/forms.js': 'export const forms = {};\n',
    'de-CH/forms.js': nested,
    'fr.js': 'export const locale = {};\n',
    'pseudo/ar-XB.js': 'throw new Error();\n',
    'fr.json': '{}\n',
    'de/forms.js.map': '{}\n',
  });
  mkdirSync(target);
  writeFileSync(join(target, 'obsolete.js'), 'obsolete');

  assert.equal(buildTranslations({ source, target }), 3);
  assert.equal(readFileSync(join(target, 'de/forms.js'), 'utf8'), 'export const forms = {};\n');
  assert.equal(readFileSync(join(target, 'de-CH/forms.js'), 'utf8'),
    `import '../de/forms.js';\nimport { registerLyraLocale } from '@aceshooting/lyra-ui/localization.js';\n`);
  assert.equal(readFileSync(join(target, 'fr.js'), 'utf8'), 'export const locale = {};\n');
  assert.equal(readFileSync(join(target, 'side-effect-only.d.ts'), 'utf8'), 'export {};\n');
  for (const file of ['pseudo', 'fr.json', 'de/forms.js.map', 'obsolete.js']) {
    assert.equal(existsSync(join(target, file)), false, file);
  }
});

test('the CLI assembles catalogs using its default package paths', context => {
  const { source: root } = assemblyFixture(context);
  const packageDir = join(root, 'packages', 'lyra-translations');
  const builder = join(packageDir, 'scripts', 'build.mjs');
  const helper = join(root, 'packages', 'lyra-ui', 'scripts', 'translations-companion.mjs');
  const catalogs = join(root, 'packages', 'lyra-ui', 'dist', 'translations');
  for (const directory of [dirname(builder), dirname(helper), catalogs]) mkdirSync(directory, { recursive: true });
  copyFileSync(new URL('./build.mjs', import.meta.url), builder);
  copyFileSync(new URL('../../lyra-ui/scripts/translations-companion.mjs', import.meta.url), helper);
  writeFileSync(join(catalogs, 'fr.js'), 'export {};\n');

  assert.equal(execFileSync(process.execPath, [builder], { encoding: 'utf8' }), 'Locale catalogs assembled: 1 modules.\n');
  assert.equal(readFileSync(join(packageDir, 'dist', 'fr.js'), 'utf8'), 'export {};\n');
  assert.equal(readFileSync(join(packageDir, 'dist', 'side-effect-only.d.ts'), 'utf8'), 'export {};\n');
});

test('refuses a missing catalog source', context => {
  const { source, target } = assemblyFixture(context);
  rmSync(source, { recursive: true });
  assert.throws(() => buildTranslations({ source, target }), /dist\/translations is missing/u);
  assert.equal(existsSync(target), false);
});

test('refuses a source containing only pseudo-locales and non-JavaScript files', context => {
  const { source, target } = assemblyFixture(context, {
    'pseudo/ar-XB.js': 'export {};\n',
    'fr.json': '{}\n',
  });
  assert.throws(() => buildTranslations({ source, target }), /emitted no locale catalogs/u);
  assert.equal(existsSync(join(target, 'side-effect-only.d.ts')), false);
});

for (const file of ['fr.js', 'de-CH/forms.js']) {
  test(`refuses an escaping import in ${file}`, context => {
    const { source, target } = assemblyFixture(context, { [file]: `export { value } from '../../outside.js';\n` });
    assert.throws(() => buildTranslations({ source, target }), /imports outside the catalog tree: \.\.\/\.\.\/outside\.js/u);
    assert.equal(existsSync(join(target, file)), false);
    assert.equal(existsSync(join(target, 'side-effect-only.d.ts')), false);
  });
}
