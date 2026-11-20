import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stageScripts } from '../../../scripts/lib/coverage/staged-script.mjs';
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

const ownPackage = dirname(dirname(fileURLToPath(import.meta.url)));

/** The assembler and its lyra-ui helper staged into `packages/*` of a scratch repository. */
function stagedAssembler(root) {
  const packageDir = join(root, 'packages', 'lyra-translations');
  const [builder] = stageScripts({ from: ownPackage, to: packageDir, files: ['scripts/build.mjs'] });
  stageScripts({
    from: join(ownPackage, '..', 'lyra-ui'), to: join(root, 'packages', 'lyra-ui'),
    files: ['scripts/translations-companion.mjs', 'src/internal/locale-english-defaults.generated.ts'],
  });
  return { packageDir, builder, catalogs: join(root, 'packages', 'lyra-ui', 'dist', 'translations') };
}

test('the CLI assembles catalogs using its default package paths', context => {
  const { source: root } = assemblyFixture(context);
  const { packageDir, builder, catalogs } = stagedAssembler(root);
  mkdirSync(catalogs, { recursive: true });
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

test('the CLI exits non-zero and names the build to run when lyra-ui has not been built', context => {
  const { source: root } = assemblyFixture(context);
  const { packageDir, builder } = stagedAssembler(root);
  const result = spawnSync(process.execPath, [builder], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /packages\/lyra-ui\/dist\/translations is missing; run `pnpm --filter @aceshooting\/lyra-ui build` first/u);
  assert.equal(existsSync(join(packageDir, 'dist')), false);
});

test('only a top-level pseudo directory stays in lyra-ui; a nested one is an ordinary slice', context => {
  const { source, target } = assemblyFixture(context, {
    'pseudo/ar-XB.js': 'export {};\n',
    'fr/pseudo/forms.js': 'export const slice = 1;\n',
    'fr.js': 'export {};\n',
  });
  assert.equal(buildTranslations({ source, target }), 2);
  assert.equal(existsSync(join(target, 'pseudo')), false);
  assert.equal(readFileSync(join(target, 'fr/pseudo/forms.js'), 'utf8'), 'export const slice = 1;\n');
});

test('reports the first offending catalog in name order and writes nothing after it', context => {
  const { source, target } = assemblyFixture(context, {
    'z.js': `export { value } from '../../z-outside.js';\n`,
    'm.js': 'export {};\n',
    'a.js': `export { value } from '../../a-outside.js';\n`,
  });
  assert.throws(() => buildTranslations({ source, target }), /a\.js imports outside the catalog tree: \.\.\/\.\.\/a-outside\.js/u);
  for (const file of ['a.js', 'm.js', 'z.js', 'side-effect-only.d.ts']) assert.equal(existsSync(join(target, file)), false, file);
});

test('packs repeated catalog keys while preserving registration arguments and their order', async context => {
  const strings = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [
    'documentEditorParagraph' + i, ['Open', 'Écrire « {name} »', 'Line\n"two"', ''][i % 4],
  ]));
  const entries = Object.entries(strings).map(([key, value]) => key + ':' + JSON.stringify(value));
  const { source, target } = assemblyFixture(context);
  const runtime = 'import{registerLyraLocale}from"../../internal/localization-runtime.js";';
  async function assemble(properties) {
    const catalog = runtime + 'const strings={' + properties.join(',') + '};registerLyraLocale("fr",strings,{dir:"ltr"});';
    writeFileSync(join(source, 'fr.js'), catalog);
    buildTranslations({ source, target });
    const output = readFileSync(join(target, 'fr.js'), 'utf8');
    const stub = output.replace('import{registerLyraLocale}from"@aceshooting/lyra-ui/localization.js";',
      'export let call;const registerLyraLocale=(...args)=>{call=args};');
    const { call } = await import('data:text/javascript;base64,' + Buffer.from(stub).toString('base64'));
    return { output, call, original: retargetCatalogImports(catalog) };
  }
  for (const lastValue of ['"Open"', '"left|right"', "'single quoted'", '"\\x41"']) {
    const { call, output, original } = await assemble([...entries, 'documentEditorParagraphLast:' + lastValue]);
    assert.ok(Buffer.byteLength(output) < Buffer.byteLength(original));
    assert.equal(call[0], 'fr');
    assert.deepEqual(Object.entries(call[1]).slice(0, -1), Object.entries(strings));
    assert.equal(call[1].documentEditorParagraphLast,
      { '"Open"': 'Open', '"left|right"': 'left|right', "'single quoted'": 'single quoted', '"\\x41"': 'A' }[lastValue]);
    assert.deepEqual(call[2], { dir: 'ltr' });
  }
  const mixed = Array.from({ length: 250 }, (_, i) => (i % 2 ? 'first' : 'second') + i + ':"Open"');
  const { call, output, original } = await assemble(mixed);
  assert.ok(Buffer.byteLength(output) < Buffer.byteLength(original));
  assert.deepEqual(Object.entries(call[1]), mixed.map(property => [property.split(':')[0], 'Open']));
  const plural = { one: '{count} item', many: '{count} items', other: '{count} items' };
  const withPlurals = entries.map((entry, i) => i % 7 === 3
    ? entry.split(':')[0] + ':{' + Object.entries(plural).map(([category, text]) => category + ':' + JSON.stringify(text)).join(',') + '}'
    : entry);
  const pluralBuild = await assemble([...withPlurals, "documentEditorSingle:{one:'a',other:'b'}"]);
  assert.ok(Buffer.byteLength(pluralBuild.output) < Buffer.byteLength(pluralBuild.original));
  assert.deepEqual(Object.entries(pluralBuild.call[1]), [
    ...Object.entries(strings).map(([key, value], i) => [key, i % 7 === 3 ? plural : value]),
    ['documentEditorSingle', { one: 'a', other: 'b' }],
  ]);
  for (const properties of [[], ['short:"small"'], ['plural:{one:"a",other:"b"}']]) {
    const { output, original } = await assemble(properties);
    assert.equal(output, original);
  }
});

