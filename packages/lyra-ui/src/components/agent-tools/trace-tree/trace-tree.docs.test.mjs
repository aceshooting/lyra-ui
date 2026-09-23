import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// See time-range.docs.test.mjs for why this reads raw source/markdown instead of going through
// wtr: esbuild strips JSDoc/comment text from every `.ts` module before a browser ever sees it.
const here = dirname(fileURLToPath(import.meta.url));
const stylesSource = readFileSync(join(here, 'trace-tree.styles.ts'), 'utf8');
const llmsAgentTools = readFileSync(join(here, '../../../../llms/agent-tools.md'), 'utf8');
const paletteSource = readFileSync(join(here, '../../../internal/tokens/palette.styles.ts'), 'utf8');
const tokensSource = readFileSync(join(here, '../../../internal/tokens.styles.ts'), 'utf8');

// --- Minimal WCAG relative-luminance/contrast helpers, mirroring the shipped
// `scripts/check-contrast.mjs` formula, to prove the documented baseline ratio is still accurate
// against whatever the palette currently ships -- not just a fixed string.
function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function relativeLuminance(hex) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrastRatio(hexA, hexB) {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

function ramp(name) {
  const re = new RegExp(`--lr-ramp-${name}:\\s*(#[0-9a-fA-F]{6});`);
  const match = paletteSource.match(re);
  assert.ok(match, `expected --lr-ramp-${name} in palette.styles.ts`);
  return match[1];
}
function textQuietLight() {
  const match = tokensSource.match(/--lr-color-text-quiet: var\(--lr-theme-color-text-quiet, (#[0-9a-fA-F]{6})\)/);
  assert.ok(match, 'expected a light --lr-color-text-quiet default');
  return match[1];
}

test('trace-tree.styles.ts no longer states the stale text-quiet baseline contrast ratio', () => {
  assert.doesNotMatch(
    stylesSource,
    /text-quiet against brand-quiet lands at ~4\.25:1/,
    'the ~4.25:1 baseline predates the 2026-08-01 ramp rewrite and no longer reproduces',
  );
});

test('trace-tree.styles.ts no longer states the stale success/warning mixed contrast ratios', () => {
  assert.doesNotMatch(
    stylesSource,
    /success\s*4\.46 -> 6\.18, denied\/warning 4\.28 -> 5\.96/,
    'these mixed ratios predate the 2026-08-01 ramp rewrite and no longer reproduce',
  );
});

test('llms/agent-tools.md no longer states the stale contrast ratios', () => {
  assert.doesNotMatch(
    llmsAgentTools,
    /~4\.25:1/,
    'llms/agent-tools.md must not repeat the stale text-quiet baseline ratio',
  );
  assert.doesNotMatch(
    llmsAgentTools,
    /success 4\.46 → 6\.18, `denied` 4\.28 →\s*5\.96/,
    'llms/agent-tools.md must not repeat the stale mixed-status ratios',
  );
});

test('the live text-quiet-vs-brand-quiet contrast in light mode is close to the newly documented baseline, not the stale one', () => {
  const brandQuietLight = ramp('brand-95');
  const textQuietLight_ = textQuietLight();
  const ratio = contrastRatio(textQuietLight_, brandQuietLight);
  // Recomputed against the shipped 2026-08-01 ramp: ~4.17:1 (still under the 4.5:1 AA floor).
  assert.ok(ratio > 4.0 && ratio < 4.3, `expected the live ratio to sit near 4.17:1, got ${ratio.toFixed(2)}`);
  assert.ok(ratio < 4.5, 'the baseline must still be documented as failing the AA floor');
});
