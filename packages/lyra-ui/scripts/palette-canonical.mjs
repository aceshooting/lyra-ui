import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const srgbToLinear = (value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
export const linearToSrgb = (value) => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

/** Shared OKLCH conversion used by the semantic, chart, and terminal palette solvers. */
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

/** Reduce chroma to fit the sRGB gamut without rotating the requested hue. */
export function toSrgbHex({ L, C, H }) {
  let chroma = C;
  for (let i = 0; i < 200; i += 1) {
    const rgb = oklchToRgb({ L, C: chroma, H });
    if (rgb.every((value) => value >= -0.0001 && value <= 1.0001)) {
      return `#${rgb.map((value) => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, '0')).join('')}`;
    }
    chroma *= 0.98;
  }
  return '#000000';
}

/** Palette solvers read authored reference colors, never another generator's output. */
export function readCanonicalPalette(packageDir) {
  return JSON.parse(readFileSync(join(packageDir, 'tokens/canonical-tokens.json'), 'utf8')).tokens;
}

export function canonicalPaletteColor(tokens, name, mode) {
  const token = tokens[name];
  const value = token?.values?.[mode] ?? token?.values?.light;
  if (token?.scope !== 'theme-input' || !/^#[a-f0-9]{6}$/i.test(value ?? '')) {
    throw new Error(`${name}: canonical ${mode} palette reference must be an opaque six-digit theme color`);
  }
  return value;
}

/** Canonical values also feed style/design exports; a solver cannot silently diverge from them. */
export function assertCanonicalPalette(tokens, valuesByMode) {
  for (const [mode, values] of Object.entries(valuesByMode)) {
    for (const [name, expected] of Object.entries(values)) {
      const actual = canonicalPaletteColor(tokens, name, mode);
      if (actual !== expected) {
        throw new Error(`${name}: solved ${mode} palette value ${expected} differs from canonical ${actual}; ` +
          'update tokens/canonical-tokens.json with the intentional palette change before regenerating');
      }
    }
  }
}
