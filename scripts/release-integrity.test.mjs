#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collectGitHubPages,
  REQUIRED_CI_JOBS,
  REQUIRED_FULL_ENGINE_JOBS,
  evaluateCiRun,
  evaluateFullEngineRun,
  parseReleaseTag,
  selectReleaseTarball,
  validateAnnotatedTag,
  validateRebuiltTarballBytes,
  validateTarballIdentity,
  validateWorkflowSource,
  waitForSuccessfulCi,
  waitForSuccessfulFullEngine,
} from './release-integrity.mjs';
import { updateReadmeStatusLine } from './update-readme-status.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sha = '0123456789abcdef0123456789abcdef01234567';
const successfulJobs = () =>
  REQUIRED_CI_JOBS.map((name, index) => ({
    id: index + 1,
    name,
    status: 'completed',
    conclusion: 'success',
  }));
const successfulFullEngineJobs = () =>
  REQUIRED_FULL_ENGINE_JOBS.map((name, index) => ({
    id: index + 1,
    name,
    status: 'completed',
    conclusion: 'success',
  }));

test('collects every GitHub API page and fails closed at its page bound', async () => {
  const pages = [
    Array.from({ length: 100 }, (_, index) => index),
    Array.from({ length: 100 }, (_, index) => index + 100),
    [200],
  ];
  const seen = await collectGitHubPages(async (page) => pages[page - 1], {
    pageSize: 100,
    maxPages: 4,
  });
  assert.equal(seen.length, 201);
  assert.equal(seen.at(-1), 200);

  await assert.rejects(
    collectGitHubPages(async () => Array(100).fill('job'), {
      pageSize: 100,
      maxPages: 2,
    }),
    /pagination exceeded 2 pages/,
  );
});

test('requires one successful CI workflow run for the exact release commit and every matrix leg', () => {
  const run = {
    id: 42,
    name: 'CI',
    path: '.github/workflows/ci.yml',
    event: 'push',
    head_branch: 'main',
    head_sha: sha,
    status: 'completed',
    conclusion: 'success',
  };

  assert.deepEqual(evaluateCiRun({ run, jobs: successfulJobs(), sha }), {
    state: 'success',
    message: `CI run 42 passed all ${REQUIRED_CI_JOBS.length} required jobs for ${sha}.`,
  });

  const requiredSampleJob = REQUIRED_CI_JOBS[REQUIRED_CI_JOBS.length - 1];
  const missingRequiredJob = successfulJobs().filter((job) => job.name !== requiredSampleJob);
  assert.deepEqual(evaluateCiRun({ run, jobs: missingRequiredJob, sha }), {
    state: 'failed',
    message: `CI run 42 is missing required job '${requiredSampleJob}'.`,
  });
  assert.equal(
    evaluateCiRun({ run: { ...run, head_sha: 'f'.repeat(40) }, jobs: successfulJobs(), sha }).state,
    'failed',
  );
  assert.equal(
    evaluateCiRun({ run: { ...run, conclusion: 'failure' }, jobs: successfulJobs(), sha }).state,
    'failed',
  );
  assert.equal(
    evaluateCiRun({
      run: { ...run, event: 'pull_request', head_branch: 'feature' },
      jobs: successfulJobs(),
      sha,
    }).state,
    'failed',
  );
  assert.deepEqual(
    evaluateCiRun({
      run,
      jobs: [
        ...successfulJobs(),
        { name: 'new-required-job', status: 'completed', conclusion: 'failure' },
      ],
      sha,
    }),
    {
      state: 'failed',
      message: "CI run 42 job 'new-required-job' is completed/failure.",
    },
  );
});

