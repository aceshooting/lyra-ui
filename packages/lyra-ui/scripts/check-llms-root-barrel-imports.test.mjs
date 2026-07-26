#!/usr/bin/env node
// Standalone test for scripts/check-llms-root-barrel-imports.mjs -- plain `node:assert`, not wired
// into the wtr suite (this checker reads markdown text, it does not render components). Run
// directly: `node scripts/check-llms-root-barrel-imports.test.mjs`.

import assert from 'node:assert/strict';
import { checkRootBarrelImports, tsJsCodeBlocks } from './check-llms-root-barrel-imports.mjs';

// Quiet by default (it runs inside the `pnpm lint` contract-policy chain); `--verbose` prints the
// per-case lines.
const verbose = process.argv.includes('--verbose');
let failures = 0;
let passes = 0;
function test(name, fn) {
  try {
    fn();
    passes += 1;
    if (verbose) console.log(`ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(err instanceof Error ? err.stack : err);
  }
}

const check = (text) => checkRootBarrelImports('fixture.md', text);

// --- the bug: a bare root-barrel import in a copy-pasteable example -----------------------------

test('flags a static `from` import of the bare root barrel inside a ```ts fence', () => {
  const text = [
    '## `lr-select`',
    '',
    '```ts',
    "import { LyraSelect } from '@aceshooting/lyra-ui';",
    '```',
    '',
  ].join('\n');
  const findings = check(text);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /fixture\.md:4/);
  assert.match(findings[0], /bare root barrel/);
  assert.match(findings[0], /from '@aceshooting\/lyra-ui'/);
});

test('flags the same import inside a ```js fence, double-quoted', () => {
  const text = ['```js', 'import { LyraSelect } from "@aceshooting/lyra-ui";', '```'].join('\n');
  const findings = check(text);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /fixture\.md:2/);
});

test('flags a dynamic import() of the bare root barrel', () => {
  const text = ['```ts', "const mod = await import('@aceshooting/lyra-ui');", '```'].join('\n');
  const findings = check(text);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /import\('@aceshooting\/lyra-ui'\)/);
});

test('flags a re-export `export ... from` of the bare root barrel', () => {
  const text = ["```ts", "export { LyraSelect } from '@aceshooting/lyra-ui';", '```'].join('\n');
  assert.equal(check(text).length, 1);
});

test('flags every offending import and reports each one on its own line', () => {
  const text = [
    '```ts',
    "import { LyraSelect } from '@aceshooting/lyra-ui';",
    "import { LyraChip } from '@aceshooting/lyra-ui';",
    '```',
  ].join('\n');
  const findings = check(text);
  assert.equal(findings.length, 2);
  assert.match(findings[0], /fixture\.md:2/);
  assert.match(findings[1], /fixture\.md:3/);
});

// --- the correct shapes: must NOT be flagged -----------------------------------------------------

test('does NOT flag a granular subpath import', () => {
  const text = [
    '```ts',
    "import { LyraSelect } from '@aceshooting/lyra-ui/components/forms/select/select.js';",
    '```',
  ].join('\n');
  assert.deepEqual(check(text), []);
});

test('does NOT flag a different package that merely shares the @aceshooting scope', () => {
  const text = ['```ts', "import { Flag } from '@aceshooting/lyra-flags';", '```'].join('\n');
  assert.deepEqual(check(text), []);
});

test('does NOT flag a bare-root mention in prose or an inline code span', () => {
  const text = [
    'Install `@aceshooting/lyra-ui` and import the component you need from a subpath -- never',
    "the bare `@aceshooting/lyra-ui` package root.",
    '',
    '```bash',
    'pnpm add @aceshooting/lyra-ui',
    '```',
  ].join('\n');
  assert.deepEqual(check(text), []);
});

test('does NOT flag a bare-root import shown inside a ```bash or ```html fence', () => {
  const text = [
    '```html',
    "<!-- from '@aceshooting/lyra-ui' would be wrong here too, but this is not a ts/js fence -->",
    '```',
  ].join('\n');
  assert.deepEqual(check(text), []);
});

test('does NOT flag an unrelated import inside a ```ts fence', () => {
  const text = ["```ts", "import { html } from 'lit';", '```'].join('\n');
  assert.deepEqual(check(text), []);
});

test('does NOT flag a subpath even when it is the theme or localization entry', () => {
  const text = [
    '```ts',
    "import { setLyraTheme } from '@aceshooting/lyra-ui/theme.js';",
    "import { registerLyraLocale } from '@aceshooting/lyra-ui/localization.js';",
    '```',
  ].join('\n');
  assert.deepEqual(check(text), []);
});

// --- tsJsCodeBlocks: the fence-scanning primitive ------------------------------------------------

test('tsJsCodeBlocks finds only ts/js fences, not html/css/bash/plain ones', () => {
  const text = [
    '```html',
    '<div></div>',
    '```',
    '',
    '```ts',
    'const x = 1;',
    '```',
    '',
    '```',
    'plain fence',
    '```',
    '',
    '```js',
    'const y = 2;',
    '```',
  ].join('\n');
  const blocks = tsJsCodeBlocks(text);
  assert.equal(blocks.length, 2);
  assert.equal(text.slice(blocks[0].start, blocks[0].end).trim(), 'const x = 1;');
  assert.equal(text.slice(blocks[1].start, blocks[1].end).trim(), 'const y = 2;');
});

test('tsJsCodeBlocks is case-insensitive on the language tag', () => {
  const text = ['```TS', "import '@aceshooting/lyra-ui';", '```'].join('\n');
  assert.equal(tsJsCodeBlocks(text).length, 1);
});

if (failures > 0) {
  console.error(`${failures} llms-root-barrel-imports checker test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`Root-barrel import checker self-test passed (${passes} cases).`);
}
