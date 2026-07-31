// Asserts the contrast guarantees the semantic grid claims, so a regenerated palette can never
// quietly ship a WCAG failure.
//
// The grid's whole promise is that a component can pair `--lr-color-<v>-on-<e>` with
// `--lr-color-<v>-fill-<e>` and not have to think about it. That promise is only worth anything if
// something checks it — and nothing did: colour values lived as hand-picked hexes across 280 tokens
// with no automated contrast coverage at all, which is how a chart ramp shipped at 1.54:1 on the
// page surface.
//
// Checked here, in BOTH modes:
//   1. every `on-<e>` clears WCAG 1.4.3 AA (4.5:1) against its paired `fill-<e>`
//   2. every `border-normal` and `border-loud` clears SC 1.4.11 non-text contrast (3:1) against the
//      page surface, since those are the tokens a control's visible bounds are drawn with
//
// `border-quiet` is deliberately EXEMPT, and that is a design decision rather than an oversight: it
// exists for decoration that is not load-bearing -- a rule between table rows, a hairline inside an
// already-bounded card. SC 1.4.11 governs a boundary "required to identify" a component; a token
// held to 3:1 would not be quiet, and forcing it there would leave the library with no subtle rule
// at all. The rule is therefore enforced on the tokens that DO identify a control, and the exemption
// is documented so nobody reaches for `border-quiet` as a control's only boundary.
//
// Run: node scripts/check-contrast.mjs

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const palettePath = join(packageDir, 'src', 'internal', 'tokens', 'palette.styles.ts');
const themePath = join(packageDir, 'src', 'theme.css');

const TEXT_CONTRAST = 4.5; // WCAG 2.2 SC 1.4.3, normal-size text
const NON_TEXT_CONTRAST = 3; // WCAG 2.2 SC 1.4.11, UI component boundaries

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function relativeLuminance(hex) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(value.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The palette file declares the light grid in the first `:host` block and the dark grid in the
 * blocks after it. Split on the selector boundaries rather than parsing CSS: the file is generated,
 * so its shape is fixed and a regex is honest here in a way it would not be against authored CSS.
 */
function readGrids(text) {
  const body = text.slice(text.indexOf('export const palette'));
  const blocks = body.split(/\n\s*(?=:host|@media)/);
  const parse = (block) => {
    const map = new Map();
    for (const match of block.matchAll(/(--lr-(?:color|ramp)-[a-z0-9-]+):\s*var\([^,]+,\s*(#[0-9a-f]{6})\)/g)) {
      map.set(match[1], match[2]);
    }
    for (const match of block.matchAll(/(--lr-ramp-[a-z0-9-]+):\s*(#[0-9a-f]{6})/g)) map.set(match[1], match[2]);
    return map;
  };
  // Select by SELECTOR, never by position: the split also yields the file preamble as a block, so
  // indexing shifted every grid by one and silently compared the light values against the dark
  // surface. That produced five confident, entirely fictional failures.
  const find = (predicate) => blocks.find((block) => predicate(block.trimStart())) ?? '';
  const light = parse(find((block) => block.startsWith(':host {')));
  const dark = parse(find((block) => block.startsWith(":host([data-lr-theme='dark'])")));
  return { light, dark };
}

/**
 * The page surface each mode renders against, read from the shipped theme rather than assumed.
 * Anchored on the selector *lines* rather than a substring index: `theme.css` is wrapped in
 * `@layer lr-theme { ... }`, and `.lr-dark` also appears inside the file's prose, so a naive
 * `indexOf` split silently handed the light surface back for both modes.
 */
function readSurfaces(text) {
  const lines = text.split('\n');
  const darkStart = lines.findIndex((line) => /^\s*\.lr-dark\s*,?\s*$/.test(line));
  const grab = (slice) => slice.join('\n').match(/--lr-theme-color-surface-default:\s*(#[0-9a-f]{6})/i)?.[1];
  if (darkStart < 0) return { light: grab(lines), dark: undefined };
  return { light: grab(lines.slice(0, darkStart)), dark: grab(lines.slice(darkStart)) };
}

const { light, dark } = readGrids(readFileSync(palettePath, 'utf8'));
const surfaces = readSurfaces(readFileSync(themePath, 'utf8'));

const findings = [];
let checks = 0;

for (const [mode, grid] of [
  ['light', light],
  ['dark', dark],
]) {
  const surface = surfaces[mode];
  if (!surface) {
    findings.push(`${mode}: could not read --lr-theme-color-surface-default from theme.css`);
    continue;
  }
  for (const [token, value] of grid) {
    const onMatch = token.match(/^--lr-color-([a-z]+)-on-([a-z]+)$/);
    if (onMatch) {
      const fill = grid.get(`--lr-color-${onMatch[1]}-fill-${onMatch[2]}`);
      if (!fill) {
        findings.push(`${mode}: ${token} has no paired fill token`);
        continue;
      }
      checks += 1;
      const ratio = contrastRatio(value, fill);
      if (ratio < TEXT_CONTRAST) {
        findings.push(`${mode}: ${token} (${value}) on ${fill} is ${ratio.toFixed(2)}:1, below WCAG 1.4.3's ${TEXT_CONTRAST}:1`);
      }
      continue;
    }
    if (/^--lr-color-[a-z]+-border-(?:normal|loud)$/.test(token)) {
      checks += 1;
      const ratio = contrastRatio(value, surface);
      if (ratio < NON_TEXT_CONTRAST) {
        findings.push(`${mode}: ${token} (${value}) on the ${mode} surface ${surface} is ${ratio.toFixed(2)}:1, below WCAG 1.4.11's ${NON_TEXT_CONTRAST}:1`);
      }
    }
  }
}

if (findings.length) {
  console.error(`Contrast contract failed with ${findings.length} finding(s) across ${checks} check(s):`);
  for (const finding of findings) console.error(`- ${finding}`);
  console.error('\nRegenerate with `node scripts/generate-palette.mjs` after adjusting the ramp or the slot map.');
  process.exitCode = 1;
} else {
  console.log(`Contrast contract passed: ${checks} pairs checked across light and dark.`);
}
