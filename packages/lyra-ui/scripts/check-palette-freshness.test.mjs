import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PALETTE_ARTIFACTS,
  PALETTE_GENERATORS,
  checkPaletteFreshness,
} from './check-palette-freshness.mjs';
import { assertCanonicalPalette, canonicalPaletteColor, readCanonicalPalette } from './palette-canonical.mjs';
import { readStyleModel, renderTheme } from './style-axes-model.mjs';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

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
    'src/theme/options/charts.ts',
  ]);
});

test('palette references come from canonical input modes and reject drift or invalid references', () => {
  const tokens = readCanonicalPalette(packageDir);
  const name = '--lr-theme-color-chart-1';
  assert.equal(canonicalPaletteColor(tokens, name, 'dark'), tokens[name].values.dark);
  assert.throws(() => canonicalPaletteColor(tokens, '--lr-no-such-input', 'light'), /opaque six-digit/);
  assert.throws(() => canonicalPaletteColor({ [name]: { scope: 'theme-input', values: { light: 'var(--other)' } } }, name, 'light'), /opaque six-digit/);
  assert.throws(() => assertCanonicalPalette(tokens, { light: { [name]: '#123456' } }), /differs from canonical/);
});

for (const failure of [false, true]) {
  test(`palette freshness restores every generated output after ${failure ? 'generator failure' : 'detected drift'}`, () => {
    const scratch = mkdtempSync(join(tmpdir(), 'lyra-palette-restore-'));
    try {
      cpSync(join(packageDir, 'tokens'), join(scratch, 'tokens'), { recursive: true });
      mkdirSync(join(scratch, 'src/theme'), { recursive: true });
      cpSync(join(packageDir, 'src/theme/gemstones-data.ts'), join(scratch, 'src/theme/gemstones-data.ts'));
      for (const file of PALETTE_ARTIFACTS) {
        mkdirSync(join(scratch, file, '..'), { recursive: true });
        writeFileSync(join(scratch, file), file === 'src/theme.css' ? renderTheme(readStyleModel(scratch)) : file);
      }
      const before = PALETTE_ARTIFACTS.map(file => readFileSync(join(scratch, file), 'utf8'));
      mkdirSync(join(scratch, 'scripts'), { recursive: true });
      for (const [index, generator] of PALETTE_GENERATORS.entries()) {
        const outputs = JSON.stringify(PALETTE_ARTIFACTS.filter(file => file !== 'src/theme.css'));
        writeFileSync(join(scratch, generator), `import { writeFileSync } from 'node:fs';\n` +
          `for (const file of ${outputs}) writeFileSync(file, "changed");\n` +
          (failure && index === 1 ? 'throw new Error("intentional generator failure");' : ''));
      }
      if (failure) assert.throws(() => checkPaletteFreshness(scratch), /intentional generator failure/);
      else assert.deepEqual(checkPaletteFreshness(scratch), PALETTE_ARTIFACTS.filter(file => file !== 'src/theme.css'));
      assert.deepEqual(PALETTE_ARTIFACTS.map(file => readFileSync(join(scratch, file), 'utf8')), before);
      writeFileSync(join(scratch, 'src/theme.css'), 'stale theme');
      if (!failure) {
        assert.ok(checkPaletteFreshness(scratch).includes('src/theme.css'));
        assert.equal(readFileSync(join(scratch, 'src/theme.css'), 'utf8'), 'stale theme');
      }
    } finally { rmSync(scratch, { recursive: true, force: true }); }
  });
}

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
