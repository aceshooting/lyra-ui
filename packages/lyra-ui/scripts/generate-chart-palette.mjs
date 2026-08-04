// Regenerates the 8-series categorical chart ramp in `src/theme.css`, in place, between the
// `chart ramp: generated` markers.
// The old ramp failed twice over, and `scripts/check-contrast.mjs` now measures both:
//   1. SC 1.4.11. A chart series is a non-text graphical object conveying data, so it needs 3:1
//      against the surface it is drawn on. Four of the eight light-mode series were below that, the
//      worst (`chart-8`, a pale grey) at 1.54:1 — effectively invisible on white.
//   2. Colour-vision deficiency. Series 5-8 were literally lighter tints of series 1-4, i.e. the
//      same four hues twice. Under dichromacy that is worse than it sounds: hue is exactly the
//      channel that collapses, so pairs which merely differ in hue become identical. 20 of 28 dark
//      pairs and 7 of 28 light pairs were indistinguishable.
// THE FIX IS STRUCTURAL, not a nudge. A categorical ramp that survives dichromacy cannot rely on
// hue alone: it has to separate on LIGHTNESS too, because lightness is the one channel every form
// of colour blindness preserves. The ramp is therefore selected by greedy farthest-point search
// over a candidate pool that already clears the contrast floor, maximising worst-case separation
// under all three dichromacies. That is also why the result is not a "prettier" version of the old
// ramp: an evenly-lit categorical ramp cannot satisfy the constraint at all.
// Run: node scripts/generate-chart-palette.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const themePath = join(packageDir, 'src', 'theme.css');
const specialistTokensPath = join(packageDir, 'src', 'internal', 'specialist-tokens.styles.ts');

