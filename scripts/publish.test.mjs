#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publishScript = readFileSync(join(repoRoot, 'scripts/publish.sh'), 'utf8');

/**
 * Isolates the release-completeness verification tail of `publish.sh` (the block starting at
 * `primary_dir=""`, which runs after every tag/GitHub Release already exists) so its exit-code
 * contract can be exercised without running the rest of the interactive release flow (version
 * bumps, git tags, GitHub Releases, npm publish).
 */
function releaseCompletenessBlock() {
  const marker = '\nprimary_dir=""\n';
  const start = publishScript.indexOf(marker);
  assert.ok(
    start >= 0,
    'publish.sh must still define the primary_dir release-completeness block this test isolates'
  );
  return publishScript.slice(start + 1);
}

function runReleaseCompletenessBlock(freshnessExitCode) {
  const tempDir = mkdtempSync(join(tmpdir(), 'lyra-publish-release-completeness-'));
  try {
    mkdirSync(join(tempDir, 'scripts'));
    // Stubs the CLI the real block shells out to (`node scripts/release-integrity.mjs
    // verify-site-freshness ...`) so the test controls only whether the feed check passes.
    writeFileSync(
      join(tempDir, 'scripts/release-integrity.mjs'),
      `process.exit(${freshnessExitCode});\n`
    );
    const harness = [
      'set -euo pipefail',
      'declare -A PKG_NAME',
      'declare -A NEW_VERSION',
      'PKG_NAME[packages/lyra-ui]="@aceshooting/lyra-ui"',
      'NEW_VERSION[packages/lyra-ui]="9.9.9"',
      'RELEASE_DIRS=(packages/lyra-ui)',
      releaseCompletenessBlock(),
    ].join('\n');
    const scriptPath = join(tempDir, 'run.sh');
    writeFileSync(scriptPath, harness);
    return spawnSync('bash', [scriptPath], { cwd: tempDir, encoding: 'utf8' });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test('publish.sh fails closed when the published upgrade feed has not caught up with npm', () => {
  const result = runReleaseCompletenessBlock(1);
  assert.notEqual(
    result.status,
    0,
    'a stale release feed must fail the release script, not silently fall through with exit 0'
  );
  assert.match(result.stderr, /RELEASE INCOMPLETE/);
});

test('publish.sh still exits zero once the published upgrade feed agrees with npm', () => {
  const result = runReleaseCompletenessBlock(0);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Release complete/);
});
