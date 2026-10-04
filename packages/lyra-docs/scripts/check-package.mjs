import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findDoubleQuotedStringLiterals,
  findNulByteLines,
  findBareGlobalIsNaNCalls,
} from '../../lyra-ui/scripts/check-source-policy.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = path.resolve(packageRoot, '../..');
const read = (file) => readFileSync(path.join(repoRoot, file), 'utf8');
const manifest = JSON.parse(read('packages/lyra-docs/package.json'));
assert.equal(manifest.name, '@aceshooting/lyra-docs');
assert.match(manifest.version, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u);
assert.equal(manifest.private, undefined, 'The Docs package must be publishable');
assert.equal(manifest.type, 'module');
assert.equal(manifest.engines.node, '>=22');
assert.equal(manifest.packageManager, JSON.parse(read('package.json')).packageManager);
assert.deepEqual(manifest.sideEffects, [
  './dist/docx/editor.js', './src/docx/editor.ts', './dist/docx/editor.css',
]);
assert.deepEqual(manifest.publishConfig, { access: 'public' });
assert.equal(manifest.repository.directory, 'packages/lyra-docs');
assert.equal(manifest.scripts.prepack, 'pnpm --filter @aceshooting/lyra-ui build && pnpm build');
assert.deepEqual(manifest.exports, {
  '.': { types: './dist/index.d.ts', default: './dist/index.js' },
  './docx': { types: './dist/docx/index.d.ts', default: './dist/docx/index.js' },
  './docx/editor': { types: './dist/docx/editor.d.ts', default: './dist/docx/editor.js' },
  './docx/editor.class': { types: './dist/docx/docx-editor.class.d.ts', default: './dist/docx/docx-editor.class.js' },
  './docx/editor.css': './dist/docx/editor.css',
  './package.json': './package.json',
});
assert.deepEqual(manifest.files, ['dist', 'CHANGELOG.md', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_LICENSES']);
const changelog = read('packages/lyra-docs/CHANGELOG.md');
assert.match(changelog, /^# @aceshooting\/lyra-docs\s/mu);
assert(changelog.split(/\r?\n/u).includes(`## ${manifest.version}`), 'Changelog lacks current version');
assert.deepEqual(manifest.dependencies, {
  '@aceshooting/lyra-ui': 'workspace:*', fflate: '^0.8.3', lit: '^3.3.3', saxes: '^6.0.0',
});
assert.equal(Object.keys(manifest.optionalDependencies ?? {}).length, 0);
assert.deepEqual(manifest.peerDependencies, { '@docx-editor.dev/core': '2.25.0' });
assert.deepEqual(manifest.peerDependenciesMeta, { '@docx-editor.dev/core': { optional: true } });
assert.equal(manifest.devDependencies['@docx-editor.dev/core'], manifest.peerDependencies['@docx-editor.dev/core']);
assert.deepEqual(Object.keys(manifest.devDependencies).sort(), [
  '@docx-editor.dev/core', '@types/node', 'axe-core', 'istanbul-lib-coverage', 'istanbul-lib-report',
  'istanbul-reports', 'playwright', 'typescript', 'v8-to-istanbul', 'vite',
]);
assert(!JSON.parse(read('.changeset/config.json')).ignore.includes(manifest.name));
const forbidden = /@aceshooting\/lyra-docs|@docx-editor\.dev\/|(?:\.\.\/)+lyra-docs\//u;
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const coreManifest = JSON.parse(read('packages/lyra-ui/package.json'));
for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
  for (const name of Object.keys(coreManifest[field] ?? {})) assert(!forbidden.test(name));
}
for (const file of files(path.join(repoRoot, 'packages/lyra-ui/src'))) {
  assert(!forbidden.test(readFileSync(file, 'utf8')), `Core editor dependency: ${file}`);
}
// The companion shares source policies while retaining an independent component inventory.
for (const file of files(path.join(packageRoot, 'src'))) {
  const source = readFileSync(file, 'utf8');
  assert.deepEqual(findDoubleQuotedStringLiterals(source), [], `String literal policy: ${file}`);
  assert.deepEqual(findNulByteLines(source), [], `NUL byte: ${file}`);
  assert.deepEqual(findBareGlobalIsNaNCalls(source, file), [], `Finite number policy: ${file}`);
  assert(!/(?:\.\.\/)+lyra-ui\//u.test(source), `Private core import: ${file}`);
  assert(!/@docx-editor\.dev\/(?!core(?:['"/]))/u.test(source), `Unqualified engine package: ${file}`);
  assert(!/@docx-editor\.dev\/core\/src\//u.test(source), `Private engine import: ${file}`);
  for (const match of source.matchAll(/import\s+(?!type\b)[^;\n]*from\s+['"](@docx-editor\.dev\/[^'"]+)['"]/gu)) {
    assert.fail(`Eager document engine import: ${file}: ${match[1]}`);
  }
}
assert.match(read('packages/lyra-docs/src/docx/index.ts'), /export \{ createDocxSession \} from '\.\/create-session\.js';/u);
assert.match(read('packages/lyra-docs/src/index.ts'), /export \{\};\s*$/u);
const editorClassSource = read('packages/lyra-docs/src/docx/docx-editor.class.ts');
const editorEntrySource = read('packages/lyra-docs/src/docx/editor.ts');
const controlTags = [...editorClassSource.matchAll(/\bunsafeStatic\(tag\('([a-z][a-z0-9-]*)'\)\)/gu)]
  .map((match) => match[1]);
const registrationTags = [...editorEntrySource.matchAll(/^import '@aceshooting\/lyra-ui\/components\/lr-([a-z][a-z0-9-]*)\.js';$/gmu)]
  .map((match) => match[1]);
assert(controlTags.length > 0, 'Editor class has no Lyra control tag inventory');
assert.equal(new Set(controlTags).size, controlTags.length, 'Duplicate editor control tag');
assert.equal(new Set(registrationTags).size, registrationTags.length, 'Duplicate editor control registration');
assert.deepEqual(registrationTags.sort(), controlTags.sort(),
  'Editor entry must register exactly its rendered Lyra controls through granular tag imports');
// Only documented subpaths are public; implementations remain behind the export map.
const dist = path.join(packageRoot, 'dist');
if (existsSync(dist)) {
  for (const file of files(dist)) {
    assert(/\.(?:js|d\.ts|css)$/u.test(file), `Unexpected build artifact: ${file}`);
    assert(!/\.test\.|-fixtures\./u.test(file), `Test build artifact: ${file}`);
    const source = readFileSync(file, 'utf8');
    assert(!/sourceMappingURL=/u.test(source), `Source map reference: ${file}`);
    if (/(?:index|types|create-session|docx-editor(?:\.class)?)\.d\.ts$/u.test(file)) {
      assert(!/@docx-editor\.dev\//u.test(source), `Public engine type leaked: ${file}`);
    }
  }
  for (const route of Object.values(manifest.exports)) {
    const targets = typeof route === 'string' ? [route] : Object.values(route);
    for (const target of targets) {
      assert(existsSync(path.join(packageRoot, target)), `Missing package export target: ${target}`);
    }
  }
  for (const key of ['.', './docx']) {
    const publicEntry = path.join(packageRoot, manifest.exports[key].default);
    assert(!/@docx-editor\.dev|docx-editor\.class/u.test(readFileSync(publicEntry, 'utf8')), `Eager public entry: ${key}`);
  }
  assert(existsSync(path.join(dist, 'docx/editor.css')));
}
console.log('Document companion public/export/dependency checks passed');
