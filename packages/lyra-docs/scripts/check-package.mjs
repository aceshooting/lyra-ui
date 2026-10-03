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
assert.equal(manifest.version, '0.1.0');
assert.equal(manifest.private, true, 'Experimental editors must remain private');
assert.equal(manifest.type, 'module');
assert.equal(manifest.engines.node, '>=22');
assert.equal(manifest.packageManager, JSON.parse(read('package.json')).packageManager);
assert.deepEqual(manifest.sideEffects, [
  './dist/docx/editor.js', './src/docx/editor.ts', './dist/docx/editor.css',
]);
assert.equal(manifest.publishConfig, undefined);
assert.deepEqual(manifest.exports, {
  '.': { types: './dist/index.d.ts', default: './dist/index.js' },
  './docx': { types: './dist/docx/index.d.ts', default: './dist/docx/index.js' },
  './docx/editor': { types: './dist/docx/editor.d.ts', default: './dist/docx/editor.js' },
  './docx/editor.class': { types: './dist/docx/docx-editor.class.d.ts', default: './dist/docx/docx-editor.class.js' },
  './docx/editor.css': './dist/docx/editor.css',
  './package.json': './package.json',
});
assert.deepEqual(manifest.files, ['dist', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_LICENSES']);
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
assert(JSON.parse(read('.changeset/config.json')).ignore.includes(manifest.name));
for (const file of readdirSync(path.join(repoRoot, '.changeset'))) {
  if (!file.endsWith('.md')) continue;
  const frontmatter = read(`.changeset/${file}`).match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1] ?? '';
  assert(!frontmatter.includes(manifest.name), `Experimental release entry: ${file}`);
}
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
// Only documented subpaths are public; implementations remain behind the export map.
const dist = path.join(packageRoot, 'dist');
if (existsSync(dist)) {
  for (const file of files(dist)) {
    assert(/\.(?:js|d\.ts|css)$/u.test(file), `Unexpected build artifact: ${file}`);
    assert(!/\.test\.|-fixtures\./u.test(file), `Test build artifact: ${file}`);
    const source = readFileSync(file, 'utf8');
    if (/(?:index|types|create-session|docx-editor(?:\.class)?)\.d\.ts$/u.test(file)) {
      assert(!/@docx-editor\.dev\//u.test(source), `Public engine type leaked: ${file}`);
    }
  }
  for (const key of ['.', './docx']) {
    const publicEntry = path.join(packageRoot, manifest.exports[key].default);
    assert(!/@docx-editor\.dev|docx-editor\.class/u.test(readFileSync(publicEntry, 'utf8')), `Eager public entry: ${key}`);
  }
  assert(existsSync(path.join(dist, 'docx/editor.css')));
}
console.log('Document companion private/export/dependency checks passed');
