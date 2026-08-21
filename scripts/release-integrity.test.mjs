#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
  evaluateSiteFreshness,
} from './release-integrity.mjs';
import {
  changesetPackagePlan,
  renderChangesetPackagePlan,
} from './changeset-release-plan.mjs';
import { normalizeBrowserInput } from './plan-test-browsers.mjs';
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

test('derives per-file package ownership from validated Changesets status JSON', () => {
  const plan = changesetPackagePlan({
    changesets: [
      {
        id: 'single-quoted-frontmatter',
        releases: [
          { name: '@aceshooting/lyra-ui', type: 'major' },
          { name: '@aceshooting/lyra-flags', type: 'patch' },
        ],
      },
      {
        id: 'flags-only',
        releases: [{ name: '@aceshooting/lyra-flags', type: 'minor' }],
      },
      { id: 'valid-empty-changeset', releases: [] },
    ],
  });

  assert.deepEqual(plan, [
    {
      id: 'single-quoted-frontmatter',
      packages: ['@aceshooting/lyra-ui', '@aceshooting/lyra-flags'],
    },
    { id: 'flags-only', packages: ['@aceshooting/lyra-flags'] },
    { id: 'valid-empty-changeset', packages: [] },
  ]);
  assert.equal(
    renderChangesetPackagePlan(plan),
    'single-quoted-frontmatter\t@aceshooting/lyra-ui @aceshooting/lyra-flags\n' +
      'flags-only\t@aceshooting/lyra-flags\n' +
      'valid-empty-changeset\t',
  );
});

test('fails closed on malformed or ambiguous Changesets status entries', () => {
  assert.throws(() => changesetPackagePlan({}), /no changesets array/u);
  assert.throws(
    () =>
      changesetPackagePlan({
        changesets: [
          { id: 'duplicate', releases: [{ name: '@aceshooting/lyra-ui', type: 'major' }] },
          { id: 'duplicate', releases: [{ name: '@aceshooting/lyra-flags', type: 'patch' }] },
        ],
      }),
    /duplicate id/u,
  );
  assert.throws(
    () =>
      changesetPackagePlan({
        changesets: [
          { id: 'bad-type', releases: [{ name: '@aceshooting/lyra-ui', type: 'breaking' }] },
        ],
      }),
    /invalid release type/u,
  );
});

test('budgets the platform matrix for degraded fresh-runner OS dependency setup', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const platformStart = workflow.indexOf('\n  platform-contracts:');
  const stepsStart = workflow.indexOf('\n    steps:', platformStart);
  assert.ok(
    platformStart >= 0 && stepsStart > platformStart,
    'CI must define the platform-contracts job'
  );
  const platformHeader = workflow.slice(platformStart, stepsStart);
  assert.match(
    platformHeader,
    /timeout-minutes: 30/,
    'platform contracts must budget the observed 15-minute install-deps path before tests begin'
  );
});

test('normalizes the manually dispatched browser matrix through a closed allowlist', () => {
  assert.deepEqual(
    [
      ...normalizeBrowserInput(
        ' chromium,firefox,chrome,edge,safari,chromium '
      ),
    ],
    ['chromium', 'firefox', 'chrome', 'edge', 'safari']
  );

  for (const input of [
    '',
    'chromium,',
    'chromium,,firefox',
    'Chromium',
    'webkit',
    'chromium; touch /tmp/unsafe',
    'chromium,$(touch /tmp/unsafe)',
    'chromium\nfirefox',
  ]) {
    assert.throws(() => normalizeBrowserInput(input), /browser/iu, input);
  }
});

test('keeps workflow-dispatch browser input out of shell source after allowlist validation', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/test-all-browsers.yml'),
    'utf8'
  );
  const planJob = workflow.slice(
    workflow.indexOf('  plan:'),
    workflow.indexOf('\n  test:')
  );
  const testJob = workflow.slice(workflow.indexOf('\n  test:'));

  assert.match(planJob, /BROWSERS_INPUT: \$\{\{ inputs\.browsers \}\}/u);
  assert.match(
    planJob,
    /node scripts\/plan-test-browsers\.mjs >> "\$GITHUB_OUTPUT"/u
  );
  assert.doesNotMatch(planJob, /<<<\s*"\$\{\{ inputs\.browsers \}\}"/u);
  assert.match(testJob, /TEST_BROWSER: \$\{\{ matrix\.browser \}\}/u);
  assert.match(testJob, /--browsers "\$TEST_BROWSER"/u);
  assert.doesNotMatch(testJob, /--browsers\s+"\$\{\{ matrix\.browser \}\}"/u);
});

test('deploys docs from the committed manifest with scoped Pages credentials', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/deploy-docs.yml'),
    'utf8'
  );
  const rootPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const workflowPermissions = workflow.slice(
    workflow.indexOf('\npermissions:'),
    workflow.indexOf('\nconcurrency:')
  );
  const buildJob = workflow.slice(
    workflow.indexOf('  build:'),
    workflow.indexOf('\n  deploy:')
  );
  const deployJob = workflow.slice(workflow.indexOf('\n  deploy:'));

  assert.match(workflowPermissions, /contents: read/u);
  assert.doesNotMatch(workflowPermissions, /pages: write|id-token: write/u);
  assert.doesNotMatch(buildJob, /pages: write|id-token: write/u);
  assert.match(deployJob, /permissions:\n\s+pages: write\n\s+id-token: write/u);
  assert.match(buildJob, /- run: pnpm docs:build/u);
  assert.doesNotMatch(
    buildJob,
    /pnpm --filter @aceshooting\/lyra-ui run manifest(?:\s|$)/u
  );
  assert.match(rootPackage.scripts['docs:build'], /^pnpm manifest:check &&/u);
});