test('requires one successful full-engine run for the exact release commit and all eight shards', () => {
  const run = {
    id: 84,
    name: 'Full browser-engine suite',
    path: '.github/workflows/full-engine.yml',
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: sha,
    status: 'completed',
    conclusion: 'success',
  };

  assert.deepEqual(evaluateFullEngineRun({ run, jobs: successfulFullEngineJobs(), sha }), {
    state: 'success',
    message: `Full browser-engine suite run 84 passed all ${REQUIRED_FULL_ENGINE_JOBS.length} required jobs for ${sha}.`,
  });

  const missingShard = successfulFullEngineJobs().filter(
    (job) => job.name !== 'webkit / shard 4/4',
  );
  assert.deepEqual(evaluateFullEngineRun({ run, jobs: missingShard, sha }), {
    state: 'failed',
    message: "Full browser-engine suite run 84 is missing required job 'webkit / shard 4/4'.",
  });
  assert.equal(
    evaluateFullEngineRun({
      run: { ...run, head_sha: 'f'.repeat(40) },
      jobs: successfulFullEngineJobs(),
      sha,
    }).state,
    'failed',
  );
  assert.equal(
    evaluateFullEngineRun({
      run: { ...run, event: 'schedule' },
      jobs: successfulFullEngineJobs(),
      sha,
    }).state,
    'failed',
  );
});

test('waits for a pending exact-SHA CI run without treating the publish check as a dependency', async () => {
  let calls = 0;
  const pendingRun = {
    id: 42,
    name: 'CI',
    path: '.github/workflows/ci.yml',
    event: 'push',
    head_branch: 'main',
    head_sha: sha,
    status: 'in_progress',
    conclusion: null,
  };
  const result = await waitForSuccessfulCi({
    sha,
    timeoutMs: 100,
    pollMs: 1,
    listRuns: async () => {
      calls += 1;
      return [{ ...pendingRun, ...(calls > 1 ? { status: 'completed', conclusion: 'success' } : {}) }];
    },
    listJobs: async () => successfulJobs(),
    delay: async () => {},
    now: (() => {
      let value = 0;
      return () => value++;
    })(),
  });

  assert.equal(result.run.id, 42);
  assert.equal(calls, 2);
});

test('times out when exact-SHA CI never completes', async () => {
  await assert.rejects(
    waitForSuccessfulCi({
      sha,
      timeoutMs: 2,
      pollMs: 1,
      listRuns: async () => [{
        id: 9,
        name: 'CI',
        path: '.github/workflows/ci.yml',
        event: 'push',
        head_branch: 'main',
        head_sha: sha,
        status: 'queued',
        conclusion: null,
      }],
      listJobs: async () => [],
      delay: async () => {},
      now: (() => {
        let value = 0;
        return () => value++;
      })(),
    }),
    /Timed out waiting for a successful CI run/,
  );
});

test('waits for a successful exact-SHA full-engine run', async () => {
  const run = {
    id: 84,
    name: 'Full browser-engine suite',
    path: '.github/workflows/full-engine.yml',
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: sha,
    status: 'completed',
    conclusion: 'success',
  };
  const result = await waitForSuccessfulFullEngine({
    sha,
    listRuns: async () => [run],
    listJobs: async () => successfulFullEngineJobs(),
    delay: async () => {},
  });
  assert.equal(result.run.id, 84);
});

test('resolves only supported release tags', () => {
  assert.deepEqual(parseReleaseTag('lyra-ui@8.1.0'), {
    tag: 'lyra-ui@8.1.0',
    directory: 'packages/lyra-ui',
    packageName: '@aceshooting/lyra-ui',
    version: '8.1.0',
  });
  assert.deepEqual(parseReleaseTag('lyra-flags@1.4.1'), {
    tag: 'lyra-flags@1.4.1',
    directory: 'packages/lyra-flags',
    packageName: '@aceshooting/lyra-flags',
    version: '1.4.1',
  });
  assert.throws(() => parseReleaseTag('other@1.0.0'), /Unsupported release tag/);
  assert.throws(() => parseReleaseTag('lyra-ui@8'), /Unsupported release tag/);
  assert.throws(() => parseReleaseTag('lyra-ui@8.1.0-beta.1'), /stable/);
  assert.throws(() => parseReleaseTag('lyra-ui@8.1.0+rebuild.1'), /stable/);
});

