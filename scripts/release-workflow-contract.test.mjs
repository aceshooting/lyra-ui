import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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

test('first Docs publication uses a protected, provenance-bearing token path only for an absent package', () => {
  const release = read('.github/workflows/release.yml');
  const publish = read('.github/workflows/publish.yml');
  const plan = release.slice(release.indexOf('\n  plan:\n'), release.indexOf('\n  pack:\n'));
  const dispatch = release.slice(release.indexOf('      - name: Dispatch npm publish for each tag'));
  const protectedJob = publish.slice(publish.indexOf('\n  publish:\n'));
  const eligibility = protectedJob.slice(
    protectedJob.indexOf('      - name: Require an unpublished Docs package for bootstrap after approval'),
    protectedJob.indexOf('      - name: Generate release provenance'),
  );
  const normalPublish = protectedJob.slice(
    protectedJob.indexOf('      - name: Publish to npm'),
    protectedJob.indexOf('      - name: Bootstrap first Docs package with npm provenance'),
  );
  const bootstrapPublish = protectedJob.slice(
    protectedJob.indexOf('      - name: Bootstrap first Docs package with npm provenance'),
  );

  assert.match(release, /first_package_bootstrap:\n\s+description: [^\n]+\n\s+required: false\n\s+type: boolean\n\s+default: false/u);
  assert.match(publish, /first_package_bootstrap:\n\s+description: [^\n]+\n\s+required: false\n\s+type: boolean\n\s+default: false/u);
  assert.match(plan, /"\$PACKAGE" != lyra-docs \|\| ! "\$TAGS" =~ \^lyra-docs@/u);
  assert.match(plan, /"\$status" != 404/u);
  assert.match(dispatch, /-f first_package_bootstrap=true/u);
  assert.match(eligibility, /"\$GITHUB_EVENT_NAME" != workflow_dispatch \|\| "\$DRY_RUN" == true/u);
  assert.match(eligibility, /! "\$TAG" =~ \^lyra-docs@/u);
  assert.match(eligibility, /"\$status" != 404/u);
  assert.match(normalPublish, /if: \$\{\{ inputs\.first_package_bootstrap != true \}\}/u);
  assert.doesNotMatch(normalPublish, /NODE_AUTH_TOKEN|NPM_BOOTSTRAP_TOKEN|--provenance/u);
  assert.match(bootstrapPublish, /if: \$\{\{ inputs\.first_package_bootstrap == true \}\}/u);
  assert.match(bootstrapPublish, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_BOOTSTRAP_TOKEN \}\}/u);
  assert.match(bootstrapPublish, /"\$status" != 404[\s\S]*npm publish "\$TARBALL" --access public --provenance/u);
  assert.match(bootstrapPublish, /EXPECTED_SHA256:[\s\S]*EXPECTED_TAG_SHA:[\s\S]*git ls-remote --tags[\s\S]*sha256sum/u);
  assert.equal((protectedJob.match(/secrets\.NPM_BOOTSTRAP_TOKEN/gu) ?? []).length, 1);
});

test('both bootstrap eligibility checks fail closed on registry and package ambiguity', () => {
  const stepScript = (source, name) => {
    const marker = `      - name: ${name}\n`;
    const step = source.indexOf(marker);
    assert.ok(step >= 0, `Missing ${name}`);
    const run = source.indexOf('        run: |\n', step);
    const start = run + '        run: |\n'.length;
    assert.ok(run > step, `Missing script for ${name}`);
    const lines = [];
    for (const line of source.slice(start).split('\n')) {
      if (line.startsWith('          ')) lines.push(line.slice(10));
      else if (line === '') lines.push('');
      else break;
    }
    return lines.join('\n');
  };
  const plan = stepScript(read('.github/workflows/release.yml'), 'Require an unpublished Docs package for bootstrap');
  const publish = stepScript(read('.github/workflows/publish.yml'), 'Require an unpublished Docs package for bootstrap after approval');
  const fixture = mkdtempSync(path.join(tmpdir(), 'lyra-docs-bootstrap-'));
  try {
    const curl = path.join(fixture, 'curl');
    writeFileSync(curl, '#!/usr/bin/env bash\nprintf "%s" "$MOCK_REGISTRY_STATUS"\n');
    chmodSync(curl, 0o755);
    const run = (script, vars = {}) => spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixture}:${process.env.PATH}`,
        BOOTSTRAP: 'true',
        DRY_RUN: 'false',
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        MOCK_REGISTRY_STATUS: '404',
        PACKAGE: 'lyra-docs',
        TAG: 'lyra-docs@0.1.1',
        TAGS: 'lyra-docs@0.1.1',
        ...vars,
      },
    });
    for (const script of [plan, publish]) {
      const accepted = run(script);
      assert.equal(accepted.status, 0, accepted.stderr);
      for (const status of ['200', '401', '403', '503', '']) {
        assert.equal(run(script, { MOCK_REGISTRY_STATUS: status }).status, 1, `HTTP ${status || 'empty'} must fail`);
      }
    }
    assert.equal(run(plan, { PACKAGE: 'lyra-ui' }).status, 1);
    assert.equal(run(plan, { TAGS: 'lyra-docs@0.1.1 lyra-ui@25.6.2' }).status, 1);
    assert.equal(run(publish, { TAG: 'lyra-ui@25.6.2' }).status, 1);
    assert.equal(run(publish, { DRY_RUN: 'true' }).status, 1);
    assert.equal(run(publish, { GITHUB_EVENT_NAME: 'release' }).status, 1);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
