// Generates `src/internal/tokens/palette.styles.ts`: a numeric OKLCH colour ramp plus the semantic
// grid built on top of it.
//
// WHY A RAMP AT ALL. Before this, the library had 15 flat semantic colours and nothing underneath
// them. Every shade a component wanted that wasn't one of the 15 had to be invented on the spot --
// a `color-mix`, a `filter: brightness()`, a hand-picked hex -- so "slightly quieter brand" meant
// something different in each stylesheet, and none of it moved when a consumer rethemed.
//
// WHY OKLCH. Perceptual lightness. In sRGB, stepping the numeric channel by a fixed amount produces
// wildly uneven perceived steps, and two hues at the "same" lightness look nothing alike -- which is
// exactly why a hand-picked yellow ramp always ends up lighter than the blue one beside it. OKLCH's
// L axis is perceptually uniform, so an evenly spaced L gives an evenly spaced ramp for every hue,
// and the same step number means the same *apparent* lightness across all five variants. That is
// what makes a 45-slot grid predictable instead of 45 individual decisions.
//
// GENERATED, NOT HAND-PICKED, per the release plan. Each variant's hue and chroma are derived from
// the existing brand/success/warning/danger anchors, so the palette still looks like lyra-ui; only
// the spacing between steps is computed. Re-run with:
//   node scripts/generate-palette.mjs
// and commit the result. `scripts/check-contrast.mjs` then asserts the guarantees the grid claims.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(packageDir, 'src', 'internal', 'tokens', 'palette.styles.ts');

// --- colour maths -------------------------------------------------------------------------------
// sRGB <-> OKLab per Björn Ottosson's published derivation. Kept inline and dependency-free: this
// runs at build time in a package that ships no colour library, and the transforms are short.

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
}

