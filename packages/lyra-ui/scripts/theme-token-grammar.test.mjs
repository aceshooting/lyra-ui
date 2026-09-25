// Grammar identity for the `--lr-theme-*` token map. scripts/fixtures/theme-token-grammar.json is
// the single source; src/theme/theme.ts carries two literal copies (the module runtime, and the
// self-contained no-flash bootstrap, which cannot import anything) and scripts/theme-token-grammar.mjs
// builds the generator's validator from the fixture. This test fails the moment any copy drifts,
// and pins the mode-default reference colours to theme.css.
//
// Run: node --test scripts/theme-token-grammar.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  grammar,
  isBalancedCssValue,
  isLyraThemeTokenName,
  isSafeLyraThemeTokenValue,
  unsafeValueReason,
} from './theme-token-grammar.mjs';

const themeSource = readFileSync(new URL('../src/theme/theme.ts', import.meta.url), 'utf8');
const themeCss = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');

const bootstrapStart = themeSource.indexOf('function applyStoredThemeBeforePaint(');
const bootstrapEnd = themeSource.indexOf('\n}\n', bootstrapStart);
const regions = {
  runtime: themeSource.slice(0, bootstrapStart),
  bootstrap: themeSource.slice(bootstrapStart, bootstrapEnd),
};

const occurrences = (haystack, needle) => haystack.split(needle).length - 1;
const literal = ({ source, flags }) => `/${source}/${flags}`;

test('both theme.ts regions exist', () => {
  assert.ok(bootstrapStart > 0, 'applyStoredThemeBeforePaint must exist in theme.ts');
  assert.ok(bootstrapEnd > bootstrapStart, 'the bootstrap function body must be found');
});

for (const [region, text] of Object.entries(regions)) {
  const numeric = region === 'runtime'
    ? {
      TOKEN_NAME_MAX_LENGTH: grammar.nameMaxLength,
      TOKEN_ENTRY_MAX: grammar.entryMax,
      TOKEN_SYNTHESIZED_MAX: grammar.synthesizedMax,
      TOKEN_VALUE_MAX_LENGTH: grammar.valueMaxLength,
    }
    : {
      tokenNameMaxLength: grammar.nameMaxLength,
      tokenEntryMax: grammar.entryMax,
      tokenSynthesizedMax: grammar.synthesizedMax,
      tokenValueMaxLength: grammar.valueMaxLength,
    };

  test(`(a) the ${region} copy carries every grammar constant exactly once`, () => {
    for (const key of ['namePattern', 'forbiddenPattern', 'cssWidePattern', 'functionTokenPattern']) {
      assert.equal(occurrences(text, literal(grammar[key])), 1, `${region}: ${key} ${literal(grammar[key])}`);
    }
    assert.equal(occurrences(text, `'${grammar.allowedFunctions.join(' ')}'`), 1, `${region}: allowedFunctions`);
    for (const [name, value] of Object.entries(numeric)) {
      assert.equal(occurrences(text, `const ${name} = ${value};`), 1, `${region}: ${name} = ${value}`);
    }
    for (const reserved of grammar.reservedNames) {
      assert.ok(text.includes(`'${reserved}'`), `${region}: reserved name ${reserved}`);
    }
  });

  test(`(b) the ${region} copy carries the mode-default references`, () => {
    for (const mode of ['light', 'dark']) {
      const defaults = grammar.modeDefaults[mode];
      const expected = `${mode}: { surface: [${defaults.surface.join(', ')}], raised: [${defaults.raised.join(', ')}], text: [${defaults.text.join(', ')}], overlayStrongAlpha: ${defaults.overlayStrongAlpha} }`;
      assert.equal(occurrences(text, expected), 1, `${region}: ${expected}`);
    }
  });
}

test('(b) the fixture mode defaults equal theme.css', () => {
  // The same line-anchored light/dark split scripts/check-contrast.mjs uses: theme.css mentions
  // .lr-dark in prose too, so a substring split would hand the light values back for both modes.
  const lines = themeCss.split('\n');
  const darkStart = lines.findIndex((line) => /^\s*\.lr-dark\s*,?\s*$/.test(line));
  assert.ok(darkStart > 0, 'theme.css must have a .lr-dark selector line');
  const blocks = { light: lines.slice(0, darkStart).join('\n'), dark: lines.slice(darkStart).join('\n') };
  const hex = (block, name) => {
    const value = block.match(new RegExp(`--lr-theme-${name}:\\s*#([0-9a-f]{6})`, 'i'))?.[1];
    assert.ok(value, `theme.css must declare --lr-theme-${name} as a six-digit hex colour`);
    return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
  };
  for (const mode of ['light', 'dark']) {
    const defaults = grammar.modeDefaults[mode];
    assert.deepEqual(defaults.surface, hex(blocks[mode], 'color-surface-default'), `${mode} surface`);
    assert.deepEqual(defaults.raised, hex(blocks[mode], 'color-surface-raised'), `${mode} raised`);
    assert.deepEqual(defaults.text, hex(blocks[mode], 'color-text-normal'), `${mode} text`);
    const overlay = blocks[mode].match(/--lr-theme-color-overlay-strong:\s*rgb\(0 0 0 \/ ([0-9.]+)\)/)?.[1];
    assert.equal(Number(overlay), defaults.overlayStrongAlpha, `${mode} overlay-strong alpha`);
  }
});

test('(c) the Node validator accepts every accept vector and rejects every reject vector', () => {
  assert.ok(grammar.names.accept.length > 0 && grammar.names.reject.length > 0);
  assert.ok(grammar.values.accept.length > 0 && grammar.values.reject.length > 0);
  for (const name of grammar.names.accept) assert.equal(isLyraThemeTokenName(name), true, name);
  for (const name of grammar.names.reject) assert.equal(isLyraThemeTokenName(name), false, name);
  for (const value of grammar.values.accept) {
    assert.equal(isSafeLyraThemeTokenValue(value), true, `${JSON.stringify(value)}: ${unsafeValueReason(value)}`);
  }
  for (const value of grammar.values.reject) {
    assert.equal(isSafeLyraThemeTokenValue(value), false, JSON.stringify(value));
    assert.equal(typeof unsafeValueReason(value), 'string');
  }
  for (const value of grammar.unbalanced) assert.equal(isBalancedCssValue(value), false, JSON.stringify(value));
  assert.equal(isSafeLyraThemeTokenValue(42), false);
});

test('(c) the fixture names the entry and ownership caps the runtime relies on', () => {
  assert.equal(grammar.entryMax + grammar.synthesizedMax, 528);
  // 15 on-* partners (5 roles x 3 tiers) plus on-strong-overlay.
  assert.equal(grammar.synthesizedMax, 5 * 3 + 1);
});

test('(d) theme.ts contains no raw U+2028 or U+2029', () => {
  assert.equal(themeSource.includes(String.fromCharCode(0x2028)), false);
  assert.equal(themeSource.includes(String.fromCharCode(0x2029)), false);
});
