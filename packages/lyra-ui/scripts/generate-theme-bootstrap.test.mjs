import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkThemeBootstrapAsset,
  generateThemeBootstrapAsset,
  readBuiltThemeBootstrap,
} from './generate-theme-bootstrap.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-theme-bootstrap-'));

function writeBuiltModule(bootstrap) {
  writeFileSync(
    join(fixtureRoot, 'dist', 'theme', 'theme.js'),
    `export const lyraThemeBootstrap = ${JSON.stringify(bootstrap)};\nexport const other = 1;\n`,
  );
}

// A close approximation of the real shape: a self-invoking IIFE, single-line, exactly what
// `dist/theme/theme.js`'s own `lyraThemeBootstrap` looks like after esbuild syntax minification --
// this is the fixture, not a re-derivation of the real algorithm (which lives only in theme.ts).
const FIRST_BOOTSTRAP = "(function(k,a){try{localStorage.getItem(k)}catch{}})(\"lyra-theme\",[\"data-lr-theme\",\"data-theme\"]);";
const SECOND_BOOTSTRAP = "(function(k,a){try{localStorage.getItem(k)}catch{}})(\"custom-key\",[\"data-lr-theme\",\"data-theme\"]);";

try {
  mkdirSync(join(fixtureRoot, 'dist', 'theme'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'scripts'), { recursive: true });
  writeFileSync(
    join(fixtureRoot, 'scripts', 'generate-theme-bootstrap.mjs'),
    readFileSync(join(scriptDir, 'generate-theme-bootstrap.mjs'), 'utf8'),
  );
  writeFileSync(
    join(fixtureRoot, 'scripts', 'is-main-module.mjs'),
    readFileSync(join(scriptDir, 'is-main-module.mjs'), 'utf8'),
  );

  // 1. Missing built module fails closed (never emits a wrong/empty asset).
  await assert.rejects(
    () => readBuiltThemeBootstrap(fixtureRoot),
    /does not exist/,
    'a missing dist/theme/theme.js must fail closed',
  );

  // 2. Generation copies the built module's export verbatim -- byte for byte, not re-derived.
  writeBuiltModule(FIRST_BOOTSTRAP);
  const generated = await generateThemeBootstrapAsset(fixtureRoot);
  assert.equal(generated, FIRST_BOOTSTRAP);
  const assetPath = join(fixtureRoot, 'dist', 'theme', 'theme-bootstrap.js');
  assert.equal(readFileSync(assetPath, 'utf8'), FIRST_BOOTSTRAP, 'asset bytes must equal the built export exactly');

  // 3. --check passes immediately after generation.
  const freshCheck = await checkThemeBootstrapAsset(fixtureRoot);
  assert.deepEqual(freshCheck.findings, []);

  // 4. A rebuild that changes the exported string (simulating an edit to theme.ts followed by
  // `pnpm build`, but not yet by asset regeneration) must be caught by --check.
  writeBuiltModule(SECOND_BOOTSTRAP);
  const staleCheck = await checkThemeBootstrapAsset(fixtureRoot);
  assert.deepEqual(staleCheck.findings, ['dist/theme/theme-bootstrap.js is stale or missing relative to dist/theme/theme.js']);

  // 5. Regenerating resolves the staleness.
  await generateThemeBootstrapAsset(fixtureRoot);
  assert.equal(readFileSync(assetPath, 'utf8'), SECOND_BOOTSTRAP);
  const resolvedCheck = await checkThemeBootstrapAsset(fixtureRoot);
  assert.deepEqual(resolvedCheck.findings, []);

  // 6. The CLI wiring itself: `--check` and generation exit with the expected codes out of
  // process, exactly like every other generated-artifact script in this repo.
  const script = join(fixtureRoot, 'scripts', 'generate-theme-bootstrap.mjs');
  execFileSync(process.execPath, [script, '--check'], { cwd: fixtureRoot, stdio: 'pipe' });

  writeBuiltModule(FIRST_BOOTSTRAP);
  assert.throws(
    () => execFileSync(process.execPath, [script, '--check'], { cwd: fixtureRoot, stdio: 'pipe' }),
    /Command failed/,
    '--check must reject a stale asset over the CLI too',
  );
  execFileSync(process.execPath, [script], { cwd: fixtureRoot, stdio: 'pipe' });
  assert.equal(readFileSync(assetPath, 'utf8'), FIRST_BOOTSTRAP);
  execFileSync(process.execPath, [script, '--check'], { cwd: fixtureRoot, stdio: 'pipe' });

  assert.throws(
    () => execFileSync(process.execPath, [script, '--bogus'], { cwd: fixtureRoot, stdio: 'pipe' }),
    /Command failed/,
    'an unknown flag must fail closed',
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('theme bootstrap asset generation and freshness tests passed.');
