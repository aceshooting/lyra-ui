// Regenerates `<lr-terminal>`'s ANSI/SGR palette in `src/theme.css` AND the mirrored opt-in
// fallbacks in `src/internal/specialist-tokens.styles.ts`, for BOTH modes, between the
// `terminal ramp` markers.
//
// Two token sets are generated, because SGR gives the sixteen names two different jobs:
//
//   --lr-terminal-color-<name>   foreground (CSI 30-37 / 90-97), drawn ON the terminal panel
//   --lr-terminal-bg-<name>      background (CSI 40-47 / 100-107), drawn UNDER the terminal's text
//
// They used to be the same sixteen tokens, which is what every native terminal does — but a native
// terminal's palette is tuned for its own background, and Lyra's is solved against the panel. Once
// the foregrounds were solved to clear 4.5:1 against a LIGHT panel they all became dark, so
// `ESC[41m` painted a near-black red behind the panel's near-black default text: 1.5:1, i.e.
// unreadable. Backgrounds therefore get their own set, solved from the opposite side.
//
// The guarantees, both enforced by `scripts/check-contrast.mjs` in both modes:
//
//   1. every `--lr-terminal-color-*` clears WCAG 1.4.3's 4.5:1 against `--lr-color-surface-raised`
//      (the panel `<lr-terminal>` paints for itself — measuring against the page would be checking
//      the palette against a background it is never drawn on)
//   2. every `--lr-terminal-bg-*` clears 4.5:1 against the panel's DEFAULT TEXT colour, which is the
//      foreground actually in effect whenever a program sets a background and no explicit colour
//
// An explicit foreground+background pair (`ESC[30;47m`) is the emitting program's choice and is not
// guaranteed here, exactly as in a native terminal: sixteen foregrounds against sixteen backgrounds
// is 256 combinations, several of which are degenerate by construction (red on red). What IS
// guaranteed is the two cases a program cannot avoid — any foreground on the panel, and the default
// foreground on any background.
//
// The consequence, stated rather than buried: on a LIGHT panel every background is a light tint, so
// `ESC[40m` ("black background") renders as the darkest tint that still leaves the default text
// legible rather than as literal black. That is the only reading of "accessible" available — a
// literal black background under near-black default text is text nobody can read.
//
// Each colour keeps its canonical ANSI HUE — a terminal's red has to look like red, or escape
// sequences stop meaning what every other terminal makes them mean. Only lightness is solved for.
// The four achromatic entries (black / bright-black / white / bright-white) are RANK-SEPARATED
// rather than all solved to the same target: solving them identically is why `white` and `black`
// used to resolve to the same hex, so `ESC[30;47m` rendered invisible text on its own colour.
//
// Run: node scripts/generate-terminal-palette.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const themePath = join(packageDir, 'src', 'theme.css');
const specialistTokensPath = join(packageDir, 'src', 'internal', 'specialist-tokens.styles.ts');

const TEXT_CONTRAST = 4.5;
const CONTRAST_TARGET = 4.75; // headroom over the gate

