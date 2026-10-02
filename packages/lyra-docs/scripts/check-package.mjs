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
assert.equal(manifest.sideEffects, false);
assert.equal(manifest.publishConfig, undefined);
assert.deepEqual(manifest.exports, {
  '.': { types: './dist/index.d.ts', default: './dist/index.js' },
  './docx': { types: './dist/docx/index.d.ts', default: './dist/docx/index.js' },
  './package.json': './package.json',
});
assert.deepEqual(manifest.files, ['dist', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']);
for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
  assert.equal(Object.keys(manifest[field] ?? {}).length, 0, 'No unused runtime dependency');
}
assert.deepEqual(Object.keys(manifest.devDependencies).sort(), ['@types/node', 'typescript']);
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
// Check the relevant pure-TypeScript rules without enrolling this package as a UI component.
for (const file of files(path.join(packageRoot, 'src'))) {
  const source = readFileSync(file, 'utf8');
  assert.deepEqual(findDoubleQuotedStringLiterals(source), [], `String literal policy: ${file}`);
  assert.deepEqual(findNulByteLines(source), [], `NUL byte: ${file}`);
  assert.deepEqual(findBareGlobalIsNaNCalls(source, file), [], `Finite number policy: ${file}`);
  assert(!/@aceshooting\/lyra-ui|@docx-editor\.dev\/|(?:\.\.\/)+lyra-ui\/|from\s+['"]lit(?:\/|['"])/u.test(source),
    `Unexpected runtime dependency: ${file}`);
}
assert.equal(read('packages/lyra-docs/src/docx/index.ts').trim(), "export type * from './types.js';");
assert.match(read('packages/lyra-docs/src/index.ts'), /export \{\};\s*$/u);
// The public build contains declarations and empty ESM only; internal code never ships.
const dist = path.join(packageRoot, 'dist');
if (existsSync(dist)) {
  assert.deepEqual(files(dist).map((file) => path.relative(dist, file)).sort(), [
    'docx/index.d.ts', 'docx/index.js', 'docx/types.d.ts', 'docx/types.js', 'index.d.ts', 'index.js',
  ]);
  for (const file of files(dist)) {
    const source = readFileSync(file, 'utf8');
    assert(!/engine-port|session\.js|createInternalDocxSession/u.test(source), `Internal export: ${file}`);
    if (file.endsWith('.js')) assert.match(source, /^(?:\/\*[\s\S]*?\*\/\s*)?export \{\};\s*$/u);
  }
}
console.log('Document companion private/export/dependency checks passed');
