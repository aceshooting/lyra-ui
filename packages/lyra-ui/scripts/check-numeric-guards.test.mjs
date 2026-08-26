#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(
  new URL('./check-numeric-guards.mjs', import.meta.url)
);
const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'lyra-numeric-guards-'));

try {
  const scriptsDir = path.join(fixtureRoot, 'scripts');
  const componentsDir = path.join(fixtureRoot, 'src', 'components');
  const internalDir = path.join(fixtureRoot, 'src', 'internal');
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(componentsDir, { recursive: true });
  mkdirSync(internalDir, { recursive: true });
  copyFileSync(scriptPath, path.join(scriptsDir, 'check-numeric-guards.mjs'));
  writeFileSync(
    path.join(internalDir, 'unguarded.ts'),
    [
      "import { property } from 'lit/decorators.js';",
      'export class InternalFixture {',
      '  @property({ type: Number }) count = 0;',
      '}',
      '',
    ].join('\n')
  );

  const result = spawnSync(
    process.execPath,
    [path.join(scriptsDir, 'check-numeric-guards.mjs')],
    { cwd: fixtureRoot, encoding: 'utf8' }
  );
  assert.notEqual(
    result.status,
    0,
    'an unguarded internal numeric property must fail the checker'
  );
  assert.match(
    result.stderr,
    /src[/\\]internal[/\\]unguarded\.ts/u,
    'the finding identifies the internal helper that owns the property'
  );
  assert.match(
    result.stdout,
    /component and internal source files/u,
    'the accounting explicitly includes both production source roots'
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('Numeric-guard checker self-test passed.');
