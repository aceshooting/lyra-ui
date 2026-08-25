import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PALETTE_ARTIFACTS,
  PALETTE_GENERATORS,
  checkPaletteFreshness,
} from './check-palette-freshness.mjs';

test('palette freshness owns every runtime fallback written by its generators', () => {
  assert.deepEqual(PALETTE_GENERATORS, [
    'scripts/generate-palette.mjs',
    'scripts/generate-chart-palette.mjs',
    'scripts/generate-terminal-palette.mjs',
  ]);
  assert.deepEqual(PALETTE_ARTIFACTS, [
    'src/internal/tokens/palette.styles.ts',
    'src/theme.css',
    'src/internal/specialist-tokens.styles.ts',
    'src/components/charts/chart/chart-colors.ts',
  ]);
});

test('the checked-in palette artifacts round-trip through every generator', () => {
  assert.deepEqual(checkPaletteFreshness(), []);
});

test('the gate still runs its main-module guard when invoked through a symlink of a different name', () => {
  // `path.resolve()`/plain string comparison against `fileURLToPath(import.meta.url)` normalises
  // `.`/`..` segments but does not resolve symlinks, so a gate invoked through a differently named
  // symlink (e.g. a package-manager bin shim) can silently skip its own main-module block: exit 0
  // with zero output, reported as success. This exercises exactly that invocation shape.
  const realScript = fileURLToPath(new URL('./check-palette-freshness.mjs', import.meta.url));
  const tempDir = mkdtempSync(join(tmpdir(), 'lyra-symlink-guard-'));
  const symlinkPath = join(tempDir, 'cpf.mjs');
  try {
    symlinkSync(realScript, symlinkPath);
    const output = execFileSync(process.execPath, [symlinkPath], { encoding: 'utf8' });
    assert.ok(
      output.trim().length > 0,
      'a symlinked invocation must still run the gate and print its result, not silently no-op'
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
