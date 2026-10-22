import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// Section of a top-level job body (up to the next sibling job).
function job(text, name) {
  const start = text.indexOf(`\n  ${name}:\n`);
  assert(start >= 0, `job ${name} exists`);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z][a-z0-9_-]*:\n/u);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('the coverage shard step runs under the strict console gate', () => {
  const step = read('.github/workflows/ci.yml');
  const at = step.indexOf('name: Run coverage shard');
  assert(at >= 0);
  assert.match(step.slice(at, at + 400), /WTR_STRICT_CONSOLE: "1"/u);
});

test('complete browser suites receive the built Map and 3D companions before their shards run', () => {
  const library = JSON.parse(read('packages/lyra-ui/package.json'));
  assert.match(library.scripts.build, /@aceshooting\/lyra-map --filter @aceshooting\/lyra-3d run build/u);
  for (const [workflowPath, buildJob, testJob, buildCommand, testCommand] of [
    ['.github/workflows/ci.yml', 'build_and_coverage_build', 'build_and_coverage_coverage_shard',
      'run: pnpm build', 'name: Run coverage shard'],
    ['.github/workflows/ci.yml', 'build_and_coverage_build', 'scale-budgets',
      'run: pnpm build', 'run: pnpm --filter @aceshooting/lyra-ui test:scale'],
    ['.github/workflows/full-engine.yml', 'build', 'full-engine',
      'run: pnpm --filter @aceshooting/lyra-ui build', 'name: Run complete non-coverage test shard'],
    ['.github/workflows/test-all-browsers.yml', 'build', 'test',
      'run: pnpm --filter @aceshooting/lyra-ui build', 'name: Run complete browser shard'],
  ]) {
    const workflow = read(workflowPath);
    const build = job(workflow, buildJob);
    const shard = job(workflow, testJob);
    const builtAt = build.indexOf(buildCommand);
    const testedAt = shard.indexOf(testCommand);
    for (const [label, companion] of [['Map', 'lyra-map'], ['3D', 'lyra-3d']]) {
      const artifact = `name: ${companion}-dist\n          path: packages/${companion}/dist`;
      const uploadedAt = build.indexOf(artifact), downloadedAt = shard.indexOf(artifact);
      assert.ok(builtAt >= 0 && uploadedAt > builtAt, `${workflowPath} uploads built ${label} dist`);
      assert.ok(downloadedAt >= 0 && testedAt > downloadedAt, `${workflowPath} downloads ${label} dist before tests`);
    }
  }
});

test('Storybook contract loads the Map Vite entry built by the docs producer', () => {
  const workflow = read('.github/workflows/ci.yml');
  const build = job(workflow, 'docs_build');
  const contract = job(workflow, 'docs_storybook_contract');
  const builtAt = build.indexOf('run: pnpm build');
  const uploadedAt = build.indexOf('name: storybook-lyra-map-dist\n          path: packages/lyra-map/dist');
  assert.ok(builtAt >= 0 && uploadedAt > builtAt);
  const downloadedAt = contract.indexOf('name: storybook-lyra-map-dist\n          path: packages/lyra-map/dist');
  assert.ok(downloadedAt >= 0 && downloadedAt < contract.indexOf('run: pnpm storybook:check'));
});

test('static-checks does not repeat lint-owned contract gates', () => {
  const body = job(read('.github/workflows/ci.yml'), 'static-checks');
  assert.doesNotMatch(body, /^\s*- run: .*test:public-api/mu);
});

test('the browser sweeps reuse one build instead of rebuilding per lane', () => {
  assert.match(read('.github/workflows/test-all-browsers.yml'), /TEST_ALL_BROWSERS_SKIP_BUILD: '1'/u);
});

test('a failing browser sweep keeps its lane logs and prints their path', () => {
  const script = read('scripts/test_all_browsers.sh');
  assert.match(script, /lane logs kept for inspection: \$LOG_DIR/u);
  assert.match(script, /trap cleanup_logs EXIT/u);
});

