// Generates `src/internal/tokens/palette.styles.ts`: the semantic grid resolved from a numeric
// OKLCH ramp retained in canonical design-token data.
// WHY A RAMP AT ALL. Before this, the library had 15 flat semantic colours and nothing underneath
// them. Every shade a component wanted that wasn't one of the 15 had to be invented on the spot --
// a `color-mix`, a `filter: brightness()`, a hand-picked hex -- so "slightly quieter brand" meant
// something different in each stylesheet, and none of it moved when a consumer rethemed.
// WHY OKLCH. Perceptual lightness. In sRGB, stepping the numeric channel by a fixed amount produces
// wildly uneven perceived steps, and two hues at the "same" lightness look nothing alike -- which is
// exactly why a hand-picked yellow ramp always ends up lighter than the blue one beside it. OKLCH's
// L axis is perceptually uniform, so an evenly spaced L gives an evenly spaced ramp for every hue,
// and the same step number means the same *apparent* lightness across all five variants. That is
// what makes a 45-slot grid predictable instead of 45 individual decisions.
// GENERATED, NOT HAND-PICKED, per the release plan. Each variant's hue and chroma are derived from
// the existing brand/success/warning/danger anchors, so the palette still looks like lyra-ui; only
// the spacing between steps is computed. Re-run with:
//   node scripts/generate-palette.mjs
// and commit the result. `scripts/check-contrast.mjs` then asserts the guarantees the grid claims.

import { writeFileSync, mkdirSync } from 'node:fs';
import { assertCanonicalPalette, readCanonicalPalette, srgbToLinear, toSrgbHex } from './palette-canonical.mjs';
import { readStyleModel, defaultStyleInputs, replaceStyleFallbacks } from './style-axes-model.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(packageDir, 'src', 'internal', 'tokens', 'palette.styles.ts');
const styleModel = readStyleModel(packageDir);
const defaultInputs = defaultStyleInputs(styleModel);

// --- colour maths -------------------------------------------------------------------------------
// sRGB <-> OKLab per Björn Ottosson's published derivation. The inverse conversion and gamut fit
// live in palette-canonical.mjs so all three palette solvers use identical maths.

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
// 5 variants x {fill, border, on} x {quiet, normal, loud}. This is the layer components consume;
// no component references a ramp step directly, so the ramp can be regenerated without touching a
// single stylesheet. Light and dark differ only in which step each slot points at -- the grid's
// SHAPE is identical, which is what makes a component's colour behaviour mode-independent.
// The steps are not free choices. `--lr-theme-color-<variant>-fill-<emphasis>` is an EXISTING
// public retheming hook: `tokens.styles.ts` has always resolved the flat `--lr-color-brand` through
// `--lr-theme-color-brand-fill-loud`, and `theme.css` has always given that hook the brand anchor
// itself. Measured, the shipped hooks sit at OKLCH L 52-55 for light `fill-loud`, 95 for light
// `fill-quiet`, 67-70 for dark `fill-loud` and 32 for dark `fill-quiet`.
// So `fill-loud` must land on the anchor step, not a step darker than it. Getting this wrong is not
// cosmetic: it makes one hook name mean two different colours depending on whether a stylesheet
// reads the flat token or the grid slot, and every component migrated onto the grid would silently
// change colour. `emphasis` runs quiet -> normal -> loud, so lightness falls in light mode and
// rises in dark mode; keeping that monotonic is what lets a component be written once for both.
const SLOTS = {
  light: {
    fill: { quiet: 95, normal: 80, loud: 50 },
    border: { quiet: 80, normal: 60, loud: 40 },
  },
  dark: {
    fill: { quiet: 30, normal: 50, loud: 70 },
    border: { quiet: 30, normal: 60, loud: 70 },
  },
};

/** Which ramp step `onColor` picked for the semantic grid. */
function onStep(background, ramps) {
  const dark = ramps.neutral[0];
  const light = ramps.neutral[ramps.neutral.length - 1];
  return contrastRatio(background, dark.hex) >= contrastRatio(background, light.hex) ? dark.step : light.step;
}

/**
 * Build the grid.
 *
 * The numeric ramps remain in canonical token data for tooling. Runtime hosts receive only the
 * resolved semantic grid, which avoids declaring 55 unused ramp properties per element.
 */
