import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
