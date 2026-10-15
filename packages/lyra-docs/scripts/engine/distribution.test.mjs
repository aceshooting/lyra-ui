import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { sha256 } from './source.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const directory = process.env.DOCX_ENGINE_OUTPUT ?? path.join(root, 'dist/engine');
const lock = JSON.parse(await readFile(path.join(root, 'scripts/engine-source.lock.json')));
const provenance = JSON.parse(await readFile(path.join(directory, 'provenance.json')));

test('engine distribution leaves preload resolution to the consuming application', async () => {
  let dynamicImports = 0;
  let annotations = 0;
  for (const asset of provenance.assets.filter(asset => asset.file.endsWith('.js'))) {
    const bytes = await readFile(path.join(directory, asset.file));
    assert.equal(sha256(bytes), asset.sha256, `${asset.file} provenance differs`);
    assert(bytes.length <= 500_000, `${asset.file} exceeds the normal 500 kB chunk limit`);
    const source = bytes.toString('utf8');
    assert(!source.includes('__vite__mapDeps'), `${asset.file} contains application preload URLs that become stale when rebundled`);
    assert(!source.includes('data:application/wasm'), `${asset.file} inlines the text shaper binary`);
    dynamicImports += [...source.matchAll(/\bimport\(/gu)].length;
    annotations += [...source.matchAll(/[@#]__PURE__/gu)].length;
  }
  assert(dynamicImports > 0, 'Semantic features must remain dynamically imported');
  assert(annotations > 0, 'Preserve purity annotations for consumer tree shaking');
});

test('engine distribution emits the exact external text shaper binary', async () => {
  const expected = lock.assets.find(asset => asset.relative === 'harfbuzz.wasm');
  const binaries = provenance.assets.filter(asset => asset.file.endsWith('.wasm'));
  assert.equal(binaries.length, 1);
  const bytes = await readFile(path.join(directory, binaries[0].file));
  assert.equal(bytes.length, expected.bytes);
  assert.equal(sha256(bytes), expected.sha256);
});
