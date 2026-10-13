import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewedSha256 } from '../packages/lyra-ui/scripts/generate-shiki-wasm.mjs';

const sourceModule = fileURLToPath(new URL('../packages/lyra-ui/src/components/conversation/code-block/shiki-types.ts', import.meta.url));
const assetReference = /new URL\(\s*(['"])\.\/onig\.wasm\1\s*,\s*import\.meta\.url\s*\)/g;

/** Source stories use the same reviewed binary as the package, without requiring dist. */
export function sourceShikiWasmPlugin() {
  const require = createRequire(new URL('../packages/lyra-ui/package.json', import.meta.url));
  const binaryPath = require.resolve('shiki/onig.wasm');
  const binary = readFileSync(binaryPath);
  assert.equal(createHash('sha256').update(binary).digest('hex'), reviewedSha256,
    'Storybook Shiki WASM changed: review the packaged binary before building source stories');
  const assetPath = relative(dirname(sourceModule), binaryPath).replaceAll('\\', '/');
  return {
    name: 'lyra-source-shiki-wasm',
    enforce: 'pre',
    transform(source, id) {
      if (id.split('?')[0] !== sourceModule) return;
      assert.equal([...source.matchAll(assetReference)].length, 1,
        'Expected exactly one source Shiki WASM reference');
      // Keep Vite's ordinary asset handling for both dev URLs and hashed production output.
      return { code: source.replace(assetReference, `new URL(${JSON.stringify(assetPath)}, import.meta.url)`), map: null };
    },
  };
}
