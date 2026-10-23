import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceShikiWasmPlugin } from './source-shiki-wasm.js';
import { reviewedSha256 } from '../packages/lyra-ui/scripts/generate-shiki-wasm.mjs';

const shared = fileURLToPath(new URL('../packages/lyra-ui/src/components/conversation/code-block/shiki-types.ts', import.meta.url));
const owner = fileURLToPath(new URL('../packages/lyra-ui/src/components/conversation/code-block/shiki-oniguruma.ts', import.meta.url));

test('the actual default highlighter module has no Storybook asset bridge', () => {
  const plugin = sourceShikiWasmPlugin();
  assert.equal(plugin.transform(readFileSync(shared, 'utf8'), shared), undefined);
});

test('the actual opt-in factory bridges exactly the reviewed binary', () => {
  const plugin = sourceShikiWasmPlugin();
  const source = readFileSync(owner, 'utf8');
  const result = plugin.transform(source, owner);
  assert.ok(result, 'The real opt-in source must be transformed');
  assert.equal(plugin.transform(source, `${owner}?import`).code, result.code);
  const references = [...result.code.matchAll(/new URL\(("[^"\n]+"), import\.meta\.url\)/gu)];
  assert.equal(references.length, 1);
  const binaryPath = fileURLToPath(new URL(JSON.parse(references[0][1]), pathToFileURL(owner)));
  const require = createRequire(new URL('../packages/lyra-ui/package.json', import.meta.url));
  assert.equal(binaryPath, require.resolve('shiki/onig.wasm'));
  assert.equal(createHash('sha256').update(readFileSync(binaryPath)).digest('hex'), reviewedSha256);
});
