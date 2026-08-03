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
const baseTokensPath = join(packageDir, 'src', 'internal', 'tokens.styles.ts');
const specialistTokensPath = join(packageDir, 'src', 'internal', 'specialist-tokens.styles.ts');

const TEXT_CONTRAST = 4.5; // WCAG 2.2 SC 1.4.3, normal-size text
const NON_TEXT_CONTRAST = 3; // WCAG 2.2 SC 1.4.11, UI component boundaries
// Minimum OKLab distance between two categorical series after dichromacy simulation. 0.10 is about
// where two swatches side by side stop reading as the same colour; a judgement call, stated here
// rather than buried, and deliberately not so strict that an 8-series ramp becomes impossible.
const CVD_MIN_DISTANCE = 0.1;

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
  // Select by SELECTOR, never by position: the split also yields the file preamble as a block, so
  // indexing shifted every grid by one and silently compared the light values against the dark
  // surface. That produced five confident, entirely fictional failures.
  const find = (predicate) => blocks.find((block) => predicate(block.trimStart())) ?? '';

  // The ramp is declared once, on `:host`, and inherits into every other block.
  const ramp = new Map();
  for (const match of find((block) => block.startsWith(':host {')).matchAll(
    /(--lr-ramp-[a-z0-9-]+):\s*(#[0-9a-f]{6})/g,
  )) {
    ramp.set(match[1], match[2]);
  }

  /**
   * A grid slot resolves to a ramp step, not to a literal -- that indirection is the point of
   * having a ramp at all. Follow the reference here rather than requiring a hex in the file, or
   * this gate would quietly check zero semantic pairs the moment the grid started using the ramp
   * (a passing run proving nothing, which is worse than a failing one).
   */
  const parse = (block) => {
    const map = new Map();
    for (const match of block.matchAll(
      /(--lr-color-[a-z0-9-]+):\s*var\([^,]+,\s*var\((--lr-ramp-[a-z0-9-]+)\)\)/g,
    )) {
      const hex = ramp.get(match[2]);
      if (!hex) throw new Error(`${match[1]} points at ${match[2]}, which the ramp does not declare`);
      map.set(match[1], hex);
    }
    // Literal fallbacks are still honoured, so a hand-pinned slot stays checkable.
    for (const match of block.matchAll(/(--lr-color-[a-z0-9-]+):\s*var\([^,]+,\s*(#[0-9a-f]{6})\)/g)) {
      map.set(match[1], match[2]);
    }
    return map;
  };

  const light = parse(find((block) => block.startsWith(':host {')));
  // `:host([data-lr-theme='dark'])` is its own rule, not one selector in a list shared with
  // `:host-context(...)`. When it was in a list, the split above cut between the selectors and this
  // block contained nothing but a selector line -- so the dark grid parsed EMPTY and the whole
  // dark half of this gate silently checked nothing at all.
  const dark = parse(find((block) => block.startsWith(":host([data-lr-theme='dark']) {")));
  if (ramp.size === 0) throw new Error('no ramp steps parsed from the palette -- the file shape changed');
  if (dark.size === 0) throw new Error('no dark grid parsed from the palette -- the file shape changed');
  return { light, dark, ramp };
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

/**
 * Every `--lr-theme-<prefix>*` value declared in each mode's block. Used for the ramps that live in
 * `theme.css` rather than the generated palette -- the categorical chart series and the 16-colour
 * terminal ANSI set, both of which shipped with no contrast coverage at all.
 *
 * A dark block only RE-declares what differs, so the dark map starts as a copy of the light one.
 * That is exactly how the cascade behaves, and reproducing it is the point: the terminal palette's
 * real defect was that it was declared once, in the light block, and therefore rendered light-mode
 * colours on the dark surface.
 */
function readThemeRamps(text, prefix) {
  const lines = text.split('\n');
  const darkStart = lines.findIndex((line) => /^\s*\.lr-dark\s*,?\s*$/.test(line));
  const grab = (slice) => {
    const map = new Map();
    const pattern = new RegExp(`(--lr-theme-${prefix}[a-z0-9-]*):\\s*(#[0-9a-f]{6})`, 'gi');
    for (const match of slice.join('\n').matchAll(pattern)) map.set(match[1], match[2]);
    return map;
  };
  if (darkStart < 0) return { light: grab(lines), dark: new Map() };
  const light = grab(lines.slice(0, darkStart));
  const dark = new Map(light);
  for (const [key, value] of grab(lines.slice(darkStart))) dark.set(key, value);
  return { light, dark };
}

/**
 * Simulates the three dichromacies (Brettel/Vienot-style, in linear sRGB) so a categorical ramp can
 * be checked for the failure that matters most in practice: two series obviously different to most
 * viewers and identical to a red-green colour-blind one. Roughly 1 in 12 men has some form of it,
 * and a chart legend keyed only by colour is unusable when two entries collapse.
 */
const CVD_MATRICES = {
  protanopia: [0.170556992, 0.829443014, 0, 0.170556991, 0.829443008, 0, -0.004517144, 0.004517144, 1],
  deuteranopia: [0.33066007, 0.66933993, 0, 0.33066007, 0.66933993, 0, -0.02785538, 0.02785538, 1],
  tritanopia: [1, 0.1273989, -0.1273989, 0, 0.8739093, 0.1260907, 0, 0.8739093, 0.1260907],
};

function simulateCvd(hex, kind) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(value.slice(i, i + 2), 16) / 255));
  const m = CVD_MATRICES[kind];
  const out = [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b];
  const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  return `#${out.map((c) => Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Perceptual distance in OKLab, which is what "these two look the same" actually means. */
function perceptualDistance(a, b) {
  const lab = (hex) => {
    const value = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4].map((i) => srgbToLinear(parseInt(value.slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * The SAME palettes as they ship to a consumer who never imports `theme.css`. `tokens.styles.ts`
 * carries a hardcoded fallback for every `--lr-theme-*` hook, in a `:host` block for light and a
 * `@media (prefers-color-scheme: dark)` block for dark — and nothing read that file, so the dark
 * fallbacks could be (and were) entirely absent while every gate stayed green. A component dropped
 * unstyled onto a dark page is the DEFAULT integration, not an edge case.
 */
function readTokenFallbacks(text, prefix, sourceLabel) {
  const darkAnchor = text.indexOf('@media (prefers-color-scheme: dark)');
  if (darkAnchor < 0) throw new Error(`could not find the prefers-color-scheme block in ${sourceLabel}`);
  const grab = (region) => {
    const map = new Map();
    const pattern = new RegExp(`(--lr-${prefix}[a-z0-9-]*):\\s*var\\(--lr-theme-[a-z0-9-]+,\\s*(#[0-9a-f]{6})\\)`, 'gi');
    for (const match of region.matchAll(pattern)) map.set(match[1], match[2]);
    return map;
  };
  const light = grab(text.slice(0, darkAnchor));
  // A dark block only re-declares what differs, exactly as the cascade behaves.
  const dark = new Map(light);
  for (const [key, value] of grab(text.slice(darkAnchor))) dark.set(key, value);
  return { light, dark };
}

/**
 * Specialist fallbacks live in named Lit CSS fragments so components can opt into the sheet
 * without burdening primitive controls. Parse those authored fragments directly: scanning the
 * composed export would encounter both fragment declarations before their `${...}` interpolation
 * sites and incorrectly let the dark declarations overwrite the light map.
 */
function readSpecialistTokenFallbacks(text, prefix) {
  const readFragment = (name) => {
    const match = text.match(new RegExp('const ' + name + ' = css`([\\s\\S]*?)`;'));
    if (!match) throw new Error(`could not read ${name} from specialist-tokens.styles.ts`);
    const map = new Map();
    const pattern = new RegExp(`(--lr-${prefix}[a-z0-9-]*):\\s*var\\(--lr-theme-[a-z0-9-]+,\\s*(#[0-9a-f]{6})\\)`, 'gi');
    for (const token of match[1].matchAll(pattern)) map.set(token[1], token[2]);
    return map;
  };
  return {
    light: readFragment('lightSpecialistTokens'),
    dark: readFragment('darkSpecialistTokens'),
  };
}

const { light, dark } = readGrids(readFileSync(palettePath, 'utf8'));
const themeText = readFileSync(themePath, 'utf8');
const surfaces = readSurfaces(themeText);
const chart = readThemeRamps(themeText, 'color-chart-');
const terminal = readThemeRamps(themeText, 'terminal-color-');
// `<lr-terminal>` paints its own panel on the raised surface; that is the reference for its palette.
const raisedRamp = readThemeRamps(themeText, 'color-surface-raised');
const raisedSurfaces = {
  light: raisedRamp.light.get('--lr-theme-color-surface-raised'),
  dark: raisedRamp.dark.get('--lr-theme-color-surface-raised'),
};

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

// --- the chart component's own JS fallback ------------------------------------------------------
//
// `chart-colors.ts` carries a literal copy of the light ramp for the case where the tokens cannot
// be resolved at all. It is shipped, so it is subject to the same two guarantees -- but it lives in
// a .ts file, so every check below read straight past it. Hand-maintained, it went on shipping the
// pre-8.0.0 ramp (worst 1.54:1, and entries 5-8 tints of 1-4) through two regenerations of the CSS
// ramp it was supposed to mirror.
{
  const source = readFileSync(join(packageDir, 'src', 'components', 'charts', 'chart', 'chart-colors.ts'), 'utf8');
  const block = source.match(/const FALLBACK_SERIES_PALETTE = \[([\s\S]*?)\] as const;/);
  if (!block) throw new Error('could not read FALLBACK_SERIES_PALETTE from chart-colors.ts');
  const fallback = [...block[1].matchAll(/'(#[0-9a-f]{6})'/gi)].map((match) => match[1]);
  const expected = [...chart.light.values()];
  if (fallback.length !== expected.length || fallback.some((hex, i) => hex !== expected[i])) {
    findings.push(
      `chart-colors.ts's FALLBACK_SERIES_PALETTE has drifted from the generated light ramp — ` +
        `run \`node scripts/generate-chart-palette.mjs\`.\n    file:  ${fallback.join(' ')}\n    ramp:  ${expected.join(' ')}`,
    );
  }
  checks += 1;
}

// --- the theme.css ramps -----------------------------------------------------------------------

// A chart series is a non-text graphical object identifying data, so SC 1.4.11's 3:1 applies
// against the surface it is drawn on.
for (const [mode, ramp] of [['light', chart.light], ['dark', chart.dark]]) {
  const surface = surfaces[mode];
  for (const [token, value] of ramp) {
    checks += 1;
    const ratio = contrastRatio(value, surface);
    if (ratio < NON_TEXT_CONTRAST) {
      findings.push(`${mode}: ${token} (${value}) on the ${mode} surface ${surface} is ${ratio.toFixed(2)}:1, below WCAG 1.4.11's ${NON_TEXT_CONTRAST}:1`);
    }
  }
  const entries = [...ramp.entries()];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      for (const kind of Object.keys(CVD_MATRICES)) {
        checks += 1;
        const distance = perceptualDistance(simulateCvd(entries[i][1], kind), simulateCvd(entries[j][1], kind));
        if (distance < CVD_MIN_DISTANCE) {
          findings.push(`${mode}: ${entries[i][0]} and ${entries[j][0]} collapse under ${kind} (OKLab distance ${distance.toFixed(3)} < ${CVD_MIN_DISTANCE})`);
        }
      }
    }
  }
}