test('root scripts keep canonical docs and policy entrypoints only', () => {
  const rootPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );

  assert.equal(rootPackage.scripts.dev, 'storybook dev -p 6006');
  assert.equal(rootPackage.scripts.docs, rootPackage.scripts.dev);
  assert.equal(rootPackage.scripts.storybook, undefined);
  assert.equal(rootPackage.scripts['build-storybook'], undefined);
  assert.equal(rootPackage.scripts['provenance:check'], undefined);
});

test('full browser sweep scripts remove their temporary lane logs on every exit', () => {
  for (const relativePath of ['scripts/test.sh', 'scripts/test_all_browsers.sh']) {
    const source = readFileSync(path.join(repoRoot, relativePath), 'utf8');
    const tempDirectoryIndex = source.indexOf('LOG_DIR="$(mktemp -d)"');
    const cleanupIndex = source.indexOf('cleanup_logs()');
    const trapIndex = source.indexOf('trap cleanup_logs EXIT');
    const cleanup = source.slice(cleanupIndex, trapIndex);

    assert.ok(
      tempDirectoryIndex >= 0,
      `${relativePath} must create isolated lane logs`
    );
    assert.ok(
      cleanupIndex > tempDirectoryIndex,
      `${relativePath} must define cleanup after mktemp`
    );
    assert.ok(
      trapIndex > cleanupIndex,
      `${relativePath} must install its cleanup trap`
    );
    assert.match(cleanup, /local exit_status=\$\?/u);
    assert.match(cleanup, /trap - EXIT/u);
    assert.match(cleanup, /rm -rf -- "\$LOG_DIR"/u);
    assert.match(cleanup, /exit "\$exit_status"/u);
  }
});

test('runs a checksum-pinned actionlint in CI and the local aggregate', () => {
  const rootPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const workflowCheck = readFileSync(
    path.join(repoRoot, 'scripts/check-workflows.sh'),
    'utf8'
  );
  const ciWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const ciScript = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');

  assert.equal(
    rootPackage.scripts['check:workflows'],
    './scripts/check-workflows.sh'
  );
  assert.match(workflowCheck, /ACTIONLINT_VERSION="1\.7\.12"/u);
  assert.match(
    workflowCheck,
    /ACTIONLINT_SHA256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"/u
  );
  assert.match(workflowCheck, /sha256sum --check/u);
  assert.doesNotMatch(workflowCheck, /releases\/latest|:latest/u);
  assert.match(ciWorkflow, /- run: pnpm check:workflows/u);
  assert.match(
    ciScript,
    /step "workflow syntax and policy"\s+pnpm check:workflows/u
  );
});

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
    /pagination exceeded 2 pages/
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
  const missingRequiredJob = successfulJobs().filter(
    (job) => job.name !== requiredSampleJob
  );
  assert.deepEqual(evaluateCiRun({ run, jobs: missingRequiredJob, sha }), {
    state: 'failed',
    message: `CI run 42 is missing required job '${requiredSampleJob}'.`,
  });
  assert.equal(
    evaluateCiRun({
      run: { ...run, head_sha: 'f'.repeat(40) },
      jobs: successfulJobs(),
      sha,
    }).state,
    'failed'
  );
  assert.equal(
    evaluateCiRun({
      run: { ...run, conclusion: 'failure' },
      jobs: successfulJobs(),
      sha,
    }).state,
    'failed'
  );
  assert.equal(
    evaluateCiRun({
      run: { ...run, event: 'pull_request', head_branch: 'feature' },
      jobs: successfulJobs(),
      sha,
    }).state,
    'failed'
  );
  assert.deepEqual(
    evaluateCiRun({
      run,
      jobs: [
        ...successfulJobs(),
        {
          name: 'new-required-job',
          status: 'completed',
          conclusion: 'failure',
        },
      ],
      sha,
    }),
    {
      state: 'failed',
      message: "CI run 42 job 'new-required-job' is completed/failure.",
    }
  );
});

