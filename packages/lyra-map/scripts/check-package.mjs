import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const provenance = JSON.parse(await readFile(resolve(root, 'dist/provenance.json'), 'utf8'));
assert.equal(manifest.name, '@aceshooting/lyra-map');
assert.equal(provenance.version, '6.14.0');
assert.equal(provenance.changedSourceFiles.length, 16);
assert.ok(provenance.modules.length < 700);
for (const module of provenance.modules) {
  assert.ok(!module.file.includes('node_modules'));
  assert.ok(!module.file.includes('..'));
  const code = await readFile(resolve(root, 'dist', module.file), 'utf8');
  assert.ok(!code.includes('sourceMappingURL='));
  assert.ok(!/\/(?:home|mnt|Users)\//.test(code), 'Generated modules must not contain workspace paths');
}
for (const entry of Object.values(manifest.exports)) {
  for (const path of typeof entry === 'string' ? [entry] : Object.values(entry)) await readFile(resolve(root, path));
}
const actual = await import(new URL('../dist/index.mjs', import.meta.url));
const upstream = await import('maplibre-gl');
for (const name of Object.keys(upstream)) assert.ok(name in actual, `Missing upstream runtime export ${name}`);
assert.equal(typeof actual.Map.prototype.prepareFeatures, 'function');
assert.equal(typeof actual.prepareStyle, 'function');
assert.ok((await readdir(resolve(root, 'dist'))).includes('map.css'));
console.log('Map package exports, provenance, and generated module checks passed.');