// --- the ANSI palette, in both roles and from both sources ---------------------------------------
//
// Terminal output is text: 4.5:1 in both modes, for both of the palette's two jobs.
//
//   foreground (`--lr-terminal-color-*`, SGR 30-37/90-97) against `--lr-color-surface-raised` --
//     the panel `<lr-terminal>` paints for itself, not the page surface, which it is never drawn on
//   background (`--lr-terminal-bg-*`, SGR 40-47/100-107) against the DEFAULT TEXT colour, which is
//     the foreground actually in effect whenever a program sets a background and no explicit colour
//
// Checked from BOTH sources: `theme.css` (what a themed page gets) and the opt-in
// `specialist-tokens.styles.ts` fallbacks (what an unstyled terminal gets). Surface/text references
// remain in the base token sheet. Keeping those sources explicit prevents a future token split from
// turning this into a vacuous zero-entry check.
const baseTokensText = readFileSync(baseTokensPath, 'utf8');
const specialistTokensText = readFileSync(specialistTokensPath, 'utf8');
const fallbackTerminalFg = readSpecialistTokenFallbacks(specialistTokensText, 'terminal-color-');
const fallbackTerminalBg = readSpecialistTokenFallbacks(specialistTokensText, 'terminal-bg-');
const themeTerminalBg = readThemeRamps(themeText, 'terminal-bg-');
const fallbackRaised = readTokenFallbacks(baseTokensText, 'color-surface-raised', 'tokens.styles.ts');
const fallbackText = readTokenFallbacks(baseTokensText, 'color-text', 'tokens.styles.ts');

