import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stageScripts } from '../../lyra-docs/scripts/lib/staged-script.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const uiDir = join(packageDir, '..', 'lyra-ui');
const realManifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const realReadme = readFileSync(join(packageDir, 'README.md'), 'utf8');
const TRANSLATIONS = '@aceshooting/lyra-translations';

function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
}

/** A well-formed catalog tree: one locale importing the public entry, plus the marker declaration. */
const validDist = () => ({
  'fr.js': `import { registerLyraLocale } from '@aceshooting/lyra-ui/localization.js';\nregisterLyraLocale('fr', {});\n`,
  'fr/forms.js': `import '../fr.js';\n`,
  'side-effect-only.d.ts': 'export {};\n',
});

/**
 * Run the contract script against a repository tree built around the committed manifest and README.
 * `edit` mutates clones of the manifests and the README text; `dist` is the assembled tree
 * (`null` means the package has not been assembled).
 */
function check(context, { edit = () => {}, dist = null, locales = { fr: { import: `${TRANSLATIONS}/fr.js` } } } = {}) {
  const repository = mkdtempSync(join(tmpdir(), 'lyra-translations-contract-'));
  context.after(() => rmSync(repository, { recursive: true, force: true }));
  const manifest = structuredClone(realManifest);
  const state = {
    manifest,
    ui: {
      version: manifest.version,
      peerDependencies: { [TRANSLATIONS]: 'workspace:^' },
      peerDependenciesMeta: { [TRANSLATIONS]: { optional: true } },
    },
    root: { packageManager: manifest.packageManager },
    readme: realReadme,
    dist: dist && structuredClone(dist),
    locales,
  };
  edit(state);
  const own = join(repository, 'packages/lyra-translations');
  const [script] = stageScripts({ from: packageDir, to: own, files: ['scripts/check-package.mjs'] });
  stageScripts({ from: uiDir, to: join(repository, 'packages/lyra-ui'), files: ['scripts/translations-companion.mjs'] });
  write(join(own, 'package.json'), state.manifest);
  write(join(own, 'README.md'), state.readme);
  write(join(repository, 'packages/lyra-ui/package.json'), state.ui);
  write(join(repository, 'package.json'), state.root);
  if (state.locales) write(join(repository, 'packages/lyra-ui/locales.json'), state.locales);
  for (const [file, content] of Object.entries(state.dist ?? {})) write(join(own, 'dist', file), content);
  return spawnSync(process.execPath, [script], { encoding: 'utf8' });
}

test('the committed manifest and README satisfy the contract before assembly', context => {
  const result = check(context);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'lyra-translations package contract passed.\n');
});

test('an assembled catalog tree that follows the contract passes', context => {
  const result = check(context, { dist: validDist() });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'lyra-translations package contract passed.\n');
});

