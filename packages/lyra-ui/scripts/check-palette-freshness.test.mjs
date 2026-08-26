import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

test('the palette gate runs when its entry module is reached through a symlink', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'lyra-palette-gate-symlink-'));
  const entry = fileURLToPath(new URL('./check-palette-freshness.mjs', import.meta.url));
  const linkedEntry = join(scratch, 'check-palette-freshness.mjs');
  try {
    symlinkSync(entry, linkedEntry);
    const result = spawnSync(process.execPath, [linkedEntry], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /palette freshness verified:/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
