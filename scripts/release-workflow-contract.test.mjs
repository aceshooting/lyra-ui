import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

test('release checkouts bind directly to the main dispatch commit before using dependency caches', () => {
  const workflow = read('.github/workflows/release.yml');
  const plan = workflow.slice(workflow.indexOf('\n  plan:\n'), workflow.indexOf('\n  pack:\n'));
  const pack = workflow.slice(workflow.indexOf('\n  pack:\n'), workflow.indexOf('\n  release:\n'));
  const release = workflow.slice(workflow.indexOf('\n  release:\n'));

  assert.match(plan, /if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(plan, /"\$GITHUB_REF" != "refs\/heads\/main"/);
  assert.match(plan, /echo "sha=\$GITHUB_SHA" >> "\$GITHUB_OUTPUT"/);
  assert.match(plan, /sha: \$\{\{ steps\.source\.outputs\.sha \}\}/);
  assert.match(plan, /SHA: \$\{\{ steps\.source\.outputs\.sha \}\}/);
  assert.match(pack, /needs: plan/);
  assert.doesNotMatch(pack, /\bif:/);
  for (const job of [plan, pack]) {
    const checkouts = [...job.matchAll(/uses: actions\/checkout@[^\n]+\n\s+with:\n([\s\S]*?)(?=\n\s{6}-|$)/g)];
    assert.equal(checkouts.length, 1);
    assert.match(checkouts[0][1], /ref: \$\{\{ github\.sha \}\}/);
    assert.match(checkouts[0][1], /persist-credentials: false/);
    assert.doesNotMatch(job, /contents: write|actions: write|id-token: write/);
  }
  assert.match(release, /needs: \[plan, pack\]/);
  assert.match(release, /SHA: \$\{\{ needs\.plan\.outputs\.sha \}\}/);
  assert.doesNotMatch(release, /actions\/checkout@|cache:|pnpm |scripts\//);
});

test('publish and recovery signing share one credential-free verification workflow', () => {
  const reusable = read('.github/workflows/release-verification.yml');
  const publish = read('.github/workflows/publish.yml');
  const sign = read('.github/workflows/sign-release.yml');

  for (const caller of [publish, sign]) {
    assert.match(
      caller,
      /verify:\n\s+uses: \.\/\.github\/workflows\/release-verification\.yml/
    );
    assert.match(caller, /tag: \$\{\{/);
    const protectedStart = Math.max(
      caller.indexOf('\n  publish:\n'),
      caller.indexOf('\n  sign:\n')
    );
    assert.ok(protectedStart > 0);
    const preProtected = caller.slice(0, protectedStart);
    assert.doesNotMatch(
      preProtected,
      /release-integrity\.mjs|pnpm install|actions\/checkout@/
    );
  }

  assert.match(reusable, /workflow_call:/);
  assert.match(reusable, /tag_sha:[\s\S]*tarball_sha256:/);
  assert.match(reusable, /permissions:\n\s+contents: read/);
  assert.match(reusable, /actions: read/);
  assert.match(reusable, /checks: read/);
  assert.doesNotMatch(
    reusable,
    /contents: write|id-token: write|attestations: write|environment:/
  );
  assert.match(
    reusable,
    /wait-ci[\s\S]*wait-test-all-browsers[\s\S]*wait-full-engine[\s\S]*compare-rebuild/
  );
  assert.match(reusable, /actions\/upload-artifact@/);
});
