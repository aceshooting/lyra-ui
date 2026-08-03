import assert from 'node:assert/strict';
import test from 'node:test';
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
