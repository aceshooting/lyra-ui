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

function commandIndexAfter(source, command, after = -1) {
  let lineStart = source.indexOf('\n', after + 1);
  while (lineStart >= 0) {
    const lineEnd = source.indexOf('\n', lineStart + 1);
    const line = source.slice(lineStart + 1, lineEnd < 0 ? undefined : lineEnd).trim();
    if (line === command) return lineStart;
    lineStart = lineEnd;
  }
  assert.fail(`publish.sh must run ${command} after its required predecessor`);
}

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

test('publish.sh pins the exact Node patch and ends every pack lifecycle with built quality evidence', () => {
  const rootIndex = publishScript.indexOf('\ncd "$ROOT_DIR"\n');
  assert.ok(rootIndex >= 0, 'publish.sh must enter the repository root before release work');
  const exactNodeIndex = commandIndexAfter(
    publishScript,
    'node scripts/check-node-version.mjs',
    rootIndex,
  );
  const packageDiscoveryIndex = publishScript.indexOf('\nfor d in packages/*/;', exactNodeIndex + 1);
  assert.ok(
    packageDiscoveryIndex > exactNodeIndex,
    'publish.sh must reject a mismatched Node before reading workspace manifests',
  );

  const packageWriterIndex = commandIndexAfter(
    publishScript,
    './package.sh',
    exactNodeIndex,
  );
  const finalBuildIndex = commandIndexAfter(
    publishScript,
    'pnpm --filter @aceshooting/lyra-ui build',
    packageWriterIndex,
  );
  const finalMeasurementIndex = commandIndexAfter(
    publishScript,
    'pnpm --filter @aceshooting/lyra-ui component-quality',
    finalBuildIndex,
  );
  const finalBuiltCheckIndex = commandIndexAfter(
    publishScript,
    'pnpm --filter @aceshooting/lyra-ui check:component-quality:built',
    finalMeasurementIndex,
  );
  const packIndex = publishScript.indexOf('(cd "$dir" && pnpm pack)', finalBuiltCheckIndex + 1);
  assert.ok(packIndex > finalBuiltCheckIndex, 'tarballs must be created only after final quality');
  const postPackCheck = 'pnpm --filter "$name" --if-present run check:component-quality:built';
  assert.ok(
    publishScript.indexOf(postPackCheck, packIndex + 1) > packIndex,
    'each pack lifecycle must finish with a built component-quality measurement check',
  );
});

test('publish.sh keeps every deliberate --upgrade-deps output in its preview, abort guidance, and staging handoff', () => {
  const expectedPaths = [
    'package.json',
    'pnpm-lock.yaml',
    'packages/*/package.json',
    'AGENTS.md',
    'CONTRIBUTING.md',
    'docs/agents/ci-and-gates.md',
    'scripts/peer-compatibility-profiles.json',
  ];
  const handoffDeclaration = publishScript.match(
    /UPGRADE_DEPS_HANDOFF_PATHS=\((?<paths>[\s\S]*?)\n\)/,
  );
  assert.ok(
    handoffDeclaration?.groups?.paths,
    'publish.sh must name the complete deliberate --upgrade-deps handoff set once',
  );
  const declaredPaths = handoffDeclaration.groups.paths
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  assert.deepEqual(
    declaredPaths,
    expectedPaths,
    'the --upgrade-deps handoff set must have exactly the deliberate writable outputs',
  );
  assert.match(
    publishScript,
    /git --no-pager diff -- "\$\{UPGRADE_DEPS_HANDOFF_PATHS\[@\]\}"/,
    'the dependency-upgrade preview must show the complete handoff set',
  );
  assert.match(
    publishScript,
    /print_upgrade_deps_revert_command/,
    'an aborted dependency upgrade must print a synchronized recovery command',
  );
  assert.match(
    publishScript,
    /git add -- "\$\{UPGRADE_DEPS_HANDOFF_PATHS\[@\]\}"/,
    'the release commit must stage the complete deliberate upgrade-output set',
  );
});