test('binds privileged workflow context to the requested peeled tag', () => {
  assert.deepEqual(
    validateWorkflowSource({
      tag: 'lyra-ui@8.1.0',
      eventName: 'workflow_dispatch',
      githubRef: 'refs/tags/lyra-ui@8.1.0',
      githubSha: sha,
      tagCommitSha: sha,
    }),
    {
      tag: 'lyra-ui@8.1.0',
      commitSha: sha,
      ref: 'refs/tags/lyra-ui@8.1.0',
      eventName: 'workflow_dispatch',
    },
  );
  assert.throws(
    () => validateWorkflowSource({
      tag: 'lyra-ui@8.1.0',
      eventName: 'workflow_dispatch',
      githubRef: 'refs/heads/main',
      githubSha: sha,
      tagCommitSha: sha,
    }),
    /Dispatch the workflow with --ref 'lyra-ui@8.1.0'/,
  );
  assert.throws(
    () => validateWorkflowSource({
      tag: 'lyra-ui@8.1.0',
      eventName: 'workflow_dispatch',
      githubRef: 'refs/tags/lyra-ui@8.1.0',
      githubSha: 'f'.repeat(40),
      tagCommitSha: sha,
    }),
    /does not match tag/,
  );
  assert.throws(
    () => validateWorkflowSource({
      tag: 'lyra-ui@8.1.0',
      eventName: 'pull_request',
      githubRef: 'refs/tags/lyra-ui@8.1.0',
      githubSha: sha,
      tagCommitSha: sha,
    }),
    /not permitted/,
  );
});

test('requires an annotated tag whose peeled commit is the checkout', () => {
  assert.deepEqual(
    validateAnnotatedTag({
      tag: 'lyra-ui@8.1.0',
      objectType: 'tag',
      checkoutSha: sha,
      tagCommitSha: sha,
    }),
    { tag: 'lyra-ui@8.1.0', commitSha: sha },
  );
  assert.throws(
    () => validateAnnotatedTag({
      tag: 'lyra-ui@8.1.0',
      objectType: 'commit',
      checkoutSha: sha,
      tagCommitSha: sha,
    }),
    /must be annotated/,
  );
  assert.throws(
    () => validateAnnotatedTag({
      tag: 'lyra-ui@8.1.0',
      objectType: 'tag',
      checkoutSha: sha,
      tagCommitSha: 'f'.repeat(40),
    }),
    /does not match tag/,
  );
});

test('requires exactly one release tarball and verifies its package identity', () => {
  assert.equal(selectReleaseTarball(['/tmp/a.tgz']), '/tmp/a.tgz');
  assert.throws(() => selectReleaseTarball([]), /exactly one/);
  assert.throws(() => selectReleaseTarball(['/tmp/a.tgz', '/tmp/b.tgz']), /exactly one/);

  const expected = parseReleaseTag('lyra-ui@8.1.0');
  assert.deepEqual(
    validateTarballIdentity({ name: '@aceshooting/lyra-ui', version: '8.1.0' }, expected),
    { name: '@aceshooting/lyra-ui', version: '8.1.0' },
  );
  assert.throws(
    () => validateTarballIdentity({ name: '@aceshooting/lyra-flags', version: '8.1.0' }, expected),
    /package name/,
  );
  assert.throws(
    () => validateTarballIdentity({ name: '@aceshooting/lyra-ui', version: '8.0.0' }, expected),
    /package version/,
  );
});

test('requires the downloaded release tarball to byte-match a tagged-source rebuild', () => {
  assert.deepEqual(
    validateRebuiltTarballBytes(Buffer.from('same tarball'), Buffer.from('same tarball')),
    { byteLength: 12 },
  );
  assert.throws(
    () => validateRebuiltTarballBytes(Buffer.from('release'), Buffer.from('rebuilt')),
    /does not byte-match the exact tagged-source rebuild/,
  );
  assert.throws(
    () => validateRebuiltTarballBytes('release', Buffer.from('rebuilt')),
    /requires two Buffer values/,
  );
});