const SERIES = 8;
const NON_TEXT_CONTRAST = 3;
const CVD_MIN_DISTANCE = 0.1;
// Headroom over the gate's own thresholds (3 and 0.1), so a later hand-tweak of a surface token
// does not immediately push a generated value under the line. The CVD figure is modest on purpose:
// eight mutually-distinguishable series is close to the practical ceiling for one ramp, and asking
// for much more separation than the gate requires simply makes the search unsatisfiable.
const CONTRAST_TARGET = 3.35;
const CVD_TARGET = 0.115;

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function oklchToRgb({ L, C, H }) {
  const h = (H * Math.PI) / 180;
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

const channels = (hex) => [0, 2, 4].map((i) => srgbToLinear(parseInt(hex.slice(1 + i, 3 + i), 16) / 255));
const luminance = (hex) => {
  const [r, g, b] = channels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const CVD = {
  protanopia: [0.170556992, 0.829443014, 0, 0.170556991, 0.829443008, 0, -0.004517144, 0.004517144, 1],
  deuteranopia: [0.33066007, 0.66933993, 0, 0.33066007, 0.66933993, 0, -0.02785538, 0.02785538, 1],
  tritanopia: [1, 0.1273989, -0.1273989, 0, 0.8739093, 0.1260907, 0, 0.8739093, 0.1260907],
};

function simulate(hex, kind) {
  const [r, g, b] = channels(hex);
  const m = CVD[kind];
  const out = [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b];
  return `#${out.map((c) => Math.round(Math.min(1, Math.max(0, linearToSrgb(c))) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function oklab(hex) {
  const [r, g, b] = channels(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function distance(a, b) {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Worst-case separation of a candidate set: the closest pair under any dichromacy. */
function worstSeparation(hexes) {
  let worst = Infinity;
  for (let i = 0; i < hexes.length; i += 1) {
    for (let j = i + 1; j < hexes.length; j += 1) {
      for (const kind of Object.keys(CVD)) {
        worst = Math.min(worst, distance(simulate(hexes[i], kind), simulate(hexes[j], kind)));
      }
    }
  }
  return worst;
}

/**
 * Builds a ramp for one mode by greedy farthest-point selection.
 *
 * A candidate pool is enumerated across hue x lightness x chroma and filtered to entries that
 * already clear the contrast floor against this mode's surface — so contrast is satisfied by
 * construction and never traded away. From that pool the ramp is grown one entry at a time, each
 * time taking the candidate whose worst-case distance to everything already chosen (under all three
 * dichromacies) is largest. That is what forces the ramp onto the lightness axis: once several hues
 * are taken, the only remaining way to be far from all of them under dichromacy is to differ in
 * lightness.
 *
 * Fully deterministic — no randomness, no iteration limit to tune, and the same input always yields
 * the same ramp, which the freshness of a generated file depends on.
 */
function solve(surface, mode) {
  const dark = luminance(surface) < 0.2;
  const pool = [];
  for (let hue = 0; hue < 360; hue += 5) {
    for (let l = 0.25; l <= 0.95; l += 0.02) {
      for (const chroma of [0.08, 0.12, 0.16, 0.2]) {
        const hex = toHex({ L: l, C: chroma, H: hue });
        if (contrast(hex, surface) >= CONTRAST_TARGET) pool.push(hex);
      }
    }
  }
  if (pool.length < SERIES) throw new Error(`no candidates clear the contrast floor for the ${mode} ramp`);

  // Seed with the entry furthest from the surface itself, so the first series is unambiguously
  // visible rather than merely compliant.
  const chosen = [pool.reduce((best, hex) => (contrast(hex, surface) > contrast(best, surface) ? hex : best), pool[0])];
  while (chosen.length < SERIES) {
    let bestHex = null;
    let bestScore = -Infinity;
    for (const hex of pool) {
      if (chosen.includes(hex)) continue;
      let score = Infinity;
      for (const taken of chosen) {
        for (const kind of Object.keys(CVD)) {
          score = Math.min(score, distance(simulate(hex, kind), simulate(taken, kind)));
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestHex = hex;
      }
    }
    chosen.push(bestHex);
  }

  const separation = worstSeparation(chosen);
  if (separation < CVD_TARGET) {
    throw new Error(`the ${mode} ramp only reached ${separation.toFixed(3)} separation, below ${CVD_TARGET}`);
  }
  // Order by lightness so consecutive series indices read as a deliberate progression rather than
  // the arbitrary order the search happened to find them in.
  return chosen.sort((a, b) => (dark ? luminance(b) - luminance(a) : luminance(a) - luminance(b)));
}

/**
 * Rewrites the matching opt-in fallbacks in `src/internal/specialist-tokens.styles.ts` so they
 * stay byte-identical to `theme.css`.
 *
 * That equality is a real contract, not tidiness: `theme.css` is optional, and a consumer who never
 * imports it gets the hardcoded fallback instead. If the two drift, importing the theme silently
 * changes colours that were supposed to be identical — which is exactly what `tokens.test.ts`'s
 * bridged-token assertions catch. Generating both from one source is what makes the drift
 * impossible rather than merely detected.
 *
 * Marker-delimited mode blocks make the write fail closed if the specialist sheet changes shape;
 * a replacement count of zero must never be reported as successful generation.
 */
function writeTokenFallbacks(filePath, valuesByMode) {
  let text = readFileSync(filePath, 'utf8');
  for (const mode of ['light', 'dark']) {
    const block = Object.entries(valuesByMode[mode] ?? {})
      .map(([name, hex]) => `    --lr-${name}: var(--lr-theme-${name}, ${hex});`)
      .join('\n');
    const pattern = new RegExp(
      `(/\\* chart fallback ramp: generated \\(${mode}\\) -- see scripts/generate-chart-palette\\.mjs \\*/\\n)[\\s\\S]*?(\\n[ \\t]*/\\* chart fallback ramp: end \\*/)`,
    );
    if (!pattern.test(text)) {
      throw new Error(`missing generated chart-fallback markers for ${mode} in specialist-tokens.styles.ts`);
    }
    text = text.replace(pattern, `$1${block}$2`);
  }
  writeFileSync(filePath, text, 'utf8');
}

const themeText = readFileSync(themePath, 'utf8');

/**
 * Reads a token from each mode's block. Anchored on the `.lr-dark` SELECTOR LINE, never a substring
 * search: the file's own header prose mentions `.lr-dark`, so an `indexOf` split silently returns
 * the light value for both modes -- which produced a "dark" ramp designed against white.
 */
function readPerMode(token) {
  const lines = themeText.split('\n');
  const darkStart = lines.findIndex((line) => /^\s*\.lr-dark\s*,?\s*$/.test(line));
  const grab = (slice) => slice.join('\n').match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  return { light: grab(lines.slice(0, darkStart)), dark: grab(lines.slice(darkStart)) };
}

const { light: lightSurface, dark: darkSurface } = readPerMode('--lr-theme-color-surface-default');
if (!lightSurface || !darkSurface) throw new Error('could not read a surface token for both modes');

const ramps = { light: solve(lightSurface, 'light'), dark: solve(darkSurface, 'dark') };

let output = themeText;
for (const [mode, hexes] of Object.entries(ramps)) {
  const block = hexes.map((hex, i) => `    --lr-theme-color-chart-${i + 1}: ${hex};`).join('\n');
  const pattern = new RegExp(
    `(/\\* chart ramp: generated \\(${mode}\\) -- see scripts/generate-chart-palette\\.mjs \\*/\\n)[\\s\\S]*?(\\n\\s*/\\* chart ramp: end \\*/)`,
  );
  if (!pattern.test(output)) throw new Error(`missing generated-chart markers for ${mode} in theme.css`);
  output = output.replace(pattern, `$1${block}$2`);
}
writeFileSync(themePath, output, 'utf8');
// The chart component keeps its own JS copy of the light ramp, reached when the tokens cannot be
// resolved at all (no DOM, or an unparseable custom property). Hand-written, it silently outlived
// two regenerations of the CSS ramp and went on shipping colours that fail both the contrast and
// the colour-vision-deficiency guarantees this script exists to hold. Generated, it cannot.
const fallbackPath = join(packageDir, 'src', 'components', 'charts', 'chart', 'chart-colors.ts');
const fallbackBlock = ramps.light.map((hex) => `  '${hex}',`).join('\n');
const fallbackText = readFileSync(fallbackPath, 'utf8');
const fallbackPattern =
  /(\/\* chart fallback: generated -- see scripts\/generate-chart-palette\.mjs \*\/\nconst FALLBACK_SERIES_PALETTE = \[\n)[\s\S]*?(\n\] as const;)/;
if (!fallbackPattern.test(fallbackText)) throw new Error('missing chart-fallback markers in chart-colors.ts');
writeFileSync(fallbackPath, fallbackText.replace(fallbackPattern, `$1${fallbackBlock}$2`), 'utf8');

writeTokenFallbacks(
  specialistTokensPath,
  Object.fromEntries(
    Object.entries(ramps).map(([mode, hexes]) => [
      mode,
      Object.fromEntries(hexes.map((hex, i) => [`color-chart-${i + 1}`, hex])),
    ]),
  ),
);

for (const [mode, hexes] of Object.entries(ramps)) {
  const surface = mode === 'light' ? lightSurface : darkSurface;
  const minContrast = Math.min(...hexes.map((hex) => contrast(hex, surface)));
  console.log(
    `${mode}: ${SERIES} series, min contrast ${minContrast.toFixed(2)}:1 (floor ${NON_TEXT_CONTRAST}), ` +
      `worst CVD separation ${worstSeparation(hexes).toFixed(3)} (floor ${CVD_MIN_DISTANCE})`,
  );
}