const terminalCases = [
  ['theme.css foreground', terminal, raisedSurfaces, TEXT_CONTRAST, 'raised surface'],
  [
    'specialist-tokens.styles.ts foreground',
    fallbackTerminalFg,
    {
      light: fallbackRaised.light.get('--lr-color-surface-raised'),
      dark: fallbackRaised.dark.get('--lr-color-surface-raised'),
    },
    TEXT_CONTRAST,
    'raised surface',
  ],
  [
    'theme.css background',
    themeTerminalBg,
    {
      light: readThemeRamps(themeText, 'color-text-normal').light.get('--lr-theme-color-text-normal'),
      dark: readThemeRamps(themeText, 'color-text-normal').dark.get('--lr-theme-color-text-normal'),
    },
    TEXT_CONTRAST,
    'default text',
  ],
  [
    'specialist-tokens.styles.ts background',
    fallbackTerminalBg,
    { light: fallbackText.light.get('--lr-color-text'), dark: fallbackText.dark.get('--lr-color-text') },
    TEXT_CONTRAST,
    'default text',
  ],
];

for (const [label, ramps, references, floor, referenceName] of terminalCases) {
  for (const mode of ['light', 'dark']) {
    const ramp = ramps[mode];
    const reference = references[mode];
    if (!reference) {
      findings.push(`${label}: could not resolve the ${mode} ${referenceName} to measure against`);
      continue;
    }
    // A ramp that parses empty is a gate that passes vacuously. That is precisely the failure this
    // section exists to have caught, so it is an error rather than a silent skip.
    if (ramp.size !== 16) {
      findings.push(`${label}: parsed ${ramp.size} ${mode} entries, expected 16 — the file shape changed`);
      continue;
    }
    for (const [token, value] of ramp) {
      checks += 1;
      const ratio = contrastRatio(value, reference);
      if (ratio < floor) {
        findings.push(`${mode}: ${label} ${token} (${value}) against the ${mode} ${referenceName} ${reference} is ${ratio.toFixed(2)}:1, below WCAG 1.4.3's ${floor}:1`);
      }
    }
  }
}

// `theme.css` and the specialist fallbacks must stay byte-identical: the theme is optional, so
// importing it would otherwise silently change colours that are supposed to be the same.
for (const [label, themeRamp, fallbackRamp, stripPrefix] of [
  ['foreground', terminal, fallbackTerminalFg, '--lr-theme-'],
  ['background', themeTerminalBg, fallbackTerminalBg, '--lr-theme-'],
]) {
  for (const mode of ['light', 'dark']) {
    checks += 1;
    for (const [token, value] of themeRamp[mode]) {
      const mirrored = fallbackRamp[mode].get(token.replace(stripPrefix, '--lr-'));
      if (mirrored !== value) {
        findings.push(
          `${mode}: ANSI ${label} ${token} is ${value} in theme.css but ${mirrored ?? 'absent'} in ` +
            `specialist-tokens.styles.ts — run \`node scripts/generate-terminal-palette.mjs\``,
        );
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
