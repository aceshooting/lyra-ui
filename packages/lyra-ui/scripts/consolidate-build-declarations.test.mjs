import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { consolidateBuildDeclarations } from './consolidate-build-declarations.mjs';
import { deriveLocaleDeclarationExports, EMPTY_DECLARATION } from './declaration-entrypoints.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-declarations-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function write(path, value) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); }
  write('src/translations/fr.ts', "import './fr/forms.js';\n");
  write('src/translations/fr/forms.ts', 'register();\n');
  write('src/translations/pseudo/en-XA.ts', 'export const strings = {};\n');
  write('dist/translations/fr.d.ts', "import './fr/forms.js';\n");
  write('dist/translations/fr/forms.d.ts', 'export {};\n');
  write('dist/translations/pseudo/en-XA.d.ts', 'export declare const strings: {};\n');
  write('dist/translations/fr.js', "import './fr/forms.js';\n");
  write('dist/translations/fr/forms.js', 'register();\n');
  write('dist/components/lr-alpha.d.ts', "export * from './forms/alpha/alpha.js';\n");
  write('dist/components/lr-alpha.js', "export * from './forms/alpha/alpha.js';\n");
  write('dist/components/forms/alpha/alpha.d.ts', 'export declare class Alpha {}\n');
  write('dist/all.d.ts', "// 🧭 Unicode before import\nimport './components/lr-alpha.js';\nimport './translations/fr.js';\nexport type A = import('./components/lr-alpha.js').Alpha;\nexport type Untouched = './components/lr-alpha.js';\n");
  write('scripts/fixtures/component-inventory.json', JSON.stringify({ components: [{ tag: 'lr-alpha', registrationModule: 'src/components/forms/alpha/alpha.ts' }] }));
  const exports = { './translations/*': './dist/translations/*', ...deriveLocaleDeclarationExports(root), './components/lr-alpha.js': { types: './dist/components/forms/alpha/alpha.d.ts', default: './dist/components/lr-alpha.js' } };
  write('package.json', JSON.stringify({ exports }));
  return { root, write, exports };
}

test('exact locale routes preserve only existing .js/.d.ts modules and exclude public pseudo exports', (t) => {
  const { root } = fixture(t);
  assert.deepEqual(Object.keys(deriveLocaleDeclarationExports(root)), ['./translations/fr.js', './translations/fr.d.ts', './translations/fr/forms.js', './translations/fr/forms.d.ts']);
  assert.equal(deriveLocaleDeclarationExports(root)['./translations/fr.js'].types, EMPTY_DECLARATION);
});

test('consolidates declarations, rewrites relative module references, preserves runtime and pseudo types, and is idempotent', (t) => {
  const { root } = fixture(t);
  assert.deepEqual(consolidateBuildDeclarations(root), { removed: 3, rewritten: 1 });
  const all = readFileSync(join(root, 'dist/all.d.ts'), 'utf8');
  assert.match(all, /import "\.\/components\/forms\/alpha\/alpha.js"/);
  assert.match(all, /import\("\.\/components\/forms\/alpha\/alpha.js"\)/);
  assert.match(all, /import "\.\/internal\/side-effect-only.js"/);
  assert.match(all, /Untouched = '\.\/components\/lr-alpha.js'/);
  assert.equal(readFileSync(join(root, 'dist/translations/fr.js'), 'utf8'), "import './fr/forms.js';\n");
  assert.equal(readFileSync(join(root, 'dist/components/lr-alpha.js'), 'utf8'), "export * from './forms/alpha/alpha.js';\n");
  assert.equal(readFileSync(join(root, 'dist/translations/pseudo/en-XA.d.ts'), 'utf8'), 'export declare const strings: {};\n');
  assert.equal(existsSync(join(root, 'dist/translations/fr.d.ts')), false);
  assert.deepEqual(consolidateBuildDeclarations(root), { removed: 0, rewritten: 0 });
});

for (const [name, path, source, error] of [
  ['named catalog exports', 'dist/translations/fr/forms.d.ts', 'export declare const strings: {};', /public declaration/],
  ['catalog global augmentation', 'dist/translations/fr/forms.d.ts', 'declare global { interface Window { foo: string } } export {};', /public declaration/],
  ['external catalog effects', 'dist/translations/fr.d.ts', "import '../localization.js';", /external side effect/],
  ['nontransparent alias', 'dist/components/lr-alpha.d.ts', "export { Alpha } from './forms/alpha/alpha.js';", /transparent re-export/],
]) test(`rejects ${name} before any mutation`, (t) => {
  const { root, write } = fixture(t);
  write(path, source);
  assert.throws(() => consolidateBuildDeclarations(root), error);
  assert.equal(existsSync(join(root, 'dist/translations/fr.d.ts')), true);
  assert.equal(existsSync(join(root, EMPTY_DECLARATION)), false);
});