test('requires one successful full-engine run for the exact release commit and every required shard', () => {
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

  assert.deepEqual(
    evaluateFullEngineRun({ run, jobs: successfulFullEngineJobs(), sha }),
    {
      state: 'success',
      message: `Full browser-engine suite run 84 passed all ${REQUIRED_FULL_ENGINE_JOBS.length} required jobs for ${sha}.`,
    }
  );

  // Derived from the qualification manifest rather than naming a shard literally: the shard count
  // is a matrix knob (4 -> 8 when full-engine.yml was widened), and a hardcoded 'webkit / shard 4/4'
  // silently rots the moment it moves.
  const droppedJob = REQUIRED_FULL_ENGINE_JOBS[REQUIRED_FULL_ENGINE_JOBS.length - 1];
  const missingShard = successfulFullEngineJobs().filter((job) => job.name !== droppedJob);
  assert.deepEqual(evaluateFullEngineRun({ run, jobs: missingShard, sha }), {
    state: 'failed',
    message: `Full browser-engine suite run 84 is missing required job '${droppedJob}'.`,
  });
  assert.equal(
    evaluateFullEngineRun({
      run: { ...run, head_sha: 'f'.repeat(40) },
      jobs: successfulFullEngineJobs(),
      sha,
    }).state,
    'failed'
  );
  assert.equal(
    evaluateFullEngineRun({
      run: { ...run, event: 'schedule' },
      jobs: successfulFullEngineJobs(),
      sha,
    }).state,
    'failed'
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
      return [
        {
          ...pendingRun,
          ...(calls > 1 ? { status: 'completed', conclusion: 'success' } : {}),
        },
      ];
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
      listRuns: async () => [
        {
          id: 9,
          name: 'CI',
          path: '.github/workflows/ci.yml',
          event: 'push',
          head_branch: 'main',
          head_sha: sha,
          status: 'queued',
          conclusion: null,
        },
      ],
      listJobs: async () => [],
      delay: async () => {},
      now: (() => {
        let value = 0;
        return () => value++;
      })(),
    }),
    /Timed out waiting for a successful CI run/
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
  assert.throws(
    () => parseReleaseTag('other@1.0.0'),
    /Unsupported release tag/
  );
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
    }
  );
  assert.throws(
    () =>
      validateWorkflowSource({
        tag: 'lyra-ui@8.1.0',
        eventName: 'workflow_dispatch',
        githubRef: 'refs/heads/main',
        githubSha: sha,
        tagCommitSha: sha,
      }),
    /Dispatch the workflow with --ref 'lyra-ui@8.1.0'/
  );
  assert.throws(
    () =>
      validateWorkflowSource({
        tag: 'lyra-ui@8.1.0',
        eventName: 'workflow_dispatch',
        githubRef: 'refs/tags/lyra-ui@8.1.0',
        githubSha: 'f'.repeat(40),
        tagCommitSha: sha,
      }),
    /does not match tag/
  );
  assert.throws(
    () =>
      validateWorkflowSource({
        tag: 'lyra-ui@8.1.0',
        eventName: 'pull_request',
        githubRef: 'refs/tags/lyra-ui@8.1.0',
        githubSha: sha,
        tagCommitSha: sha,
      }),
    /not permitted/
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
    { tag: 'lyra-ui@8.1.0', commitSha: sha }
  );
  assert.throws(
    () =>
      validateAnnotatedTag({
        tag: 'lyra-ui@8.1.0',
        objectType: 'commit',
        checkoutSha: sha,
        tagCommitSha: sha,
      }),
    /must be annotated/
  );
  assert.throws(
    () =>
      validateAnnotatedTag({
        tag: 'lyra-ui@8.1.0',
        objectType: 'tag',
        checkoutSha: sha,
        tagCommitSha: 'f'.repeat(40),
      }),
    /does not match tag/
  );
});

test('requires exactly one release tarball and verifies its package identity', () => {
  assert.equal(selectReleaseTarball(['/tmp/a.tgz']), '/tmp/a.tgz');
  assert.throws(() => selectReleaseTarball([]), /exactly one/);
  assert.throws(
    () => selectReleaseTarball(['/tmp/a.tgz', '/tmp/b.tgz']),
    /exactly one/
  );

  const expected = parseReleaseTag('lyra-ui@8.1.0');
  assert.deepEqual(
    validateTarballIdentity(
      { name: '@aceshooting/lyra-ui', version: '8.1.0' },
      expected
    ),
    { name: '@aceshooting/lyra-ui', version: '8.1.0' }
  );
  assert.throws(
    () =>
      validateTarballIdentity(
        { name: '@aceshooting/lyra-flags', version: '8.1.0' },
        expected
      ),
    /package name/
  );
  assert.throws(
    () =>
      validateTarballIdentity(
        { name: '@aceshooting/lyra-ui', version: '8.0.0' },
        expected
      ),
    /package version/
  );
});

test('requires the downloaded release tarball to byte-match a tagged-source rebuild', () => {
  assert.deepEqual(
    validateRebuiltTarballBytes(
      Buffer.from('same tarball'),
      Buffer.from('same tarball')
    ),
    { byteLength: 12 }
  );
  assert.throws(
    () =>
      validateRebuiltTarballBytes(
        Buffer.from('release'),
        Buffer.from('rebuilt')
      ),
    /does not byte-match the exact tagged-source rebuild/
  );
  assert.throws(
    () => validateRebuiltTarballBytes('release', Buffer.from('rebuilt')),
    /requires two Buffer values/
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
    '`@aceshooting/lyra-ui` source is versioned at `8.1.0`; `@aceshooting/lyra-flags` source at `2.0.1` — releases.'
  );
  assert.throws(
    () =>
      updateReadmeStatusLine('No release status here.', {
        lyraUiVersion: '8.1.0',
        lyraFlagsVersion: '2.0.1',
      }),
    /expected exactly one source-version line, found 0/
  );
  assert.throws(
    () =>
      updateReadmeStatusLine(`${line}\n${line}`, {
        lyraUiVersion: '8.1.0',
        lyraFlagsVersion: '2.0.1',
      }),
    /expected exactly one source-version line, found 2/
  );
  assert.throws(
    () =>
      updateReadmeStatusLine(line, {
        lyraUiVersion: 'not-semver',
        lyraFlagsVersion: '2.0.1',
      }),
    /invalid version/
  );
  assert.throws(
    () =>
      updateReadmeStatusLine(
        '`@aceshooting/lyra-ui` is published at `8.0.0`; `@aceshooting/lyra-flags` at `2.0.0`.',
        { lyraUiVersion: '8.1.0', lyraFlagsVersion: '2.0.1' }
      ),
    /expected exactly one source-version line, found 0/
  );
  assert.throws(
    () =>
      updateReadmeStatusLine(line, {
        lyraUiVersion: '8.1.0+rebuild.1',
        lyraFlagsVersion: '2.0.1',
      }),
    /invalid version/
  );
  assert.throws(
    () =>
      updateReadmeStatusLine(line, {
        lyraUiVersion: '8.1.0-beta.1',
        lyraFlagsVersion: '2.0.1',
      }),
    /invalid version/
  );
});