test('omits only the listed English-default messages and fails when the list and catalogs disagree', context => {
  const runtime = 'import{registerLyraLocale}from"../../internal/localization-runtime.js";';
  const catalog = runtime + `const strings={keep:"Garder",same:"Same",tick:\`T\`,'quoted':"Q",plural:{one:"un",other:"x{y}"},tail:'T'};registerLyraLocale("fr",strings);`;
  const { source, target } = assemblyFixture(context, { 'fr/forms.js': catalog, 'fr/data.js': 'export {};\n', 'de/forms.js': catalog });
  const englishDefaults = join(source, '..', 'english.ts');
  writeFileSync(englishDefaults, "export const LOCALE_ENGLISH_DEFAULT_KEYS = {\n  'fr': 'same tick quoted plural tail',\n};\n");
  buildTranslations({ source, target, englishDefaults });
  const output = readFileSync(join(target, 'fr/forms.js'), 'utf8');
  assert.match(output, /const strings=\{keep:"Garder"\};registerLyraLocale\("fr",strings\);$/u);
  assert.match(readFileSync(join(target, 'de/forms.js'), 'utf8'), /same:"Same"/u);
  writeFileSync(englishDefaults, "export const LOCALE_ENGLISH_DEFAULT_KEYS = {\n  'fr': 'same absent',\n};\n");
  assert.throws(() => buildTranslations({ source, target, englishDefaults }), /fr: the published catalogs do not carry exactly/u);
  for (const broken of ['const strings={a:1};', 'const strings={a:`${x}`};', 'const strings={a:"open', 'const strings={a:{one:"x"', 'const strings={a b};']) {
    writeFileSync(join(source, 'fr/forms.js'), broken);
    writeFileSync(englishDefaults, "export const LOCALE_ENGLISH_DEFAULT_KEYS = {\n  'fr': 'a',\n};\n");
    assert.throws(() => buildTranslations({ source, target, englishDefaults }), /catalog module/u, broken);
  }
});

// Resolves every built-in message for every shipped locale (and a regional variant of each) through
// lyra-ui's real runtime, once with lyra-ui's complete compiled catalogs and once with the assembled
// ones, and prints the results as JSON.
const RESOLVE_ALL = `
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [catalogs, dist] = process.argv.slice(1);
const runtime = await import(pathToFileURL(join(dist, 'internal', 'localization-runtime.js')));
const { LYRA_DEFAULT_STRINGS: defaults } = await import(pathToFileURL(join(dist, 'localization.js')));
const tags = readdirSync(catalogs).filter(name => name.endsWith('.js')).map(name => name.slice(0, -3));
for (const tag of tags) await import(pathToFileURL(join(catalogs, tag + '.js')));
const requests = [...new Set(tags.flatMap(tag => [tag, tag + '-ZZ', tag.split('-')[0]]))].sort();
const result = {};
for (const locale of requests) {
  const host = { parentElement: null, ownerDocument: null, getAttribute: name => (name === 'lang' ? locale : null), getRootNode() { return this; } };
  result[locale] = Object.keys(defaults).map(key => [undefined, { count: 1 }, { count: 5 }]
    .map(values => runtime.resolveLyraString(host, key, undefined, undefined, values, defaults)).join('\\u0000'));
}
process.stdout.write(JSON.stringify(result));
`;

test('assembled catalogs resolve every message exactly as the complete catalogs do', context => {
  const lyraDist = join(ownPackage, '..', 'lyra-ui', 'dist');
  assert.ok(existsSync(join(lyraDist, 'translations')), 'build lyra-ui first: pnpm --filter @aceshooting/lyra-ui build');
  // Inside node_modules so the assembled catalogs resolve the workspace lyra-ui, outside the
  // package's own source scan.
  const target = mkdtempSync(join(ownPackage, 'node_modules', '.equivalence-'));
  context.after(() => rmSync(target, { recursive: true, force: true }));
  buildTranslations({ target });
  const resolveAll = catalogs => JSON.parse(execFileSync(process.execPath,
    ['--input-type=module', '-e', RESOLVE_ALL, catalogs, lyraDist], { encoding: 'utf8', maxBuffer: 1 << 30 }));
  const complete = resolveAll(join(lyraDist, 'translations'));
  const assembled = resolveAll(target);
  assert.deepEqual(Object.keys(assembled), Object.keys(complete));
  const differing = Object.keys(complete).filter(locale => JSON.stringify(complete[locale]) !== JSON.stringify(assembled[locale]));
  assert.deepEqual(differing, []);
  assert.ok(Object.keys(complete).length > 80);
});