test('updates exactly one narrowly anchored README Status line and fails closed on drift', () => {
  const line =
    '`@aceshooting/lyra-ui` source is versioned at `8.0.0`; `@aceshooting/lyra-flags` source at `2.0.0` — releases.';
  assert.equal(
    updateReadmeStatusLine(line, {
      lyraUiVersion: '8.1.0',
      lyraFlagsVersion: '2.0.1',
    }),
    '`@aceshooting/lyra-ui` source is versioned at `8.1.0`; `@aceshooting/lyra-flags` source at `2.0.1` — releases.',
  );
  assert.throws(
    () => updateReadmeStatusLine('No release status here.', {
      lyraUiVersion: '8.1.0',
      lyraFlagsVersion: '2.0.1',
    }),
    /expected exactly one source-version line, found 0/,
  );
  assert.throws(
    () => updateReadmeStatusLine(`${line}\n${line}`, {
      lyraUiVersion: '8.1.0',
      lyraFlagsVersion: '2.0.1',
    }),
    /expected exactly one source-version line, found 2/,
  );
  assert.throws(
    () => updateReadmeStatusLine(line, {
      lyraUiVersion: 'not-semver',
      lyraFlagsVersion: '2.0.1',
    }),
    /invalid version/,
  );
  assert.throws(
    () => updateReadmeStatusLine(
      '`@aceshooting/lyra-ui` is published at `8.0.0`; `@aceshooting/lyra-flags` at `2.0.0`.',
      { lyraUiVersion: '8.1.0', lyraFlagsVersion: '2.0.1' },
    ),
    /expected exactly one source-version line, found 0/,
  );
  assert.throws(
    () => updateReadmeStatusLine(line, {
      lyraUiVersion: '8.1.0+rebuild.1',
      lyraFlagsVersion: '2.0.1',
    }),
    /invalid version/,
  );
  assert.throws(
    () => updateReadmeStatusLine(line, {
      lyraUiVersion: '8.1.0-beta.1',
      lyraFlagsVersion: '2.0.1',
    }),
    /invalid version/,
  );
});

test('release workflows verify tagged-source bytes without exposing protected credentials', () => {
  const publishWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/publish.yml'),
    'utf8',
  );
  const signWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/sign-release.yml'),
    'utf8',
  );

  const protectedPublish = publishWorkflow.slice(publishWorkflow.indexOf('\n  publish:\n'));
  const protectedSign = signWorkflow.slice(signWorkflow.indexOf('\n  sign:\n'));

  for (const workflow of [publishWorkflow, signWorkflow]) {
    assert.match(workflow, /persist-credentials: false/);
    assert.match(workflow, /validate-workflow-source/);
    assert.match(workflow, /wait-ci/);
    assert.match(workflow, /wait-full-engine/);
    assert.match(workflow, /validate-tarball/);
    assert.match(workflow, /compare-rebuild/);
    assert.match(workflow, /Upload byte-verified tarball/);
    assert.match(workflow, /Download byte-verified tarball/);
    assert.match(workflow, /EXPECTED_SHA256/);
    assert.match(workflow, /tag_sha:/);
    assert.match(workflow, /git ls-remote --tags/);
    assert.match(workflow, /gh release upload "\$TAG" "\$TARBALL"[^\n]+--clobber/);
    assert.match(workflow, /release-roundtrip/);
    assert.match(workflow, /retention-days: 14/);
    assert.match(workflow, /\.sigstore\.json/);
    assert.doesNotMatch(workflow, /\.intoto\.jsonl/);
    assert.ok(workflow.indexOf('compare-rebuild') < workflow.indexOf('actions/upload-artifact@'));
    assert.ok(workflow.indexOf('Rebind release tag and tarball after approval') <
      workflow.indexOf('actions/attest@'));
    assert.ok(workflow.indexOf('Verify transferred artifact digest') < workflow.indexOf('actions/attest@'));
  }

  for (const protectedJob of [protectedPublish, protectedSign]) {
    assert.match(protectedJob, /environment: npm-publish/);
    assert.doesNotMatch(protectedJob, /actions\/checkout@|pnpm\/action-setup|pnpm install/);
    assert.doesNotMatch(protectedJob, /scripts\/release-integrity\.mjs/);
  }

  assert.match(publishWorkflow, /npm publish "\$TARBALL" --access public --dry-run/);
  assert.match(publishWorkflow, /npm publish "\$TARBALL" --access public\n/);
  assert.ok(
    publishWorkflow.indexOf('actions/attest@') < publishWorkflow.indexOf('npm publish "$TARBALL"'),
  );
});