// Canonical ANSI hues in OKLCH degrees, plus the chroma each can carry. `black`/`white` are
// achromatic; their "bright" variants are the same hue, solved to a different lightness.
// `rank` orders the four achromatic entries from darkest (0) to lightest (3) so they stay four
// distinguishable greys instead of collapsing onto one solved lightness.
const ANSI = [
  ['black', null, 0, 0],
  ['red', 27, 0.16, null],
  ['green', 145, 0.14, null],
  ['yellow', 90, 0.14, null],
  ['blue', 258, 0.15, null],
  ['magenta', 310, 0.16, null],
  ['cyan', 205, 0.12, null],
  ['white', null, 0, 2],
  ['bright-black', null, 0, 1],
  ['bright-red', 27, 0.18, null],
  ['bright-green', 145, 0.16, null],
  ['bright-yellow', 90, 0.16, null],
  ['bright-blue', 258, 0.17, null],
  ['bright-magenta', 310, 0.18, null],
  ['bright-cyan', 205, 0.14, null],
  ['bright-white', null, 0, 3],
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
 * The lightest (on a light reference) / darkest (on a dark reference) lightness that still clears
 * the target against `reference`, for the given hue. This is the constrained end of the legible
 * range: everything further from the reference also clears the floor, so ranked entries are laid
 * out from here outward.
 */
function solveBoundary(hue, chroma, reference, { away }) {
  const step = away ? 0.01 : -0.01;
  // Start at the far end of the range and walk toward the reference, so the FIRST lightness that
  // clears is the true boundary. Starting mid-scale returns 0.5 whenever 0.5 happens to clear,
  // which silently truncates the ladder rather than placing it.
  let L = away ? 0.02 : 0.98;
  for (let i = 0; i < 120; i += 1) {
    const hex = toHex({ L, C: chroma, H: hue });
    if (contrast(hex, reference) >= CONTRAST_TARGET) return L;
    L = Math.min(0.99, Math.max(0.02, L + step));
  }
  return L;
}

/**
 * Walks lightness away from `reference` until the entry clears the floor, keeping the hue fixed.
 * `bright` variants start further from the reference than their base, preserving the ANSI convention
 * that bright is the more prominent of the pair while both stay legible.
 *
 * An achromatic entry with a `rank` is instead placed at a fixed offset beyond the boundary, so the
 * four greys stay four distinct values in ANSI order (black darkest → bright-white lightest on a
 * light panel, and the same order preserved when the whole set is mirrored for a dark one).
 */
function solve(name, hue, chroma, rank, reference) {
  const onDark = luminance(reference) < 0.2;
  if (rank !== null) {
    const boundary = solveBoundary(hue, chroma, reference, { away: onDark });
    // The invariant is the ANSI one: black < bright-black < white < bright-white in LIGHTNESS,
    // in both sets and both modes. Only one end of the legible range is available, so `black` is
    // pinned to the darkest lightness that still clears the floor and the ladder steps up in 0.08
    // increments from there. Against a dark reference the legible range lies ABOVE the boundary,
    // so black sits on it; against a light reference the range lies below, so bright-white does.
    const L = onDark
      ? Math.min(0.99, boundary + rank * 0.08)
      : Math.max(0.02, boundary - (3 - rank) * 0.08);
    return toHex({ L, C: chroma, H: hue });
  }
  const bright = name.startsWith('bright-');
  // On a dark panel every colour has to be LIGHTER than it; on a light panel, darker.
  let L = onDark ? (bright ? 0.82 : 0.72) : bright ? 0.5 : 0.42;
  const step = onDark ? 0.01 : -0.01;
  for (let i = 0; i < 120; i += 1) {
    const hex = toHex({ L, C: chroma, H: hue });
    if (contrast(hex, reference) >= CONTRAST_TARGET) return hex;
    L = Math.min(0.99, Math.max(0.02, L + step));
  }
  return toHex({ L, C: chroma, H: hue });
}

/**
 * Replaces a marker-delimited generated block. Throws rather than no-op replacing: the previous
 * implementation silently did nothing when the target region did not contain the token it was asked
 * to rewrite, which is exactly how a token-sheet split could otherwise leave the specialist
 * fallbacks stale while this script reported success for both modes.
 */
function replaceBlock(text, label, mode, block, file) {
  const pattern = new RegExp(
    `(/\\* ${label}: generated \\(${mode}\\) -- see scripts/generate-terminal-palette\\.mjs \\*/\\n)[\\s\\S]*?(\\n[ \\t]*/\\* ${label}: end \\*/)`,
  );
  if (!pattern.test(text)) {
    throw new Error(`missing "${label}: generated (${mode})" markers in ${file}`);
  }
  return text.replace(pattern, `$1${block}$2`);
}

function readPerMode(themeText, token) {
  const lines = themeText.split('\n');
  const darkStart = lines.findIndex((line) => /^\s*\.lr-dark\s*,?\s*$/.test(line));
  const grab = (slice) => slice.join('\n').match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  return { light: grab(lines.slice(0, darkStart)), dark: grab(lines.slice(darkStart)) };
}

const themeText = readFileSync(themePath, 'utf8');
const raised = readPerMode(themeText, '--lr-theme-color-surface-raised');
const text = readPerMode(themeText, '--lr-theme-color-text-normal');
if (!raised.light || !raised.dark) throw new Error('could not read --lr-theme-color-surface-raised for both modes');
if (!text.light || !text.dark) throw new Error('could not read --lr-theme-color-text-normal for both modes');

let themeOut = themeText;
let specialistTokensOut = readFileSync(specialistTokensPath, 'utf8');

for (const mode of ['light', 'dark']) {
  const panel = raised[mode];
  const defaultText = text[mode];

  // Foregrounds are solved against the panel; backgrounds against the default text that will sit on
  // them. Same solver, opposite reference — which is the whole reason the two sets differ.
  const fg = ANSI.map(([name, hue, chroma, rank]) => [name, solve(name, hue, chroma, rank, panel)]);
  const bg = ANSI.map(([name, hue, chroma, rank]) => [
    name,
    // Backgrounds carry less chroma than foregrounds: a saturated full-width band is fatiguing to
    // read across, and the hue still reads clearly at half chroma behind text.
    solve(name, hue, chroma * 0.5, rank, defaultText),
  ]);

  themeOut = replaceBlock(
    themeOut,
    'terminal ramp',
    mode,
    [
      ...fg.map(([name, hex]) => `    --lr-theme-terminal-color-${name}: ${hex};`),
      ...bg.map(([name, hex]) => `    --lr-theme-terminal-bg-${name}: ${hex};`),
    ].join('\n'),
    'theme.css',
  );

  specialistTokensOut = replaceBlock(
    specialistTokensOut,
    'terminal ramp',
    mode,
    [
      ...fg.map(([name, hex]) => `    --lr-terminal-color-${name}: var(--lr-theme-terminal-color-${name}, ${hex});`),
      ...bg.map(([name, hex]) => `    --lr-terminal-bg-${name}: var(--lr-theme-terminal-bg-${name}, ${hex});`),
    ].join('\n'),
    'specialist-tokens.styles.ts',
  );

  const worstFg = Math.min(...fg.map(([, hex]) => contrast(hex, panel)));
  const worstBg = Math.min(...bg.map(([, hex]) => contrast(hex, defaultText)));
  // `white` and `black` used to resolve to the same hex in each mode, so `ESC[30;47m` rendered
  // invisible text on its own colour. Assert not just distinctness but ANSI ORDER, in both sets.
  const ORDER = ['black', 'bright-black', 'white', 'bright-white'];
  for (const [label, set] of [['foreground', fg], ['background', bg]]) {
    const greys = ORDER.map((name) => set.find(([n]) => n === name)[1]);
    const levels = greys.map(luminance);
    if (levels.some((l, i) => i > 0 && l <= levels[i - 1])) {
      throw new Error(
        `${mode}: the four achromatic ANSI ${label}s are not in ascending lightness order ` +
          `(${ORDER.map((n, i) => `${n}=${greys[i]}`).join(' ')})`,
      );
    }
  }
  console.log(
    `${mode}: 16 foregrounds on ${panel}, min ${worstFg.toFixed(2)}:1; ` +
      `16 backgrounds under ${defaultText}, min ${worstBg.toFixed(2)}:1 (floor ${TEXT_CONTRAST})`,
  );
}

writeFileSync(themePath, themeOut, 'utf8');
writeFileSync(specialistTokensPath, specialistTokensOut, 'utf8');