test('release workflows verify tagged-source bytes without exposing protected credentials', () => {
  const reusableVerification = readFileSync(
    path.join(repoRoot, '.github/workflows/release-verification.yml'),
    'utf8'
  );
  const publishWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/publish.yml'),
    'utf8'
  );
  const signWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/sign-release.yml'),
    'utf8'
  );

  const protectedPublish = publishWorkflow.slice(
    publishWorkflow.indexOf('\n  publish:\n')
  );
  const protectedSign = signWorkflow.slice(signWorkflow.indexOf('\n  sign:\n'));

  for (const caller of [publishWorkflow, signWorkflow]) {
    const workflow = `${reusableVerification}\n${caller}`;
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
    assert.match(
      workflow,
      /gh release upload "\$TAG" "\$TARBALL"[^\n]+--clobber/
    );
    assert.match(workflow, /release-roundtrip/);
    assert.match(workflow, /retention-days: 14/);
    assert.match(workflow, /\.sigstore\.json/);
    assert.doesNotMatch(workflow, /\.intoto\.jsonl/);
    assert.ok(
      workflow.indexOf('compare-rebuild') <
        workflow.indexOf('actions/upload-artifact@')
    );
    assert.ok(
      workflow.indexOf('Rebind release tag and tarball after approval') <
        workflow.indexOf('actions/attest@')
    );
    assert.ok(
      workflow.indexOf('Verify transferred artifact digest') <
        workflow.indexOf('actions/attest@')
    );
  }

  for (const protectedJob of [protectedPublish, protectedSign]) {
    assert.match(protectedJob, /environment: npm-publish/);
    assert.doesNotMatch(
      protectedJob,
      /actions\/checkout@|pnpm\/action-setup|pnpm install/
    );
    assert.doesNotMatch(protectedJob, /scripts\/release-integrity\.mjs/);
  }

  assert.match(
    publishWorkflow,
    /npm publish "\$TARBALL" --access public --dry-run/
  );
  assert.match(publishWorkflow, /npm publish "\$TARBALL" --access public\n/);
  assert.ok(
    publishWorkflow.indexOf('actions/attest@') <
      publishWorkflow.indexOf('npm publish "$TARBALL"')
  );
});

