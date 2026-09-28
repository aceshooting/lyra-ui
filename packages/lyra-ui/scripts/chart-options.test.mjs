import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { chartPaletteKind, checkOrderedChartScales } from './chart-palette-contract.mjs';

const source = readFileSync(new URL('../src/theme/options/charts.ts', import.meta.url), 'utf8');
const canonical = JSON.parse(readFileSync(new URL('../tokens/canonical-tokens.json', import.meta.url), 'utf8')).tokens;

test('optional categorical data stays identical to the contrast-qualified canonical palette', () => {
  for (const mode of ['light', 'dark']) {
    const block = source.match(new RegExp(`const ${mode.toUpperCase()}_CATEGORIES = Object.freeze\\(\\[([\\s\\S]*?)\\]\\)`));
    assert.ok(block, `missing ${mode} category array`);
    const colors = [...block[1].matchAll(/'(#[a-f0-9]{6})'/g)].map(match => match[1]);
    assert.equal(colors.length, 8);
    assert.deepEqual(colors, Array.from({ length: 8 }, (_, index) =>
      canonical[`--lr-theme-color-chart-${index + 1}`].values[mode]
    ));
  }
});

test('optional ordered scales match their canonical and built-in look defaults', () => {
  for (const name of ['lyra', 'shadcn', 'material']) {
    const look = name === 'lyra' ? null : JSON.parse(readFileSync(new URL(`../tokens/looks/${name}.json`, import.meta.url), 'utf8'));
    const block = source.match(new RegExp(`${name}: Object.freeze\\(\\{([\\s\\S]*?)\\n  \\}\\)`));
    assert.ok(block);
    for (const mode of ['light', 'dark']) {
      const ramps = block[1].match(new RegExp(`${mode}: palette\\([A-Z_]+, \\[([^\\]]+)\\], \\[([^\\]]+)\\]\\)`));
      assert.ok(ramps);
      for (const [offset, kind] of ['sequential', 'diverging'].entries()) {
        const colors = [...ramps[offset + 1].matchAll(/'(#[a-f0-9]{6})'/g)].map(match => match[1]);
        assert.deepEqual(colors, Array.from({ length: 3 }, (_, index) => {
          const token = `--lr-theme-color-chart-${kind}-${index + 1}`;
          return look ? look.tokens[token][mode] : canonical[token].values[mode];
        }));
      }
    }
  }
});

test('palette choices do not import style runtime, components, DOM helpers or chart engines', () => {
  assert.deepEqual(source.match(/^import .+$/gm), ["import type { LyraThemeTokens, LyraThemeTokenName } from '../theme.js';"]);
  assert.doesNotMatch(source, /\b(?:document|window)\s*\.|\bfetch\s*\(|import\(/);
});

test('ordered scales have complete, directional magnitude and neutral diverging centers in every look', () => {
  for (const name of ['lyra', 'shadcn', 'material']) {
    const look = name === 'lyra' ? null : JSON.parse(readFileSync(new URL(`../tokens/looks/${name}.json`, import.meta.url), 'utf8'));
    for (const mode of ['light', 'dark']) {
      const tokens = new Map();
      for (const kind of ['sequential', 'diverging']) for (const index of [1, 2, 3]) {
        const token = `--lr-theme-color-chart-${kind}-${index}`;
        tokens.set(token, look ? look.tokens[token][mode] : canonical[token].values[mode]);
      }
      assert.deepEqual(checkOrderedChartScales(tokens, mode, `${name}/${mode}`).findings, []);
      const invalid = new Map(tokens);
      invalid.set('--lr-theme-color-chart-sequential-2', invalid.get('--lr-theme-color-chart-sequential-1'));
      assert.ok(checkOrderedChartScales(invalid, mode, name).findings.some(value => value.includes('strictly')));
      invalid.set('--lr-theme-color-chart-diverging-2', '#ff0000');
      assert.ok(checkOrderedChartScales(invalid, mode, name).findings.some(value => value.includes('near-neutral')));
      invalid.delete('--lr-theme-color-chart-diverging-3');
      assert.ok(checkOrderedChartScales(invalid, mode, name).findings.some(value => value.includes('three opaque')));
      const flat = new Map(tokens);
      for (const kind of ['sequential', 'diverging']) for (const index of [1, 2, 3]) flat.set(`--lr-theme-color-chart-${kind}-${index}`, '#808080');
      const flatFindings = checkOrderedChartScales(flat, mode, name).findings;
      assert.ok(flatFindings.some(value => value.includes('tonal range')));
      assert.ok(flatFindings.some(value => value.includes('endpoints must remain distinct')));
    }
  }
});

test('categorical classification includes exactly the eight qualified series, never magnitude stops', () => {
  for (let index = 1; index <= 8; index++) assert.equal(chartPaletteKind(`--lr-theme-color-chart-${index}`), 'categorical');
  assert.equal(chartPaletteKind('--lr-theme-color-chart-9'), null);
  assert.equal(chartPaletteKind('--lr-theme-color-chart-sequential-1'), 'sequential');
  assert.equal(chartPaletteKind('--lr-theme-color-chart-diverging-2'), 'diverging');
  assert.equal(chartPaletteKind('--lr-theme-color-chart-sequential-4'), null);
});
