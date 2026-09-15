// Post-build verification: unlike `generate-theme-bootstrap.test.mjs` (which only exercises the
// generator against a synthetic tmp fixture), this asserts the byte-exact claim against the
// PACKAGE'S OWN real `dist/theme/theme-bootstrap.js` and `dist/theme/theme.js` -- the actual files
// a published tarball ships. It therefore requires a prior `pnpm run build` and, like
// `ai-compile-contract.test.mjs`, is deliberately chained only into `check:build-artifacts` (the
// second half of the `build` script, run after `scripts/build.mjs` has already produced `dist/`)
// and NOT into `test:tooling`/`contract-policy`, which `pnpm lint` runs without building first.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { checkThemeBootstrapAsset, readBuiltThemeBootstrap } from './generate-theme-bootstrap.mjs';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const builtModule = join(packageDir, 'dist', 'theme', 'theme.js');
const asset = join(packageDir, 'dist', 'theme', 'theme-bootstrap.js');

test('dist/theme/theme-bootstrap.js is byte-identical to dist/theme/theme.js\'s lyraThemeBootstrap export', async () => {
  assert.equal(existsSync(builtModule), true, `${builtModule} must exist -- run \`pnpm run build\` before this check.`);

  const expected = await readBuiltThemeBootstrap(packageDir);
  const actualAssetBytes = readFileSync(asset, 'utf8');
  assert.equal(actualAssetBytes, expected, 'the published static asset must equal the built lyraThemeBootstrap export exactly, byte for byte');

  const { findings } = await checkThemeBootstrapAsset(packageDir);
  assert.deepEqual(findings, []);
});