test('quality-tools is release qualification: every job is required, dispatchable, complete by default and able to fail', () => {
  const workflow = read('.github/workflows/quality-tools.yml');
  assert.match(workflow, /^permissions:\n {2}contents: read\n/mu, 'read-only token');
  assert.doesNotMatch(workflow, /continue-on-error/u, 'a required job must be able to fail the run');
  assert.doesNotMatch(workflow, /not (?:a )?part of release qualification|outside release qualification/iu, 'the header must not claim the opposite of the manifest');
  // Another queued run replaces a pending one in the same concurrency group, which could cancel the
  // dispatch a release is waiting for; the other qualification workflows have no group either.
  assert.doesNotMatch(workflow, /^concurrency:/mu, 'no concurrency group can cancel a pending release-qualification dispatch');

  const jobIds = [...workflow.slice(workflow.indexOf('\njobs:\n')).matchAll(/^ {2}([a-z][a-z0-9_-]*):$/gmu)].map((match) => match[1]);
  assert.deepEqual(jobIds, ['flake-hunt', 'mutation', 'bundle-composition', 'ab-benchmark']);
  const names = [];
  for (const id of jobIds) {
    assert.match(workflow, new RegExp(`# release-qualification: required\\n {2}${id}:\\n`, 'u'), `${id} is required for a release`);
    assert.match(job(workflow, id), /\n {4}if: [^\n]*workflow_dispatch/u, `${id} can be started by hand`);
    names.push(job(workflow, id).match(/\n {4}name: (.+)\n/u)?.[1]);
  }
  const manifest = JSON.parse(read('.github/release-qualification.json')).workflows.qualityTools;
  assert.deepEqual(manifest, {
    name: 'Quality tools', path: '.github/workflows/quality-tools.yml', event: 'workflow_dispatch', headBranch: 'main',
    requiredJobs: [...names].sort((left, right) => left.localeCompare(right)),
  });
  assert.equal(manifest.requiredJobs.length, 4, 'flake hunt, mutation, bundle composition and the A/B benchmark');

  // The release run is the complete one: the benchmark input defaults on (a run with it off has a skipped
  // job, which release-integrity rejects), and mutation always runs every mutant -- there is no input or
  // cache that could stand in for a run on this commit.
  assert.match(workflow, /ab_benchmark:\n(?: {8}[^\n]*\n)*? {8}default: true\n/u);
  assert.doesNotMatch(workflow, /mutation_full|stryker-incremental|actions\/cache@/u, 'no cached mutation result can stand in for a full run');
  assert.match(job(workflow, 'mutation'), /stryker run --force/u);
  assert.doesNotMatch(job(workflow, 'mutation'), /stryker run(?! --force)/u);

  // Real problems fail the job (the scripts own the rules; the workflow must not mute their exit status).
  for (const [id, script] of [['flake-hunt', 'scripts/flake-hunt.mjs'], ['bundle-composition', 'scripts/bundle-composition-report.mjs'], ['ab-benchmark', 'benchmarks/ab.mjs']]) {
    const body = job(workflow, id);
    const invocation = body.split('\n').find((line) => line.includes(script));
    assert.ok(invocation, `${id} runs ${script}`);
    // No `||`, pipe or `;` after the script: a swallowed exit status would turn the gate into a report.
    assert.doesNotMatch(invocation.slice(invocation.indexOf(script)), /\|\||\||;/u, `${id} keeps the exit status of ${script}`);
    assert.doesNotMatch(body, /--fail-on-failure|set \+e/u, `${id} keeps its exit status`);
  }
  assert.match(job(workflow, 'mutation'), /mutation-summary\.mjs/u, 'the mutation report is checked and summarized after the run');

  const crons = [...workflow.matchAll(/^ {4}- cron: '([^']+)'$/gmu)].map((match) => match[1]);
  assert.equal(crons.length, 2, 'one nightly and one weekly schedule');
  for (const cron of crons) {
    assert.ok(workflow.includes(`github.event.schedule == '${cron}'`), `a job runs on the schedule ${cron}`);
  }
  assert.doesNotMatch(job(workflow, 'ab-benchmark'), /github\.event\.schedule/u, 'the A/B benchmark never runs on a schedule');
});

test('mocha retries stay at their default in the test lanes; only the flake hunt turns them off', () => {
  for (const file of ['ci.yml', 'full-engine.yml', 'test-all-browsers.yml']) {
    assert.doesNotMatch(read(`.github/workflows/${file}`), /WTR_RETRIES/u, `${file} keeps the retry`);
  }
  assert.match(job(read('.github/workflows/quality-tools.yml'), 'flake-hunt'), /scripts\/flake-hunt\.mjs/u);
});