test('stale exports fail before removing declarations', (t) => {
  const { root, write, exports } = fixture(t);
  delete exports['./translations/fr/forms.js'];
  write('package.json', JSON.stringify({ exports }));
  assert.throws(() => consolidateBuildDeclarations(root), /stale locale export/);
  assert.equal(existsSync(join(root, 'dist/translations/fr.d.ts')), true);
});

for (const [name, source] of [
  ['module augmentation', "declare module './components/lr-alpha.js' { interface Alpha { foo: string } } export {};"],
  ['reference path', '/// <reference path="./components/lr-alpha.d.ts" />\nexport {};'],
]) test(`rejects unsupported ${name} before mutation`, (t) => {
  const { root, write } = fixture(t);
  write('dist/augment.d.ts', source);
  assert.throws(() => consolidateBuildDeclarations(root), /unsupported/);
  assert.equal(existsSync(join(root, 'dist/components/lr-alpha.d.ts')), true);
});

test('Bundler and NodeNext preserve real .js/.d.ts imports, aliases and pseudo values while rejecting invented routes', (t) => {
  const { root, write, exports } = fixture(t);
  exports['./all'] = { types: './dist/all.d.ts', default: './dist/all.js' };
  exports['./translations/pseudo/en-XA.js'] = './dist/translations/pseudo/en-XA.js';
  write('package.json', JSON.stringify({ name: 'declaration-fixture', type: 'module', exports }));
  write('dist/all.d.ts', "export * from './translations/fr.js';\nexport { Alpha } from './components/lr-alpha.js';\nexport type A = import('./components/lr-alpha.js').Alpha;\n");
  write('consumer.ts', `
import * as aggregate from 'declaration-fixture/translations/fr.js';
import * as family from 'declaration-fixture/translations/fr/forms.js';
import type * as aggregateDeclaration from 'declaration-fixture/translations/fr.d.ts';
import type * as familyDeclaration from 'declaration-fixture/translations/fr/forms.d.ts';
import { Alpha } from 'declaration-fixture/components/lr-alpha.js';
import { Alpha as ThroughAll } from 'declaration-fixture/all';
import { strings } from 'declaration-fixture/translations/pseudo/en-XA.js';
const empty: [keyof typeof aggregate, keyof typeof family, keyof typeof aggregateDeclaration, keyof typeof familyDeclaration] extends [never, never, never, never] ? true : false = true;
const instance: ThroughAll = new Alpha();
void [empty, instance, strings];
// @ts-expect-error nonexistent locale must remain unresolved
import * as missing from 'declaration-fixture/translations/nonexistent.js';
// @ts-expect-error nonexistent family must remain unresolved
import * as missingFamily from 'declaration-fixture/translations/fr/nonexistent.js';
// @ts-expect-error extensionless locale was not previously resolvable
import * as extensionless from 'declaration-fixture/translations/fr';
// @ts-expect-error dist is not a public package route
import * as privateDist from 'declaration-fixture/dist/internal/side-effect-only.js';
// @ts-expect-error real locale modules do not export strings
aggregate.strings;
`);
  const require = createRequire(import.meta.url);
  const typescriptPackagePath = require.resolve('typescript/package.json');
  const compiler = resolve(dirname(typescriptPackagePath), require('typescript/package.json').bin.tsc);
  for (const stage of ['before', 'after']) {
    if (stage === 'before') {
      const baselineExports = { ...exports };
      for (const route of Object.keys(deriveLocaleDeclarationExports(root))) delete baselineExports[route];
      baselineExports['./components/lr-alpha.js'] = './dist/components/lr-alpha.js';
      write('package.json', JSON.stringify({ name: 'declaration-fixture', type: 'module', exports: baselineExports }));
    } else {
      write('package.json', JSON.stringify({ name: 'declaration-fixture', type: 'module', exports }));
      consolidateBuildDeclarations(root);
    }
    for (const resolution of ['Bundler', 'NodeNext']) {
      const result = spawnSync(process.execPath, [compiler, '--noEmit', '--strict', '--skipLibCheck', 'false', '--noUncheckedSideEffectImports', '--moduleResolution', resolution, '--module', resolution === 'NodeNext' ? 'NodeNext' : 'ESNext', '--target', 'ES2022', 'consumer.ts'], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 0, `${stage} ${resolution}: ${result.stdout}${result.stderr}`);
    }
  }
});
