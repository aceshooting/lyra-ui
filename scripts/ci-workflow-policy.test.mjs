import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
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

test('the complete DOCX group runs once per engine with Firefox owned by platform shard 2', () => {
  const platform = job(read('.github/workflows/ci.yml'), 'platform-contracts');
  const matrix = platform.slice(platform.indexOf('        include:\n'), platform.indexOf('    runs-on:'));
  const rows = [...matrix.matchAll(/^ {10}- browser: ([^\n]+)\n([\s\S]*?)(?=^ {10}- browser:|$(?![\s\S]))/gmu)]
    .map(([, browser, body]) => ({
      browser,
      install_browser: body.match(/^ {12}install_browser: (\S+)$/mu)?.[1],
      shard_index: Number(body.match(/^ {12}shard_index: (\d+)$/mu)?.[1]),
    }));
  assert.deepEqual(rows.map((row) => `${row.browser}/${row.shard_index}`), [
    'chromium/1', 'chrome/1', 'edge/1', 'firefox/1', 'firefox/2', 'safari/1',
  ], 'evaluate the live complete platform matrix');
  const steps = platform.split(/\n(?= {6}- )/u);
  for (const name of [
    "Download this run's lyra-ui build for the DOCX editor",
    'Qualify the experimental DOCX editor',
    'Archive DOCX editor qualification',
  ]) {
    const matches = steps.filter((step) => step.startsWith(`      - name: ${name}\n`));
    assert.equal(matches.length, 1, `${name} exists exactly once`);
    const expression = matches[0].match(/^ {8}if: (.+)$/mu)?.[1];
    assert.ok(expression, `${name} has an explicit owner condition`);
    // These conditions use the common JavaScript/GitHub expression subset: comparisons,
    // parentheses, boolean operators and always(). Evaluate each real row independently.
    const owners = rows.filter((row) => runInNewContext(expression, {
      matrix: row, always: () => true,
    }, { timeout: 100 })).map((row) => `${row.install_browser}/${row.shard_index}`);
    assert.deepEqual(owners, ['chromium/1', 'firefox/2', 'webkit/1'], `${name} keeps the same owners`);
    if (name.startsWith('Archive')) {
      assert.match(expression, /^always\(\) &&/u, 'failed DOCX runs still archive evidence');
      assert.match(matches[0], /name: docx-editor-\$\{\{ matrix\.install_browser \}\}/u);
    }
    if (name.startsWith('Qualify')) {
      assert.match(matches[0], /DOCX_BROWSERS: \$\{\{ matrix\.install_browser \}\}/u);
      assert.match(matches[0], /pnpm --filter @aceshooting\/lyra-docs test:coverage/u);
      assert.match(matches[0], /pnpm --filter @aceshooting\/lyra-docs test:browser/u);
    }
  }
});