function buildGrid(ramps, mode, { resolve = (variant, step) => ramps[variant].find((entry) => entry.step === step).hex } = {}) {
  const stepHex = (variant, step) => ramps[variant].find((entry) => entry.step === step).hex;
  const lines = [];
  for (const variant of Object.keys(VARIANTS)) {
    for (const [emphasis, step] of Object.entries(SLOTS[mode].fill)) {
      lines.push(
        `      --lr-color-${variant}-fill-${emphasis}: var(--lr-theme-color-${variant}-fill-${emphasis}, ${resolve(variant, step)});`,
      );
    }
    for (const [emphasis, step] of Object.entries(SLOTS[mode].border)) {
      lines.push(
        `      --lr-color-${variant}-border-${emphasis}: var(--lr-theme-color-${variant}-border-${emphasis}, ${resolve(variant, step)});`,
      );
    }
    for (const emphasis of Object.keys(SLOTS[mode].fill)) {
      const fill = stepHex(variant, SLOTS[mode].fill[emphasis]);
      lines.push(
        `      --lr-color-${variant}-on-${emphasis}: var(--lr-theme-color-${variant}-on-${emphasis}, ${resolve('neutral', onStep(fill, ramps))});`,
      );
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

const ramps = Object.fromEntries(Object.entries(VARIANTS).map(([name, spec]) => [name, ramp(spec)]));

const output = `// GENERATED by scripts/generate-palette.mjs -- do not edit by hand.
// The 45-slot semantic grid is resolved from the numeric OKLCH ramp retained in canonical token
// data for design tooling. Components consume only --lr-color-* semantic slots, never raw steps.
// Every slot chains through a --lr-theme-* hook, so a consumer can retheme one slot without
// forking the ramp, exactly like every other token in the library.
import { css } from 'lit';

export const palette = css\`
  :host {
${buildGrid(ramps, 'light')}
  }

  :host([data-lr-theme='dark']) {
${buildGrid(ramps, 'dark')}
  }

  /* Deliberately a SEPARATE rule from the one above, not another selector in its list. A selector
     list is not forgiving: Firefox and Safari ship no :host-context(), so one of these in the same
     list would invalidate the whole list and take the supported :host([data-lr-theme='dark'])
     branch down with it -- silently dropping the entire dark grid in two of the three engines.
     Split, each engine keeps whatever it understands.

     Those engines still resolve an ancestor .lr-dark correctly, just by a different route:
     theme.css declares the mode's values as ordinary custom properties on .lr-dark, and custom
     properties inherit through the shadow boundary. This rule is the no-theme.css convenience
     path, not the contract.

     The :host(:not(...)) half keeps a light island inside a dark subtree light: without it this
     rule sits later at equal specificity and beats the light :host block. It has to be written as
     its own :host() pseudo -- a bare :not([data-lr-theme='light']) appended to :host-context()
     matches nothing at all, because the shadow host is featureless. */
  :host(:not([data-lr-theme='light'])):host-context(.lr-dark),
  :host(:not([data-lr-theme='light'])):host-context([data-lr-theme='dark']) {
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


// --- validate the canonical theme projection ---------------------------------------------------
// `theme.css` is optional. A consumer who never loads it must still get these exact colours, which
// is why the component stylesheet above carries the whole grid as its own fallbacks. But a consumer
// who DOES load it must not get different ones -- `tokens.test.ts` asserts that equality directly,
// because a hand-maintained second copy is precisely how the two drifted apart before.
// It is also what makes an ancestor `.lr-dark` work in Firefox and Safari. Those engines ship no
// `:host-context()`, so the shadow-scoped rule cannot see an ancestor class; these declarations are
// ordinary custom properties on a document element, and custom properties inherit through the
// shadow boundary in every engine.
const themeGrid = (mode) =>
  buildGrid(ramps, mode, { resolve: (variant, step) => ramps[variant].find((e) => e.step === step).hex })
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.trim().replace(/^--lr-color-/, '    --lr-theme-color-').replace(/: var\([^,]+, (#[0-9a-f]{6})\);$/, ': $1;'))
    .concat(
      // The focus ring defaults to the brand fill, so it has to move with it. Left hand-written, it
      // silently pinned the pre-ramp blue and made theme.css disagree with the component fallback
      // for exactly one token -- which is the whole failure mode this block exists to prevent.
      `    --lr-theme-color-focus: ${ramps.brand.find((e) => e.step === SLOTS[mode].fill.loud).hex};`,
    )
    .join('\n');

// style-axes alone owns theme.css. Validate the solver against its canonical inputs instead of
// rewriting a second generator's artifact. Any intentional palette change must update both the
// canonical values and the solver definition, keeping design tools and component fallbacks equal.
assertCanonicalPalette(readCanonicalPalette(packageDir), Object.fromEntries(
  ['light', 'dark'].map(mode => [mode, Object.fromEntries(
    [...themeGrid(mode).matchAll(/(--lr-theme-[a-z0-9-]+): (#[0-9a-f]{6});/g)]
      .map(([, name, value]) => [name, value]),
  )]),
));
mkdirSync(dirname(outputPath), { recursive: true });
const darkMarker = output.indexOf(":host([data-lr-theme='dark'])");
if (darkMarker < 0) throw new Error('Palette fallback mode marker changed');
const projected = replaceStyleFallbacks(output.slice(0, darkMarker), defaultInputs, 'light', styleModel.canonical.tokens) + replaceStyleFallbacks(output.slice(darkMarker), defaultInputs, 'dark', styleModel.canonical.tokens);
writeFileSync(outputPath, projected, 'utf8');

const slots = Object.keys(VARIANTS).length * 9;
console.log(
  `Wrote ${outputPath.replace(`${packageDir}/`, '')}: ` +
    `${Object.keys(VARIANTS).length} ramps x ${STEPS.length} steps, ${slots} semantic slots per mode.`,
);