test('release script pins its repository and pushes release refs atomically', () => {
  const publishScript = readFileSync(
    path.join(repoRoot, 'scripts/publish.sh'),
    'utf8'
  );

  assert.match(publishScript, /GH_REPOSITORY="\$GH_ACCOUNT\/lyra-ui"/);
  assert.match(publishScript, /git remote get-url --push --all origin/);
  assert.match(publishScript, /git remote get-url --all origin/);
  assert.match(publishScript, /origin fetch URL/);
  assert.match(publishScript, /git ls-remote --tags origin/);
  assert.match(
    publishScript,
    /git push origin "\$release_sha:refs\/heads\/main"/
  );
  assert.doesNotMatch(publishScript, /git push origin HEAD:/);
  assert.match(
    publishScript,
    /git tag -a "\$\{TAG\[\$dir\]\}" -m "Release \$\{TAG\[\$dir\]\}" "\$release_sha"/
  );
  assert.match(
    publishScript,
    /current_head="\$\(git rev-parse HEAD\^\{commit\}\)"/
  );
  assert.match(
    publishScript,
    /local HEAD moved during exact-commit qualification/
  );
  assert.match(
    publishScript,
    /working tree changed during exact-commit qualification/
  );
  assert.match(publishScript, /git push --atomic origin "\$\{tag_args\[@\]\}"/);
  assert.match(
    publishScript,
    /gh release create[\s\S]*--repo "\$GH_REPOSITORY"/
  );
  assert.doesNotMatch(publishScript, /git add -A/);
  assert.doesNotMatch(publishScript, /export GH_TOKEN/);
  assert.match(publishScript, /Working tree is not clean/);
  assert.match(
    publishScript,
    /pnpm --filter "\$name" --if-present run package-metadata/
  );
  assert.match(publishScript, /src\/internal\/package-metadata\.ts/);
  assert.match(publishScript, /scripts\/fixtures\/component-metadata\.json/);
  assert.match(publishScript, /scripts\/fixtures\/component-inventory\.json/);
  assert.match(publishScript, /git diff --name-only/);
  assert.match(publishScript, /node scripts\/update-readme-status\.mjs/);
  assert.match(publishScript, /git add README\.md/);
  assert.match(publishScript, /node scripts\/sync-plugin-version\.mjs/);
  assert.match(publishScript, /\.\/package\.sh/);
  assert.match(publishScript, /pnpm skill:check/);
  assert.match(
    publishScript,
    /plugins\/lyra-ui\/\.claude-plugin\/plugin\.json/
  );
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
  assert.match(
    publishScript,
    /custom-elements\.json[\s\S]*llms\.txt[\s\S]*llms-full\.txt/
  );
  const changedReleaseBlock = publishScript.slice(
    publishScript.indexOf('RELEASE_DIRS=()'),
    publishScript.indexOf('declare -A NEW_VERSION')
  );
  assert.match(changedReleaseBlock, /for dir in "\$\{PKG_DIRS\[@\]\}"/);
  assert.doesNotMatch(
    changedReleaseBlock,
    /for name in "\$\{EFFECTIVE_NAMES\[@\]\}"/
  );
  assert.match(changedReleaseBlock, /AUTO_EXPANDED_RELEASE_DIRS/);
  assert.match(
    changedReleaseBlock,
    /Changesets expanded the release to publishable dependents/
  );
  assert.match(publishScript, /Changesets auto-expanded dependent/);
  assert.match(publishScript, /node scripts\/changeset-release-plan\.mjs/);
  assert.doesNotMatch(publishScript, /matchAll\(\/\^"/u);
  let gateCursor = publishScript.indexOf('pnpm changeset version');
  for (const command of [
    'run package-metadata',
    'run manifest',
    'run component-metadata',
    'run manifest',
    // llms must regenerate before lint: lint's own check-llms-freshness.mjs/
    // check-llms-artifacts.mjs verify llms/ against the manifest and package-metadata-embedded
    // version this loop just regenerated above, so running llms generation after lint (the
    // order this test used to encode as correct) meant every release that changed manifest
    // content or bumped the version failed lint on stale llms/ output.
    'run default-string-slices',
    'run framework-types',
    'run design-tokens',
    'run generate-editor-data',
    'run llms',
    'run lint',
    'run build',
    'run component-quality',
    'run test',
  ]) {
    const commandIndex = publishScript.indexOf(command, gateCursor + 1);
    assert.ok(
      commandIndex > gateCursor,
      `${command} must follow the preceding release gate`
    );
    gateCursor = commandIndex;
  }
  for (const command of [
    'node scripts/sync-plugin-version.mjs',
    './package.sh',
    'pnpm skill:check',
  ]) {
    const commandIndex = publishScript.indexOf(command, gateCursor + 1);
    assert.ok(
      commandIndex > gateCursor,
      `${command} must follow release-time LLM generation`
    );
    gateCursor = commandIndex;
  }
  const stagingBlock = publishScript.slice(
    publishScript.indexOf('git add README.md'),
    publishScript.indexOf('unexpected_tracked_changes=')
  );
  for (const generatedEvidence of [
    'scripts/fixtures/component-qualification.json',
    'scripts/fixtures/component-integration.json',
    'docs/component-quality.md',
    'docs/component-integration.md',
  ]) {
    assert.match(
      stagingBlock,
      new RegExp(generatedEvidence.replaceAll('.', '\\.'), 'u'),
      `release commit must include regenerated ${generatedEvidence}`
    );
  }
  const pushMain = publishScript.indexOf(
    'git push origin "$release_sha:refs/heads/main"'
  );
  const dispatch = publishScript.indexOf('gh workflow run full-engine.yml');
  const waitCi = publishScript.indexOf('wait-ci', dispatch);
  const waitFullEngine = publishScript.indexOf('wait-full-engine', waitCi);
  const qualificationDriftGuard = publishScript.indexOf(
    'current_head="$(git rev-parse HEAD^{commit})"',
    waitFullEngine
  );
  const qualificationStatus = publishScript.indexOf(
    'qualification_status="$(git status --porcelain)"',
    qualificationDriftGuard
  );
  const qualificationPassed = publishScript.indexOf(
    'QUALIFICATION_PASSED=1',
    waitFullEngine
  );
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

  const qualificationGuardBlock = publishScript.slice(
    qualificationDriftGuard,
    tag
  );
  assert.match(
    qualificationGuardBlock,
    /qualification_status="\$\(git status --porcelain\)"/
  );

  const packageExecution = publishScript.slice(
    publishScript.indexOf('pnpm install'),
    publishScript.indexOf('release_sha=')
  );
  assert.doesNotMatch(packageExecution, /GH_TOKEN=/);

  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /`@aceshooting\/lyra-ui` is published at/);
  assert.match(readme, /source is versioned at/);

  const ciWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const lintJob = ciWorkflow.slice(
    ciWorkflow.indexOf('  lint:'),
    ciWorkflow.indexOf('\n  static-checks:')
  );
  assert.match(lintJob, /fetch-depth: 0/);
});

test('package lifecycle and root custom-elements metadata are clean-checkout safe', () => {
  const rootPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const lyraPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/package.json'), 'utf8')
  );
  const lyraManifestRelativePath = path.posix.join(
    'packages/lyra-ui',
    lyraPackage.customElements
  );
  const rootManifestPath = path.resolve(repoRoot, rootPackage.customElements);
  const lyraManifestPath = path.resolve(repoRoot, lyraManifestRelativePath);

  assert.equal(rootPackage.customElements, lyraManifestRelativePath);
  assert.equal(rootManifestPath, lyraManifestPath);
  const customElementsManifest = JSON.parse(
    readFileSync(rootManifestPath, 'utf8')
  );
  assert.equal(customElementsManifest.schemaVersion, '1.0.0');
  assert.ok(
    Array.isArray(customElementsManifest.modules) &&
      customElementsManifest.modules.length > 0,
    'the root customElements target must be a populated custom-elements manifest'
  );
  assert.equal(lyraPackage.scripts.pretest, 'pnpm run build');
  assert.match(lyraPackage.scripts.prepack, /^pnpm run package-metadata &&/);
});