test('release script pins its repository and pushes release refs atomically', () => {
  const publishScript = readFileSync(path.join(repoRoot, 'scripts/publish.sh'), 'utf8');

  assert.match(publishScript, /GH_REPOSITORY="\$GH_ACCOUNT\/lyra-ui"/);
  assert.match(publishScript, /git remote get-url --push --all origin/);
  assert.match(publishScript, /git remote get-url --all origin/);
  assert.match(publishScript, /origin fetch URL/);
  assert.match(publishScript, /git ls-remote --tags origin/);
  assert.match(publishScript, /git push origin "\$release_sha:refs\/heads\/main"/);
  assert.doesNotMatch(publishScript, /git push origin HEAD:/);
  assert.match(
    publishScript,
    /git tag -a "\$\{TAG\[\$dir\]\}" -m "Release \$\{TAG\[\$dir\]\}" "\$release_sha"/,
  );
  assert.match(publishScript, /current_head="\$\(git rev-parse HEAD\^\{commit\}\)"/);
  assert.match(publishScript, /local HEAD moved during exact-commit qualification/);
  assert.match(publishScript, /working tree changed during exact-commit qualification/);
  assert.match(publishScript, /git push --atomic origin "\$\{tag_args\[@\]\}"/);
  assert.match(publishScript, /gh release create[\s\S]*--repo "\$GH_REPOSITORY"/);
  assert.doesNotMatch(publishScript, /git add -A/);
  assert.doesNotMatch(publishScript, /export GH_TOKEN/);
  assert.match(publishScript, /Working tree is not clean/);
  assert.match(publishScript, /pnpm --filter "\$name" --if-present run package-metadata/);
  assert.match(publishScript, /src\/internal\/package-metadata\.ts/);
  assert.match(publishScript, /scripts\/fixtures\/component-metadata\.json/);
  assert.match(publishScript, /scripts\/fixtures\/component-inventory\.json/);
  assert.match(publishScript, /git diff --name-only/);
  assert.match(publishScript, /node scripts\/update-readme-status\.mjs/);
  assert.match(publishScript, /git add README\.md/);
  assert.match(publishScript, /node scripts\/sync-plugin-version\.mjs/);
  assert.match(publishScript, /\.\/package\.sh/);
  assert.match(publishScript, /pnpm skill:check/);
  assert.match(publishScript, /plugins\/lyra-ui\/\.claude-plugin\/plugin\.json/);
  assert.match(publishScript, /plugins\/lyra-ui\/\.codex-plugin\/plugin\.json/);
  assert.match(publishScript, /\.claude-plugin\/marketplace\.json/);
  assert.match(publishScript, /plugins\/lyra-ui\/skills\/lyra-ui\/references/);
  assert.match(publishScript, /skills\/lyra-ui\.skill/);
  assert.match(publishScript, /skills\/compose-lyra-interfaces\.skill/);
  assert.match(publishScript, /git --no-pager diff --stat/);
  assert.match(publishScript, /gh workflow run full-engine\.yml/);
  assert.match(publishScript, /wait-ci/);
  assert.match(publishScript, /wait-full-engine/);
  assert.match(publishScript, /not a stable core semver/);
  assert.match(publishScript, /QUALIFICATION_PASSED/);
  assert.match(publishScript, /Do NOT tag or release this commit/);
  assert.match(publishScript, /custom-elements\.json[\s\S]*llms\.txt[\s\S]*llms-full\.txt/);
  const changedReleaseBlock = publishScript.slice(
    publishScript.indexOf('RELEASE_DIRS=()'),
    publishScript.indexOf('declare -A NEW_VERSION'),
  );
  assert.match(changedReleaseBlock, /for dir in "\$\{PKG_DIRS\[@\]\}"/);
  assert.doesNotMatch(changedReleaseBlock, /for name in "\$\{EFFECTIVE_NAMES\[@\]\}"/);
  assert.match(changedReleaseBlock, /AUTO_EXPANDED_RELEASE_DIRS/);
  assert.match(changedReleaseBlock, /Changesets expanded the release to publishable dependents/);
  assert.match(publishScript, /Changesets auto-expanded dependent/);
  let gateCursor = publishScript.indexOf('pnpm changeset version');
  for (const command of [
    'run package-metadata',
    'run manifest',
    'run component-metadata',
    'run manifest',
    'run lint',
    'run build',
    'run test',
    'run default-string-slices',
    'run framework-types',
    'run design-tokens',
    'run generate-editor-data',
    'run llms',
  ]) {
    const commandIndex = publishScript.indexOf(command, gateCursor + 1);
    assert.ok(commandIndex > gateCursor, `${command} must follow the preceding release gate`);
    gateCursor = commandIndex;
  }
  for (const command of [
    'node scripts/sync-plugin-version.mjs',
    './package.sh',
    'pnpm skill:check',
  ]) {
    const commandIndex = publishScript.indexOf(command, gateCursor + 1);
    assert.ok(commandIndex > gateCursor, `${command} must follow release-time LLM generation`);
    gateCursor = commandIndex;
  }
  const pushMain = publishScript.indexOf('git push origin "$release_sha:refs/heads/main"');
  const dispatch = publishScript.indexOf('gh workflow run full-engine.yml');
  const waitCi = publishScript.indexOf('wait-ci', dispatch);
  const waitFullEngine = publishScript.indexOf('wait-full-engine', waitCi);
  const qualificationDriftGuard = publishScript.indexOf(
    'current_head="$(git rev-parse HEAD^{commit})"',
    waitFullEngine,
  );
  const qualificationStatus = publishScript.indexOf(
    'qualification_status="$(git status --porcelain)"',
    qualificationDriftGuard,
  );
  const qualificationPassed = publishScript.indexOf('QUALIFICATION_PASSED=1', waitFullEngine);
  const tag = publishScript.indexOf('git tag -a', waitFullEngine);
  const pushTags = publishScript.indexOf('git push --atomic origin', tag);
  const release = publishScript.lastIndexOf('gh release create');
  assert.ok(pushMain < dispatch);
  assert.ok(dispatch < waitCi);
  assert.ok(waitCi < waitFullEngine);
  assert.ok(waitFullEngine < qualificationDriftGuard);
  assert.ok(qualificationDriftGuard < qualificationStatus);
  assert.ok(qualificationStatus < qualificationPassed);
  assert.ok(qualificationPassed < tag);
  assert.ok(tag < pushTags);
  assert.ok(pushTags < release);

  const qualificationGuardBlock = publishScript.slice(qualificationDriftGuard, tag);
  assert.match(
    qualificationGuardBlock,
    /qualification_status="\$\(git status --porcelain\)"/,
  );

  const packageExecution = publishScript.slice(
    publishScript.indexOf('pnpm install'),
    publishScript.indexOf('release_sha='),
  );
  assert.doesNotMatch(packageExecution, /GH_TOKEN=/);

  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /`@aceshooting\/lyra-ui` is published at/);
  assert.match(readme, /source is versioned at/);

  const ciWorkflow = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const lintJob = ciWorkflow.slice(ciWorkflow.indexOf('  lint:'), ciWorkflow.indexOf('\n  static-checks:'));
  assert.match(lintJob, /fetch-depth: 0/);
});

test('package lifecycle and root custom-elements metadata are clean-checkout safe', () => {
  const rootPackage = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const lyraPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/package.json'), 'utf8'),
  );

  assert.equal(rootPackage.customElements, 'packages/lyra-ui/custom-elements.json');
  assert.equal(lyraPackage.scripts.pretest, 'pnpm run build');
  assert.match(lyraPackage.scripts.prepack, /^pnpm run package-metadata &&/);
});