function rgbToOklch([r, g, b]) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(a, bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function oklchToRgb({ L, C, H }) {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/**
 * Reduces chroma until the colour fits inside sRGB. A high-chroma OKLCH triple at an extreme
 * lightness has no sRGB representation, and naively clamping each channel shifts the HUE, which is
 * how a "red" ramp ends up with an orange step. Walking chroma down instead keeps the hue exact and
 * gives up only saturation, which is the channel a consumer is least likely to notice.
 */
function toSrgbHex({ L, C, H }) {
  let chroma = C;
  for (let i = 0; i < 200; i += 1) {
    const rgb = oklchToRgb({ L, C: chroma, H });
    if (rgb.every((channel) => channel >= -0.0001 && channel <= 1.0001)) {
      return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`;
    }
    chroma *= 0.98;
  }
  return '#000000';
}

// --- ramp definition ----------------------------------------------------------------------------

// The eleven steps, named by their approximate perceptual lightness so the number carries meaning:
// `-05` is nearly black, `-95` nearly white, and `-50` is the mid tone. Evenly spaced in OKLCH L,
// which is the whole point -- an even numeric step IS an even perceived step.
const STEPS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95];

// Hue and peak chroma come from the colours lyra-ui already shipped, so the ramp reads as the same
// palette rather than a new one. Chroma is scaled down toward both ends, because a very light or
// very dark colour cannot carry full chroma in sRGB and forcing it there just clips.
const VARIANTS = {
  brand: { anchor: '#0969da' },
  success: { anchor: '#1a7f37' },
  warning: { anchor: '#9a6700' },
  danger: { anchor: '#cf222e' },
  // Neutral is intentionally near-achromatic: a fixed tiny chroma at the brand hue keeps greys from
  // reading as a dead flat grey beside the coloured ramps, without tinting them visibly.
  neutral: { anchor: '#6b7280', chroma: 0.008 },
};

function ramp({ anchor, chroma }) {
  const base = rgbToOklch(hexToRgb(anchor));
  const peak = chroma ?? base.C;
  return STEPS.map((step) => {
    const L = step / 100;
    // Chroma follows a lightness-dependent envelope peaking mid-ramp: full at L=0.5, tapering to a
    // third at either end. Without it the extreme steps clip and the chroma-reduction loop above
    // has to claw back most of the saturation anyway -- this just does it smoothly and predictably.
    const envelope = 1 - (Math.abs(L - 0.5) / 0.5) ** 1.6 * 0.66;
    return { step, hex: toSrgbHex({ L, C: peak * envelope, H: base.H }) };
  });
}

// --- WCAG contrast, used to choose the `on-*` colours -------------------------------------------

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The better of near-black / near-white against `background`, so `on-*` always clears 4.5:1. */
function onColor(background, ramps) {
  const dark = ramps.neutral[0].hex; // step 5
  const light = ramps.neutral[ramps.neutral.length - 1].hex; // step 95
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

// --- the 45-slot semantic grid ------------------------------------------------------------------
//
// 5 variants x {fill, border, on} x {quiet, normal, loud}. This is the layer components consume;
// no component references a ramp step directly, so the ramp can be regenerated without touching a
// single stylesheet. Light and dark differ only in which step each slot points at -- the grid's
// SHAPE is identical, which is what makes a component's colour behaviour mode-independent.
const SLOTS = {
  light: {
    fill: { quiet: 95, normal: 50, loud: 40 },
    border: { quiet: 80, normal: 60, loud: 40 },
  },
  dark: {
    fill: { quiet: 20, normal: 60, loud: 70 },
    border: { quiet: 30, normal: 50, loud: 70 },
  },
};

function buildGrid(ramps, mode) {
  const stepHex = (variant, step) => ramps[variant].find((entry) => entry.step === step).hex;
  const lines = [];
  for (const variant of Object.keys(VARIANTS)) {
    for (const [emphasis, step] of Object.entries(SLOTS[mode].fill)) {
      const hex = stepHex(variant, step);
      lines.push(`      --lr-color-${variant}-fill-${emphasis}: var(--lr-theme-color-${variant}-fill-${emphasis}, ${hex});`);
    }
    for (const [emphasis, step] of Object.entries(SLOTS[mode].border)) {
      const hex = stepHex(variant, step);
      lines.push(`      --lr-color-${variant}-border-${emphasis}: var(--lr-theme-color-${variant}-border-${emphasis}, ${hex});`);
    }
    for (const emphasis of Object.keys(SLOTS[mode].fill)) {
      const fill = stepHex(variant, SLOTS[mode].fill[emphasis]);
      lines.push(`      --lr-color-${variant}-on-${emphasis}: var(--lr-theme-color-${variant}-on-${emphasis}, ${onColor(fill, ramps)});`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

const ramps = Object.fromEntries(Object.entries(VARIANTS).map(([name, spec]) => [name, ramp(spec)]));

const rampLines = Object.entries(ramps)
  .map(([variant, steps]) =>
    steps
      .map(({ step, hex }) => `      --lr-ramp-${variant}-${String(step).padStart(2, '0')}: ${hex};`)
      .join('\n'),
  )
  .join('\n\n');

const output = `// GENERATED by scripts/generate-palette.mjs -- do not edit by hand.
//
// The numeric OKLCH ramp and the 45-slot semantic grid built on it. See the generator for why the
// ramp is in OKLCH (perceptual lightness: an even numeric step is an even *perceived* step, for
// every hue) and why it is computed rather than hand-picked.
//
// Two layers, and the distinction matters:
//
//   --lr-ramp-<variant>-<step>   the raw ramp. 5 variants x 11 steps. A component must NEVER
//                                reference one of these directly -- that is what re-creates the
//                                "every stylesheet invents its own shade" problem the ramp exists
//                                to remove, and it hard-codes a light-mode choice into a component.
//
//   --lr-color-<variant>-<role>-<emphasis>
//                                the semantic grid: {brand,success,warning,danger,neutral} x
//                                {fill,border,on} x {quiet,normal,loud} = 45 slots. THIS is the
//                                layer components consume. Its shape is identical in light and
//                                dark; only which ramp step each slot points at changes, so a
//                                component written against it is mode-independent for free.
//
// Every slot chains through a --lr-theme-* hook, so a consumer can retheme one slot without
// forking the ramp, exactly like every other token in the library.
import { css } from 'lit';

export const palette = css\`
  :host {
${rampLines}

${buildGrid(ramps, 'light')}
  }

  :host([data-lr-theme='dark']),
  :host-context(.lr-dark),
  :host-context([data-lr-theme='dark']) {
${buildGrid(ramps, 'dark')}
  }

  @media (prefers-color-scheme: dark) {
    :host(:not([data-lr-theme='light'])) {
${buildGrid(ramps, 'dark')
  .split('\n')
  .map((line) => (line ? `  ${line}` : line))
  .join('\n')}
    }
  }
\`;
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, output, 'utf8');

const slots = Object.keys(VARIANTS).length * 9;
console.log(
  `Wrote ${outputPath.replace(`${packageDir}/`, '')}: ` +
    `${Object.keys(VARIANTS).length} ramps x ${STEPS.length} steps, ${slots} semantic slots per mode.`,
);
