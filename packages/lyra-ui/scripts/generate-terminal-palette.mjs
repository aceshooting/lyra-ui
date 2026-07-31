// Regenerates `<lr-terminal>`'s 16-colour ANSI/SGR palette in `src/theme.css`, for BOTH modes,
// between the `terminal ramp: generated` markers.
//
// The palette used to be declared once, in the light block only. A dark block re-declares just what
// differs, so dark mode inherited all sixteen light-mode colours and rendered them on a near-black
// panel: ten of the sixteen fell below WCAG 1.4.3's 4.5:1, and `black` came out at 1.02:1 — text
// that is, for practical purposes, invisible. `scripts/check-contrast.mjs` now measures every entry
// in both modes.
//
// The reference background is `--lr-color-surface-raised`, not the page surface: `<lr-terminal>`
// paints its own panel, so measuring against the page would be checking the palette against a
// background it is never drawn on.
//
// Each colour keeps its canonical ANSI HUE — a terminal's red has to look like red, or escape
// sequences stop meaning what every other terminal makes them mean. Only lightness is solved for,
// walked away from the panel until the entry clears the contrast floor. `black`/`white` and their
// bright variants are achromatic and solved the same way, which is what stops "black" from being
// literally invisible on a black panel: on a dark surface, ANSI `black` becomes the darkest shade
// that is still legible, not `#000`.
//
// Run: node scripts/generate-terminal-palette.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const themePath = join(packageDir, 'src', 'theme.css');

const TEXT_CONTRAST = 4.5;
const CONTRAST_TARGET = 4.75; // headroom over the gate

// Canonical ANSI hues in OKLCH degrees, plus the chroma each can carry. `black`/`white` are
// achromatic; their "bright" variants are the same hue, solved to a different lightness.
const ANSI = [
  ['black', null, 0],
  ['red', 27, 0.16],
  ['green', 145, 0.14],
  ['yellow', 90, 0.14],
  ['blue', 258, 0.15],
  ['magenta', 310, 0.16],
  ['cyan', 205, 0.12],
  ['white', null, 0],
  ['bright-black', null, 0],
  ['bright-red', 27, 0.18],
  ['bright-green', 145, 0.16],
  ['bright-yellow', 90, 0.16],
  ['bright-blue', 258, 0.17],
  ['bright-magenta', 310, 0.18],
  ['bright-cyan', 205, 0.14],
  ['bright-white', null, 0],
];

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function oklchToRgb({ L, C, H }) {
  const h = ((H ?? 0) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function toHex({ L, C, H }) {
  let chroma = C;
  for (let i = 0; i < 200; i += 1) {
    const rgb = oklchToRgb({ L, C: chroma, H });
    if (rgb.every((c) => c >= -0.0001 && c <= 1.0001)) {
      return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`;
    }
    chroma *= 0.98;
  }
  return '#000000';
}

const luminance = (hex) => {
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(hex.slice(1 + i, 3 + i), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/**
 * Walks lightness away from the panel until the entry clears the floor, keeping the hue fixed.
 * `bright` variants start further from the panel than their base, preserving the ANSI convention
 * that bright is the more prominent of the pair while both stay legible.
 */
function solve(name, hue, chroma, surface) {
  const onDark = luminance(surface) < 0.2;
  const bright = name.startsWith('bright-');
  // On a dark panel every colour has to be LIGHTER than it; on a light panel, darker.
  let L = onDark ? (bright ? 0.82 : 0.72) : bright ? 0.5 : 0.42;
  const step = onDark ? 0.01 : -0.01;
  for (let i = 0; i < 120; i += 1) {
    const hex = toHex({ L, C: chroma, H: hue });
    if (contrast(hex, surface) >= CONTRAST_TARGET) return hex;
    L = Math.min(0.99, Math.max(0.02, L + step));
  }
  return toHex({ L, C: chroma, H: hue });
}

const themeText = readFileSync(themePath, 'utf8');

function readPerMode(token) {
  const lines = themeText.split('\n');
  const darkStart = lines.findIndex((line) => /^\s*\.lr-dark\s*,?\s*$/.test(line));
  const grab = (slice) => slice.join('\n').match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  return { light: grab(lines.slice(0, darkStart)), dark: grab(lines.slice(darkStart)) };
}

const raised = readPerMode('--lr-theme-color-surface-raised');
if (!raised.light || !raised.dark) throw new Error('could not read --lr-theme-color-surface-raised for both modes');

let output = themeText;
for (const mode of ['light', 'dark']) {
  const surface = raised[mode];
  const entries = ANSI.map(([name, hue, chroma]) => [name, solve(name, hue, chroma, surface)]);
  const block = entries.map(([name, hex]) => `    --lr-theme-terminal-color-${name}: ${hex};`).join('\n');
  const pattern = new RegExp(
    `(/\\* terminal ramp: generated \\(${mode}\\) -- see scripts/generate-terminal-palette\\.mjs \\*/\\n)[\\s\\S]*?(\\n\\s*/\\* terminal ramp: end \\*/)`,
  );
  if (!pattern.test(output)) throw new Error(`missing generated-terminal markers for ${mode} in theme.css`);
  output = output.replace(pattern, `$1${block}$2`);
  const worst = Math.min(...entries.map(([, hex]) => contrast(hex, surface)));
  console.log(`${mode}: 16 ANSI colours on ${surface}, min contrast ${worst.toFixed(2)}:1 (floor ${TEXT_CONTRAST})`);
}
writeFileSync(themePath, output, 'utf8');