test('contributor docs follow the package-manager authority', () => {
  const rootPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const packageManagerVersion = rootPackage.packageManager.replace(
    /^pnpm@/u,
    ''
  );
  const guide = readFileSync(
    path.join(repoRoot, 'docs/agents/ci-and-gates.md'),
    'utf8'
  );

  assert.match(
    guide,
    new RegExp(`pnpm ${packageManagerVersion.replaceAll('.', '\\.')}`, 'u')
  );
  assert.doesNotMatch(guide, /pnpm 11\.20\.0/u);
});

test('contributor docs derive the local platform modes from the runner and CI matrix', () => {
  const ciScript = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const guide = readFileSync(
    path.join(repoRoot, 'docs/agents/ci-and-gates.md'),
    'utf8'
  );
  const localAggregate = guide
    .split('## Local aggregate: `scripts/ci.sh`')[1]
    ?.split('\n## ')[0];
  assert.ok(
    localAggregate,
    'the contributor guide must document scripts/ci.sh'
  );
  const normalizedAggregate = localAggregate.replace(/\s+/gu, ' ');

  const browserLoop = ciScript.match(
    /if \[\[ "\$RUN_PLATFORM" == "1" \]\]; then\s+for browser in ([^;]+); do/u
  );
  assert.ok(
    browserLoop,
    'scripts/ci.sh must expose a parseable --platform browser loop'
  );
  const platformBrowsers = browserLoop[1].trim().split(/\s+/u);
  const displayName = (browser) => browser[0].toUpperCase() + browser.slice(1);
  const formattedBrowserList = platformBrowsers
    .map(displayName)
    .map((browser, index, all) =>
      index === all.length - 1 && all.length > 1 ? `and ${browser}` : browser
    )
    .join(platformBrowsers.length > 2 ? ', ' : ' ');
  assert.ok(
    normalizedAggregate.includes(
      `The ${platformBrowsers.length}-browser Node 22 sweep is ${formattedBrowserList}.`
    ),
    'the guide must list every browser in scripts/ci.sh --platform'
  );

  const platformStart = workflow.indexOf('\n  platform-contracts:');
  const stepsStart = workflow.indexOf('\n    steps:', platformStart);
  assert.ok(
    platformStart >= 0 && stepsStart > platformStart,
    'CI must define platform-contracts'
  );
  const platformHeader = workflow.slice(platformStart, stepsStart);
  const legs = [
    ...platformHeader.matchAll(
      /          - browser: (\S+)\n            node-version: (\d+)\n            shard_index: (\d+)\n            shard_total: (\d+)/gu
    ),
  ].map((match) => ({
    browser: displayName(match[1]),
    node: Number(match[2]),
    shard: Number(match[3]),
    total: Number(match[4]),
  }));
  assert.ok(
    legs.length > 0,
    'the CI platform matrix must have parseable include rows'
  );

  const nodeSummaries = [...new Set(legs.map(({ node }) => node))]
    .sort((a, b) => a - b)
    .map((node) => {
      const nodeLegs = legs.filter((leg) => leg.node === node);
      const browserTotals = [
        ...new Map(nodeLegs.map(({ browser, total }) => [browser, total])),
      ];
      const list = browserTotals
        .map(
          ([browser, total]) =>
            `${browser} (${total} ${total === 1 ? 'shard' : 'shards'})`
        )
        .map((entry, index, all) =>
          index === all.length - 1 && all.length > 1 ? `and ${entry}` : entry
        )
        .join(browserTotals.length > 2 ? ', ' : ' ');
      return `Node ${node} runs ${list}`;
    });
  assert.ok(
    normalizedAggregate.includes(
      `Its ${legs.length} legs are source-derived: ${nodeSummaries.join('; ')}.`
    ),
    'the guide must enumerate every CI platform leg from the workflow matrix'
  );
});

test('catalog prose uses the shipped strict virtualization threshold contract', () => {
  const readme = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/README.md'),
    'utf8'
  );
  const shared = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/llms/shared.md'),
    'utf8'
  );
  const catalogRows = ['lr-ingestion-queue', 'lr-activity-feed'].map(
    (tagName) => {
      const row = readme
        .split('\n')
        .find((line) => line.startsWith(`| \`<${tagName}>\``));
      assert.ok(row, `README catalog must contain <${tagName}>`);
      return row;
    }
  );

  for (const row of catalogRows) {
    assert.match(row, /`virtualizeAt`/u);
    assert.match(row, /(?:above|more than) `virtualizeAt`/u);
    assert.doesNotMatch(row, /virtualizeThreshold|at or above/iu);
  }
  assert.match(shared, /`virtualizeThreshold` → `virtualizeAt`/u);
});

test('MCP catalog prose matches the validated resource and request-event contract', () => {
  const readme = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/README.md'),
    'utf8'
  );
  const row = readme
    .split('\n')
    .find((line) => line.startsWith('| `<lr-mcp-app>`'));
  assert.ok(row, 'README catalog must contain <lr-mcp-app>');
  assert.match(row, /required resource descriptor/iu);
  assert.match(row, /exactly one of HTML or source URL/iu);
  assert.match(row, /host-authorized request events/iu);
  assert.doesNotMatch(row, /origin allowlist|error event/iu);
});