// Each edit breaks exactly one rule; the failure must name the offending value or rule.
const manifestViolations = [
  ['a different package name', ({ manifest }) => { manifest.name = 'not-translations'; }, /not-translations/u],
  ['a CommonJS package type', ({ manifest }) => { manifest.type = 'commonjs'; }, /commonjs/u],
  ['a non-MIT license', ({ manifest }) => { manifest.license = 'GPL-3.0'; }, /GPL-3\.0/u],
  ['a prepack that skips the lyra-ui build', ({ manifest }) => { manifest.scripts.prepack = 'pnpm assemble'; }, /pnpm assemble/u],
  ['a build script that would assemble before lyra-ui is built', ({ manifest }) => { manifest.scripts.build = 'node scripts/build.mjs'; }, /stays out of recursive builds/u],
  ['a private package', ({ manifest }) => { manifest.private = true; }, /must be publishable/u],
  ['an older Node floor', ({ manifest }) => { manifest.engines.node = '>=18'; }, />=18/u],
  ['a package manager that differs from the workspace', ({ manifest }) => { manifest.packageManager = 'pnpm@1.0.0'; }, /pnpm@1\.0\.0/u],
  ['restricted publishing', ({ manifest }) => { manifest.publishConfig = { access: 'restricted' }; }, /restricted/u],
  ['another repository directory', ({ manifest }) => { manifest.repository.directory = 'packages/other'; }, /packages\/other/u],
  ['a side-effect declaration that hides catalogs from bundlers', ({ manifest }) => { manifest.sideEffects = false; }, /\.\/dist\/\*\*\/\*\.js/u],
  ['an extra published file', ({ manifest }) => { manifest.files.push('stray.json'); }, /stray\.json/u],
  ['an extra export', ({ manifest }) => { manifest.exports['./stray.json'] = './stray.json'; }, /stray\.json/u],
  ['a peer range other than the workspace caret', ({ manifest }) => { manifest.peerDependencies['@aceshooting/lyra-ui'] = '1.0.0'; }, /1\.0\.0/u],
  ['a bundled runtime dependency', ({ manifest }) => { manifest.dependencies = { 'left-pad': '1.0.0' }; }, /Catalogs register through the application lyra-ui/u],
  ['a version that no longer follows lyra-ui', ({ manifest }) => { manifest.version = '0.0.1'; }, /changeset fixed group/u],
  ['a lyra-ui peer range other than the workspace caret', ({ ui }) => { ui.peerDependencies[TRANSLATIONS] = '^1.0.0'; }, /\^1\.0\.0/u],
  ['a required lyra-ui peer', ({ ui }) => { ui.peerDependenciesMeta[TRANSLATIONS].optional = false; }, /actual: false,\s+expected: true,|\+ false\s+- true|false !== true/u],
  ['an undeclared lyra-ui peer', ({ ui }) => { ui.peerDependenciesMeta = {}; }, /actual: undefined,\s+expected: true,|\+ undefined\s+- true|undefined !== true/u],
  ['lyra-ui depending on its companion at build time', ({ ui }) => { ui.devDependencies = { [TRANSLATIONS]: 'workspace:*' }; }, /must not depend on its companion at build time/u],
  ['a workspace package manager that differs', ({ root }) => { root.packageManager = 'pnpm@2.0.0'; }, /pnpm@2\.0\.0/u],
  ['a README without the import path', state => { state.readme = '# Translations\n'; }, /README documents the import path/u],
];

const distViolations = [
  ['a published source map', { 'fr.js.map': '{}\n' }, /No source maps are published/u],
  ['a missing marker declaration', { 'side-effect-only.d.ts': null }, /side-effect-only\.d\.ts/u],
  ['pseudo-locales that belong to lyra-ui', { 'pseudo/ar-XB.js': 'export {};\n' }, /Pseudo-locales stay in lyra-ui/u],
  ['a catalog that escapes the package', { 'fr.js': `import '../../internal/x.js';\n` }, /fr\.js must not import outside the package/u],
  ['a catalog that imports the private runtime', { 'fr.js': `const path = 'internal/localization-runtime';\n` }, /fr\.js must use the public localization entry/u],
];

for (const [name, edit, message] of manifestViolations) {
  test(`refuses ${name}`, context => {
    const result = check(context, { edit });
    assert.notEqual(result.status, 0, 'the contract script must fail');
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
  });
}

for (const [name, changes, message] of distViolations) {
  test(`refuses an assembled tree with ${name}`, context => {
    const dist = { ...validDist(), ...changes };
    for (const [file, content] of Object.entries(dist)) if (content === null) delete dist[file];
    const result = check(context, { dist });
    assert.notEqual(result.status, 0, 'the contract script must fail');
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
  });
}

test('refuses a locale list that names a catalog the build did not emit', context => {
  const result = check(context, {
    dist: validDist(),
    locales: { fr: { import: `${TRANSLATIONS}/fr.js` }, de: { import: `${TRANSLATIONS}/de.js` } },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /locales\.json names de\.js, which the build did not emit/u);
});
