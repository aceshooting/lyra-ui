#!/usr/bin/env node

import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'lyra-blank-numeric-'));

try {
  const scriptsDir = path.join(fixtureRoot, 'scripts');
  const componentsDir = path.join(fixtureRoot, 'src', 'components');
  mkdirSync(path.join(scriptsDir, 'lib'), { recursive: true });
  mkdirSync(componentsDir, { recursive: true });
  mkdirSync(path.join(fixtureRoot, 'src', 'internal'), { recursive: true });
  copyFileSync(
    fileURLToPath(new URL('./check-blank-numeric-attributes.mjs', import.meta.url)),
    path.join(scriptsDir, 'check-blank-numeric-attributes.mjs'),
  );
  copyFileSync(
    fileURLToPath(new URL('./lib/fs-walk.mjs', import.meta.url)),
    path.join(scriptsDir, 'lib', 'fs-walk.mjs'),
  );
  const run = () =>
    spawnSync(process.execPath, [path.join(scriptsDir, 'check-blank-numeric-attributes.mjs')], {
      cwd: fixtureRoot,
      encoding: 'utf8',
    });

  writeFileSync(
    path.join(componentsDir, 'safe.ts'),
    [
      "import { blankNumberConverter, declaredDefaultConverter } from '../internal/converters.js';",
      'const optionalDigits = blankNumberConverter(undefined);',
      'export class Safe {',
      '  @property({ type: Number, converter: blankNumberConverter(5) }) a = 5;',
      '  @property({ type: Number, converter: declaredDefaultConverter(6) }) b = 6;',
      '  @property({ type: Number, converter: optionalDigits }) c?: number;',
      '  @property({ type: Number, attribute: false }) d = 1;',
      '  // blank-number-exempt: zero is the documented blank meaning',
      '  @property({ type: Number }) e = 0;',
      '  static properties = { f: { type: Number, converter: blankNumberConverter(null) } };',
      '}',
      '',
    ].join('\n'),
  );
  let result = run();
  assert.equal(result.status, 0, `blank-safe declarations must pass:\n${result.stderr}`);
  assert.match(result.stdout, /exempt: src[/\\]components[/\\]safe\.ts:9/u);

  writeFileSync(
    path.join(componentsDir, 'unsafe.ts'),
    [
      'const parse = (value) => Number(value);',
      'export class Unsafe {',
      "  @property({ type: Number, attribute: 'max-rows' }) maxRows = 10;",
      '  @property({ type: Number, converter: parse }) other = 3;',
      '  static override properties = { count: { type: Number } };',
      '}',
      '',
    ].join('\n'),
  );
  result = run();
  assert.notEqual(result.status, 0, 'a numeric attribute without a blank-safe converter must fail');
  for (const line of [3, 4, 5]) {
    assert.match(result.stderr, new RegExp(`unsafe\\.ts:${line}\\b`, 'u'), `line ${line} is reported`);
  }
  assert.doesNotMatch(result.stderr, /[/\\]safe\.ts:/u, 'the blank-safe file stays clean');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('Blank numeric attribute checker self-test passed.');
