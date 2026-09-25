// DOM-free Node validator for the `--lr-theme-*` token-map grammar, built from
// scripts/fixtures/theme-token-grammar.json -- the single source of the constants that
// src/theme/theme.ts copies literally into its runtime and its self-contained bootstrap
// (scripts/theme-token-grammar.test.mjs keeps all three identical).
//
// The preset generator (scripts/generate-theme-presets.mjs) validates every declaration of a
// src/themes/*.css look through this module, so a committed runtime preset can never carry a value
// that the runtime or defineLyraThemePreset() would reject.

import { readFileSync } from 'node:fs';

const fixtureUrl = new URL('./fixtures/theme-token-grammar.json', import.meta.url);

/** The parsed grammar fixture, including its shared accept/reject vectors. */
export const grammar = JSON.parse(readFileSync(fixtureUrl, 'utf8'));

const toRegExp = ({ source, flags }) => new RegExp(source, flags);
const namePattern = toRegExp(grammar.namePattern);
const forbiddenPattern = toRegExp(grammar.forbiddenPattern);
const cssWidePattern = toRegExp(grammar.cssWidePattern);
const allowedFunctions = new Set(grammar.allowedFunctions);
const reservedNames = new Set(grammar.reservedNames);

/** True for a settable `--lr-theme-*` input name (the reserved accent hook excluded). */
export function isLyraThemeTokenName(name) {
  return typeof name === 'string'
    && name.length <= grammar.nameMaxLength
    && namePattern.test(name)
    && !reservedNames.has(name);
}

/** Parentheses and quotes balance; nothing is interpreted inside a quoted string. */
export function isBalancedCssValue(value) {
  let depth = 0;
  let quote = '';
  for (const character of value) {
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '\'' || character === '"') quote = character;
    else if (character === '(') depth += 1;
    else if (character === ')' && (depth -= 1) < 0) return false;
  }
  return quote === '' && depth === 0;
}

/** A short reason the value is not a safe token value, or `null` when it is. */
export function unsafeValueReason(value) {
  if (typeof value !== 'string') return 'not a string';
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'empty value';
  if (trimmed.length > grammar.valueMaxLength) return `longer than ${grammar.valueMaxLength} characters`;
  const forbidden = trimmed.match(forbiddenPattern);
  if (forbidden) {
    const shown = /[\x00-\x1f\x7f]/.test(forbidden[0]) ? 'a control character or line break' : `"${forbidden[0]}"`;
    return `contains ${shown}`;
  }
  if (cssWidePattern.test(trimmed)) return 'is a CSS-wide keyword';
  for (const match of trimmed.matchAll(toRegExp(grammar.functionTokenPattern))) {
    const name = match[1].toLowerCase();
    if (!allowedFunctions.has(name)) return `uses the function ${name}(), which is not allowed`;
  }
  if (!isBalancedCssValue(trimmed)) return 'has an unclosed or unmatched parenthesis or quote';
  return null;
}

/** True for a value the runtime, the bootstrap and defineLyraThemePreset() all accept. */
export function isSafeLyraThemeTokenValue(value) {
  return unsafeValueReason(value) === null;
}