test('each of the seven coverage flags owns one complete package report and a scoped README badge', () => {
  const packages = ['lyra-ui', 'lyra-3d', 'lyra-map', 'lyra-docs', 'lyra-flags', 'lyra-ide', 'lyra-translations'];
  const config = read('codecov.yml');
  const flags = config.slice(config.indexOf('\nflags:\n'), config.indexOf('\n# Separate product'));
  const entries = [...flags.matchAll(/^ {2}([\w-]+):\n {4}paths:\n((?: {6}- [^\n]+\n)+)/gmu)];
  assert.deepEqual(entries.map(([, name]) => name).sort(), [...packages].sort());
  for (const [, name, paths] of entries) {
    assert.equal(paths.trim(), `- packages/${name}/${name === 'lyra-ui' ? 'src/' : ''}**`, `${name} cannot absorb another package's data`);
    const badge = `https://codecov.io/gh/aceshooting/lyra-ui/branch/main/graph/badge.svg?flag=${name}`;
    for (const file of [`packages/${name}/README.md`, ...(name === 'lyra-ui' ? ['README.md'] : [])]) {
      const urls = [...read(file).matchAll(/https:\/\/codecov\.io\/[^\s)]+\/graph\/badge\.svg(?:\?[^\s)]+)?/gu)].map(([url]) => url);
      assert.deepEqual(urls, [badge], `${file} must show exactly its own flag`);
    }
  }

  const workflow = read('.github/workflows/ci.yml');
  const producer = job(workflow, 'companion_coverage');
  const matrix = producer.match(/^ {8}package: \[([^\]]+)\]$/mu)?.[1].split(',').map((name) => name.trim());
  assert.deepEqual(matrix, ['lyra-3d', 'lyra-map', 'lyra-flags', 'lyra-ide', 'lyra-translations']);
  assert.deepEqual(['lyra-ui', ...matrix, 'lyra-docs'].sort(), [...packages].sort(), 'one coverage producer per flag');
  assert.match(workflow, /# release-qualification: matrix\n {2}companion_coverage:/u);
  assert.match(producer, /^ {4}needs: build_and_coverage_build$/mu);
  assert.match(producer, /fail-fast: false/u);
  assert.match(producer, /node-version-file: \.nvmrc/u);
  assert.match(producer, /image: mcr\.microsoft\.com\/playwright:v[\d.]+-noble/u);
  assert.match(producer, /pnpm --filter "@aceshooting\/\$COVERAGE_PACKAGE" test:coverage/u);
  assert.match(producer, /node scripts\/prepare-codecov-lcov\.mjs "\$COVERAGE_PACKAGE"/u);
  assert.doesNotMatch(producer, /continue-on-error|COVERAGE_BROWSER: ['"]?0|test:coverage --/u, 'the existing complete browser and 100% floor commands stay enabled');
  assert.match(producer, /LYRA_MAP_COVERAGE_BROWSER: '1'/u);
  assert.match(producer, /LYRA_3D_COVERAGE_BROWSER: '1'/u);
  assert.match(producer, /name: lyra-ui-dist\n {10}path: packages\/lyra-ui\/dist/u);
  assert.match(producer, /name: Archive companion coverage\n {8}if: always\(\)/u);
  assert.match(producer, /if-no-files-found: error/u);
  for (const report of ['coverage-summary.json', 'coverage-metadata.json', 'lcov.info', 'codecov.lcov']) {
    assert.ok(producer.includes('packages/${{ matrix.package }}/coverage/' + report), `${report} is archived per package`);
  }

  const local = read('scripts/ci.sh');
  assert.match(local, /for coverage_package in lyra-3d lyra-map lyra-docs lyra-flags lyra-ide lyra-translations; do/u);
  assert.match(local, /pnpm --filter "@aceshooting\/\$coverage_package" test:coverage/u);
  assert.match(local, /LYRA_MAP_COVERAGE_BROWSER=1 LYRA_3D_COVERAGE_BROWSER=1 pnpm/u);
  assert.match(local, /node scripts\/prepare-codecov-lcov\.mjs "\$coverage_package"/u);
  assert.match(job(workflow, 'static-checks'), /pnpm --filter '!@aceshooting\/lyra-ui' -r test/u, 'ordinary companion test gates remain');
  const floors = JSON.parse(read('packages/lyra-ui/scripts/coverage-floors.json'));
  assert.ok(floors.lines >= 99.74 && floors.statements >= 99.74, 'the flagged UI report retains its coverage floor');
});

test('Codecov uploads only the canonical report matching its one explicit flag', () => {
  const workflow = read('.github/workflows/ci.yml');
  const allUploads = workflow.split(/\n(?= {6}- )/u).filter((step) => /uses: codecov\/codecov-action@/u.test(step));
  assert.equal(allUploads.length, 4, 'three coverage uploads and one separate JUnit upload');
  const uploads = allUploads.filter((step) => !/report_type: test_results/u.test(step));
  assert.equal(uploads.length, 3, 'UI, five-leg companion matrix and Chromium DOCX');
  const actual = uploads.map((step) => {
    assert.match(step, /disable_search: true/u, 'do not discover other packages or duplicate reports');
    assert.match(step, /disable_file_fixes: true/u, 'keep the locally measured line counters');
    assert.match(step, /plugins: noop/u, 'LCOV is already complete');
    assert.match(step, /fail_ci_if_error: false/u, 'Codecov availability is informational; coverage commands are blocking');
    const file = step.match(/^ {10}files: (.+)$/mu)?.[1];
    const flag = step.match(/^ {10}flags: (.+)$/mu)?.[1];
    return { file, flag };
  });
  assert.deepEqual(actual, [
    { file: 'packages/lyra-ui/coverage/codecov.lcov', flag: 'lyra-ui' },
    { file: 'packages/${{ matrix.package }}/coverage/codecov.lcov', flag: '${{ matrix.package }}' },
    { file: 'packages/lyra-docs/coverage/codecov.lcov', flag: 'lyra-docs' },
  ]);
  assert.match(uploads[0], /steps\.prepare_ui_coverage\.outcome == 'success'/u, 'a failed path preparation cannot upload a stale UI report');
  const platform = job(workflow, 'platform-contracts');
  const qualification = platform.slice(platform.indexOf('- name: Qualify the experimental DOCX editor'), platform.indexOf('- name: Upload DOCX coverage'));
  assert.match(qualification, /if \[ "\$DOCX_BROWSERS" = 'chromium' \]; then\n {12}pnpm --filter @aceshooting\/lyra-docs test:coverage\n {12}node scripts\/prepare-codecov-lcov\.mjs lyra-docs\n {10}else/u);
  const docxUpload = uploads.at(-1);
  assert.match(docxUpload, /^ {8}if: matrix\.install_browser == 'chromium' && matrix\.shard_index == 1$/mu);
  assert.match(platform, /name: Archive DOCX coverage\n {8}if: always\(\) && matrix\.install_browser == 'chromium' && matrix\.shard_index == 1/u);
  const merged = job(workflow, 'build_and_coverage_coverage');
  assert.ok(merged.indexOf('name: Prepare the lyra-ui Codecov report') > merged.indexOf('name: Check merged coverage floors'));
  assert.match(merged, /node scripts\/prepare-codecov-lcov\.mjs lyra-ui/u);
});

test('Codecov test analytics uploads only merged JUnit through the supported pinned action', () => {
  const workflow = read('.github/workflows/ci.yml');
  assert.doesNotMatch(workflow, /uses: codecov\/test-results-action@/u);
  const merged = job(workflow, 'build_and_coverage_coverage');
  const uploads = merged.split(/\n(?= {6}- )/u).filter((step) => /uses: codecov\/codecov-action@/u.test(step));
  assert.equal(uploads.length, 2, 'coverage and test analytics remain separate uploads');
  const [coverage, analytics] = uploads;
  assert.match(analytics, /name: Upload test results to Codecov/u);
  const ref = (step) => step.match(/uses: codecov\/codecov-action@([0-9a-f]{40})\b/u)?.[1];
  assert.ok(ref(coverage), 'coverage action uses a complete immutable commit');
  assert.equal(ref(analytics), ref(coverage), 'analytics reuses the approved coverage action pin');
  assert.match(analytics, /^ {8}if: \$\{\{ !cancelled\(\) && steps\.merge_coverage\.outcome == 'success' \}\}$/mu);
  assert.match(analytics, /^ {10}report_type: test_results$/mu);
  assert.match(analytics, /^ {10}files: packages\/lyra-ui\/coverage\/junit\.xml$/mu);
  assert.match(analytics, /^ {10}disable_search: true$/mu);
  assert.match(analytics, /^ {10}flags: lyra-ui$/mu);
  assert.match(analytics, /^ {10}fail_ci_if_error: false$/mu);
  assert.match(analytics, /CODECOV_TOKEN: \$\{\{ secrets\.CODECOV_TOKEN \}\}/u);
  assert.doesNotMatch(analytics, /^ {10}(?:file|use_oidc):/mu, 'no obsolete singular file input or authentication change');
  assert.doesNotMatch(coverage, /report_type: test_results/u, 'LCOV stays a coverage report');
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