test('typed chart catalog prose matches the writable type contract', () => {
  const readme = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/README.md'),
    'utf8'
  );
  const row = readme
    .split('\n')
    .find((line) => line.startsWith('| `<lr-bar-chart>`'));
  assert.ok(row, 'README catalog must contain the typed chart row');
  assert.match(row, /tag-specific defaults/iu);
  assert.match(row, /full writable `LyraChartType` vocabulary/iu);
  assert.doesNotMatch(row, /type` locked/iu);
});

test('sequence playback catalog prose uses the v9 domain surface', () => {
  const readme = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/README.md'),
    'utf8'
  );
  const row = readme
    .split('\n')
    .find((line) => line.startsWith('| `<lr-sequence-playback>`'));
  assert.ok(row, 'README catalog must contain <lr-sequence-playback>');
  assert.match(row, /`itemCount`/u);
  assert.match(row, /`currentIndex`/u);
  assert.match(row, /`lr-sequence-step`/u);
  assert.doesNotMatch(readme, /^\| `<lr-playback>`/mu);
});

test('the authored provider-neutral AI import example compiles against the shipped source entry', () => {
  const shared = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/llms/shared.md'),
    'utf8'
  );
  const section = shared
    .split('## Provider-neutral AI types: `@aceshooting/lyra-ui/ai`')[1]
    ?.split('\n## ')[0];
  assert.ok(section, 'shared.md must contain the provider-neutral AI section');
  assert.match(section, /monotonic `generation`/u);
  assert.match(section, /strictly increasing `sequence`/u);
  assert.match(section, /DEFAULT_AGENT_STREAM_LIMITS/u);
  assert.match(section, /success\/error\s+union/u);
  assert.doesNotMatch(
    section,
    /src\/ai\/types\.contract\.ts|adaptAiSdkStream|adaptAgUiEvents/u
  );
  const snippet = section.match(/```ts\n([\s\S]*?)\n```/u)?.[1];
  assert.ok(snippet, 'the AI section must contain a TypeScript import example');

  const tempDir = mkdtempSync(path.join(tmpdir(), 'lyra-ai-doc-example-'));
  try {
    const sourcePath = path.join(tempDir, 'example.ts');
    const configPath = path.join(tempDir, 'tsconfig.json');
    writeFileSync(sourcePath, `${snippet}\n`, 'utf8');
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
            verbatimModuleSyntax: true,
            experimentalDecorators: true,
            useDefineForClassFields: false,
            paths: {
              '@aceshooting/lyra-ui/ai': [
                path.relative(
                  tempDir,
                  path.join(repoRoot, 'packages/lyra-ui/src/ai/index.ts')
                ),
              ],
            },
          },
          files: [sourcePath],
        },
        null,
        2
      )
    );

    const tsc = path.join(repoRoot, 'packages/lyra-ui/node_modules/.bin/tsc');
    const result = spawnSync(
      tsc,
      ['--project', configPath, '--pretty', 'false'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      }
    );
    assert.equal(
      result.status,
      0,
      `shared.md AI example must compile against src/ai/index.ts:\n${result.stdout}${result.stderr}`
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('local platform legs keep nested package-manager calls on their selected toolchain', () => {
  const ciScript = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  const pnpmProxy = readFileSync(
    path.join(repoRoot, 'scripts/ci-bin/pnpm'),
    'utf8'
  );
  const runWithToolchain = ciScript.slice(
    ciScript.indexOf('run_with_toolchain()'),
    ciScript.indexOf(
      '\nvalidate_platform_toolchain()',
      ciScript.indexOf('run_with_toolchain()')
    )
  );

  assert.match(
    runWithToolchain,
    /PATH="\$CI_SH_ROOT\/scripts\/ci-bin:\$\(dirname "\$node_bin"\):\$PATH"/u
  );
  assert.match(runWithToolchain, /CI_SH_SELECTED_PNPM_BIN="\$pnpm_bin"/u);
  assert.match(runWithToolchain, /npm_config_scripts_prepend_node_path=false/u);
  assert.match(pnpmProxy, /"\$CI_SH_SELECTED_PNPM_BIN" "\$@"/u);
  assert.match(pnpmProxy, /npm_config_manage_package_manager_versions=false/u);
});

test('policy-summary registration and authored docs match its actual composition', () => {
  const registration = readFileSync(
    path.join(
      repoRoot,
      'packages/lyra-ui/src/components/agent-tools/policy-summary/policy-summary.ts'
    ),
    'utf8'
  );
  const readme = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/README.md'),
    'utf8'
  );
  const authored = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/llms/agent-tools.md'),
    'utf8'
  );

  assert.doesNotMatch(registration, /overlays\/callout/u);
  const catalogRow =
    readme.split('\n').find((line) => line.includes('<lr-policy-summary>')) ??
    '';
  assert.doesNotMatch(catalogRow, /lr-callout/u);
  const section =
    authored.split('## `lr-policy-summary`')[1]?.split('\n## ')[0] ?? '';
  assert.doesNotMatch(section, /tones? the badge and callout/iu);
});

test('interactive graph-legend story exposes visible feedback without a duplicate live region', () => {
  const story = readFileSync(
    path.join(
      repoRoot,
      'packages/lyra-ui/src/components/retrieval/graph-legend/graph-legend.stories.ts'
    ),
    'utf8'
  );

  assert.doesNotMatch(story, /@lr-visibility-change=\$\{[^}]*console\.log/su);
  assert.match(story, /<p data-visibility-feedback>/u);
  assert.doesNotMatch(story, /data-visibility-feedback[^>]*aria-live/u);
});

test('every Playwright container image tracks the pinned playwright dependency', () => {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const pinned = (pkg.devDependencies?.playwright ?? pkg.dependencies?.playwright ?? '').replace(
    /[^0-9.]/g,
    ''
  );
  assert.match(pinned, /^\d+\.\d+\.\d+$/, 'root package.json must pin a concrete playwright version');

  // The browser jobs no longer run `playwright install`; they inherit the binaries baked into the
  // image. A version skew there is silent and total -- Playwright would look for a browser build
  // the image does not carry -- so the tag is gated rather than trusted.
  for (const file of ['.github/workflows/ci.yml', '.github/workflows/full-engine.yml']) {
    const src = readFileSync(path.join(repoRoot, file), 'utf8');
    const tags = [...src.matchAll(/mcr\.microsoft\.com\/playwright:v([0-9.]+)-/g)].map((m) => m[1]);
    assert.ok(tags.length > 0, `${file} must run its browser jobs in the pinned Playwright image`);
    for (const tag of tags) {
      assert.equal(tag, pinned, `${file} pins a Playwright image that package.json no longer matches`);
    }
  }

  // Drives the browser cache key for the two VM-only legs.
  const cacheVersion = readFileSync(path.join(repoRoot, '.github/playwright-version.txt'), 'utf8').trim();
  assert.equal(cacheVersion, pinned, '.github/playwright-version.txt must match the pinned playwright version');
});

// The published upgrade feed lagging npm was reported twice, from two different consumer projects,
// on two consecutive releases. Both shapes are pinned here because they fail differently: a stale
// `latest` misleads a reader who diffs from it, while a missing `releases` entry defeats even a
// reader who ignores `latest` and scans the array. The real 11.1.0 report hit BOTH at once.
test('treats a published upgrade feed that lags npm as an incomplete release', () => {
  const fresh = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.3.0',
    npmDistTagLatest: '11.3.0',
    changelog: { latest: '11.3.0', releases: [{ version: '11.3.0' }, { version: '11.2.0' }] },
  });
  assert.deepEqual(fresh, { fresh: true, problems: [] });

  // The exact shape reported for 11.1.0: absent from `latest` AND from `releases`.
  const lagging = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.1.0',
    npmDistTagLatest: '11.1.0',
    changelog: { latest: '11.0.0', releases: [{ version: '11.0.0' }] },
  });
  assert.equal(lagging.fresh, false);
  assert.equal(lagging.problems.length, 2);
  assert.match(lagging.problems[0], /"latest" is 11\.0\.0, expected 11\.1\.0/);
  assert.match(lagging.problems[1], /"releases" contains no entry for 11\.1\.0/);

  // A feed whose `latest` is right but whose array is missing the entry is still not fresh --
  // a consumer reading release notes between two versions finds nothing to read.
  const partial = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.3.0',
    npmDistTagLatest: '11.3.0',
    changelog: { latest: '11.3.0', releases: [{ version: '11.2.0' }] },
  });
  assert.equal(partial.fresh, false);
  assert.equal(partial.problems.length, 1);

  // npm itself not having the version yet is reported distinctly from the feed being stale, so a
  // maintainer can tell "publish CI has not finished" from "the site was never deployed".
  const npmBehind = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.3.0',
    npmDistTagLatest: '11.2.0',
    changelog: { latest: '11.3.0', releases: [{ version: '11.3.0' }] },
  });
  assert.equal(npmBehind.fresh, false);
  assert.match(npmBehind.problems[0], /npm dist-tags\.latest .* is 11\.2\.0, expected 11\.3\.0/);

  // The component catalog rides the same deploy and was caught a release behind npm at the same
  // time -- the third instance of one root cause. Checked here so it is not reported a fourth time.
  const staleCatalog = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.3.0',
    npmDistTagLatest: '11.3.0',
    changelog: { latest: '11.3.0', releases: [{ version: '11.3.0' }] },
    catalogVersion: '11.2.0+sha256.51be72f509780516',
  });
  assert.equal(staleCatalog.fresh, false);
  assert.match(staleCatalog.problems[0], /catalog_version is 11\.2\.0\+sha256/);

  // The build-fingerprint suffix is not part of the version comparison.
  assert.equal(
    evaluateSiteFreshness({
      packageName: '@aceshooting/lyra-ui',
      expectedVersion: '11.3.0',
      npmDistTagLatest: '11.3.0',
      changelog: { latest: '11.3.0', releases: [{ version: '11.3.0' }] },
      catalogVersion: '11.3.0+sha256.51be72f509780516',
    }).fresh,
    true
  );

  // An unreachable catalog endpoint must not block an otherwise-valid release: it is optional
  // infrastructure, unlike the changelog feed the upgrade workflow actually instructs readers to use.
  assert.equal(
    evaluateSiteFreshness({
      packageName: '@aceshooting/lyra-ui',
      expectedVersion: '11.3.0',
      npmDistTagLatest: '11.3.0',
      changelog: { latest: '11.3.0', releases: [{ version: '11.3.0' }] },
      catalogVersion: undefined,
    }).fresh,
    true
  );

  // An unreachable or non-JSON feed fails closed rather than being read as fresh.
  const unreachable = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.3.0',
    npmDistTagLatest: '11.3.0',
    changelog: null,
  });
  assert.equal(unreachable.fresh, false);
  assert.match(unreachable.problems[0], /could not be fetched/);
});
