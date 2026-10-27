import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('qualification and release Node setup never restores package-manager caches', () => {
  const workflows = new Map([
    ['ci.yml', 21],
    ['full-engine.yml', 2],
    ['test-all-browsers.yml', 2],
    ['quality-tools.yml', 4],
    ['release.yml', 2],
    ['release-verification.yml', 1],
    ['prepare-artifacts.yml', 1],
    ['publish.yml', 1],
  ]);
  for (const [name, count] of workflows) {
    const source = read(`.github/workflows/${name}`);
    const steps = source.split(/\n(?= {6}- )/u)
      .filter(step => /uses: actions\/setup-node@/u.test(step));
    assert.equal(steps.length, count, `${name}: inspect every Node setup step`);
    for (const step of steps) {
      assert.match(step, /uses: actions\/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1\b/u);
      assert.match(step, /^ {10}package-manager-cache: false$/mu, `${name}: disable automatic caching`);
      assert.doesNotMatch(step, /^ {10}cache(?:-dependency-path)?:/mu, `${name}: explicit caching overrides automatic-cache disablement`);
      assert.doesNotMatch(step, /^ {8}continue-on-error:/mu, `${name}: Node setup must succeed`);
      assert.match(step, name === 'publish.yml'
        ? /^ {10}node-version: \$\{\{ needs\.verify\.outputs\.node_version \}\}$/mu
        : /^ {10}node-version-file: \.nvmrc$/mu);
    }
  }
});

test('real browser channels install independently of cache availability', () => {
  const ci = job(read('.github/workflows/ci.yml'), 'platform-contracts');
  const browsers = job(read('.github/workflows/test-all-browsers.yml'), 'test');
  for (const source of [ci, browsers]) {
    assert.doesNotMatch(source, /actions\/cache(?:\/[^@\s]+)?@|playwright-cache|cache-hit/u);
    assert.match(source, /pnpm install --frozen-lockfile/u);
  }
  const install = ci.split(/\n(?= {6}- )/u)
    .find(step => /run: pnpm --filter @aceshooting\/lyra-ui exec playwright install \$\{\{ matrix\.install_browser \}\}/u.test(step));
  assert.ok(install);
  const ciCondition = install.match(/^ {6}- if: (.+)$/mu)?.[1];
  assert.ok(ciCondition);
  for (const container of ['', 'mcr.microsoft.com/playwright:v1.64.1-noble']) {
    assert.equal(runInNewContext(ciCondition, { matrix: { container } }), container === '');
  }
  const channel = browsers.split(/\n(?= {6}- )/u)
    .find(step => step.startsWith('      - name: Install real browser channel\n'));
  assert.ok(channel);
  const condition = channel.match(/^ {8}if: (.+)$/mu)?.[1];
  assert.ok(condition);
  for (const browser of ['chromium', 'chrome', 'edge', 'firefox', 'safari']) {
    assert.equal(runInNewContext(condition, { matrix: { browser } }), ['chrome', 'edge'].includes(browser));
  }
  assert.match(channel, /INSTALL_BROWSER: \$\{\{ matrix\.browser == 'edge' && 'msedge' \|\| 'chrome' \}\}/u);
  assert.match(channel, /run: \.\/scripts\/ci-phase\.sh channel-binary pnpm --filter @aceshooting\/lyra-ui exec playwright install "\$INSTALL_BROWSER"/u);
});

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

test('generated UI has one browser and durable-host qualification per engine plus built static contracts', () => {
  const workflow = read('.github/workflows/ci.yml');
  const platform = job(workflow, 'platform-contracts');
  const matrix = platform.slice(platform.indexOf('        include:\n'), platform.indexOf('    runs-on:'));
  const rows = [...matrix.matchAll(/^ {10}- browser: ([^\n]+)\n([\s\S]*?)(?=^ {10}- browser:|$(?![\s\S]))/gmu)]
    .map(([, browser, body]) => ({ browser, install_browser: body.match(/^ {12}install_browser: (\S+)$/mu)?.[1], shard_index: Number(body.match(/^ {12}shard_index: (\d+)$/mu)?.[1]) }));
  assert.equal(rows.length, 6, 'test all real matrix legs, including branded channels and both Firefox shards');
  const steps = platform.split(/\n(?= {6}- )/u);
  const matches = steps.filter(step => step.startsWith('      - name: Qualify generated views and the saved-dashboard host\n'));
  assert.equal(matches.length, 1);
  const step = matches[0];
  const condition = step.match(/^ {8}if: (.+)$/mu)?.[1];
  assert.ok(condition);
  const owners = rows.filter(row => runInNewContext(condition, { matrix: row }, { timeout: 100 })).map(row => `${row.install_browser}/${row.shard_index}`);
  assert.deepEqual(owners, ['chromium/1', 'firefox/2', 'webkit/1']);
  const download = steps.find(candidate => candidate.includes("name: Download this run's lyra-ui build for the DOCX editor"));
  assert.equal(download.match(/^ {8}if: (.+)$/mu)?.[1], condition, 'the shared UI declarations exist in every selected leg');
  assert.ok(steps.indexOf(download) < steps.indexOf(step));
  assert.match(step, /WTR_BROWSER: \$\{\{ matrix\.install_browser \}\}/u);
  assert.match(step, /WTR_STRICT_CONSOLE: "1"/u);
  assert.ok(step.indexOf('lyra-translations assemble') >= 0, 'real locale catalog tests require the assembled companion');
  assert.ok(step.indexOf('lyra-translations assemble') < step.indexOf('lyra-gen test:browser'));
  assert.ok(step.indexOf('lyra-gen build') < step.indexOf('lyra-gen test:browser'));
  for (const command of ['test:browser', 'test:saved-dashboard']) assert.equal(platform.split(`pnpm --filter @aceshooting/lyra-gen ${command}`).length - 1, 1);
  const visuals = steps.filter(candidate => candidate.startsWith('      - name: Compare recorded generated-view visual baselines\n'));
  assert.equal(visuals.length, 1);
  const visualCondition = visuals[0].match(/^ {8}if: (.+)$/mu)?.[1];
  const visualOwners = rows.filter(row => runInNewContext(visualCondition, { matrix: row }, { timeout: 100 })).map(row => `${row.install_browser}/${row.shard_index}`);
  assert.deepEqual(visualOwners, ['chromium/1']);
  assert.ok(steps.indexOf(visuals[0]) > steps.indexOf(step), 'visuals run after the companion build');
  assert.match(visuals[0], /lyra-gen test:visual --output=/u);
  assert.doesNotMatch(visuals[0], /\$\{\{ runner\.temp \}\}/u, 'a host temp expression is not a container filesystem path');
  assert.match(visuals[0], /mkdir -p artifacts\/gen-recorded-visual/u);
  assert.match(visuals[0], /--output=\.\.\/\.\.\/artifacts\/gen-recorded-visual\/report\.json/u);
  assert.ok(visuals[0].indexOf('mkdir -p') < visuals[0].indexOf('lyra-gen test:visual'));
  const visualArchive = steps.find(candidate => candidate.startsWith('      - name: Archive recorded generated-view visual evidence\n'));
  assert.match(visualArchive, /path: artifacts\/gen-recorded-visual/u);
  assert.equal(platform.split('pnpm --filter @aceshooting/lyra-gen test:visual').length - 1, 1);
  const staticJob = job(workflow, 'static-checks');
  const tests = staticJob.indexOf("pnpm --filter '!@aceshooting/lyra-ui' -r test");
  assert.ok(tests >= 0);
  const assemble = staticJob.indexOf('pnpm --filter @aceshooting/lyra-translations assemble');
  assert.ok(assemble > staticJob.indexOf('path: packages/lyra-ui/dist') && assemble < tests, 'static type checks have built locale package exports');
  for (const command of ['check:catalog', 'check:examples', 'check:bundles']) assert.ok(staticJob.indexOf(`pnpm --filter @aceshooting/lyra-gen ${command}`) > tests, `${command} follows the package build`);
  assert.doesNotMatch(staticJob, /lyra-gen test:(?:browser|saved-dashboard)/u);
  const local = read('scripts/ci.sh');
  const localAssemble = local.indexOf('pnpm --filter @aceshooting/lyra-translations assemble');
  assert.ok(localAssemble > local.indexOf('pnpm build') && localAssemble < local.indexOf('pnpm --filter @aceshooting/lyra-gen lint'), 'local checks assemble catalogs after the UI build');
  assert.match(local, /for gen_browser in chromium firefox webkit; do/u);
  for (const command of ['check:catalog', 'check:examples', 'check:bundles', 'test:browser', 'test:saved-dashboard', 'test:visual']) assert.ok(local.includes(`pnpm --filter @aceshooting/lyra-gen ${command}`));
});

test('companion coverage limits runner occupancy while retaining every complete coverage gate', () => {
  const workflow = read('.github/workflows/ci.yml');
  const producer = job(workflow, 'companion_coverage');
  assert.match(producer, /^ {6}max-parallel: 2$/mu);
  assert.match(producer, /^ {6}fail-fast: false$/mu);
  assert.match(producer, /^ {4}needs: build_and_coverage_build$/mu);
  const packages = producer.match(/^ {8}package: \[([^\]]+)\]$/mu)?.[1].split(',').map(name => name.trim());
  assert.deepEqual(packages, ['lyra-3d', 'lyra-map', 'lyra-flags', 'lyra-ide', 'lyra-translations']);
  assert.match(producer, /name: Run complete companion coverage and its floors/u);
  assert.match(producer, /^ {8}run: pnpm --filter "@aceshooting\/\$COVERAGE_PACKAGE" test:coverage$/mu);
  assert.doesNotMatch(producer, /continue-on-error|allow-lower|COVERAGE_BROWSER: ['"]?0/u);
  for (const name of ['build_and_coverage_coverage_shard', 'build_and_coverage_coverage', 'platform-contracts']) {
    assert.doesNotMatch(job(workflow, name), /\bcompanion_coverage\b/u, `${name} does not wait for companion coverage`);
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
    // GitHub's image proxy gives up after about four seconds and Codecov's flag badge takes longer, so the badge is a
    // shields.io endpoint over the file deploy-docs.yml publishes for the flag; the link still opens the Codecov report.
    // The target stays unencoded: a URL is valid inside a query string as long as it holds no `&`, `#`, `%`, `+` or
    // space, and the package READMEs ship in tarballs whose size ceilings leave only a few bytes of headroom.
    const target = `https://aceshooting.github.io/lyra-ui/badges/coverage-${name}.json`;
    assert.doesNotMatch(target, /[&#%+\s]/u, `${name}: the unencoded endpoint target must need no escaping`);
    const badge = `https://img.shields.io/endpoint?url=${target}`;
    for (const file of [`packages/${name}/README.md`, ...(name === 'lyra-ui' ? ['README.md'] : [])]) {
      const readme = read(file);
      const urls = [...readme.matchAll(/https:\/\/img\.shields\.io\/endpoint\?url=[^\s)]+\/badges\/coverage-[^\s)]+/gu)].map(([url]) => url);
      assert.deepEqual(urls, [badge], `${file} must show exactly its own flag`);
      assert.ok(readme.includes(`[![Coverage](${badge})](https://codecov.io/gh/aceshooting/lyra-ui)`), `${file} keeps its alt text and Codecov link`);
      assert.doesNotMatch(readme, /codecov\.io\/[^\s)]*\/graph\/badge\.svg/u, `${file} must not request Codecov's own badge image`);
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

// The coverage badges deploy-docs.yml publishes beside the Storybook.
//
// The privileged deploy job checks nothing out, so waiting for Codecov and writing the badge files is inline shell and jq. The
// tests run the scripts the workflow really contains, under bash, against a scripted Codecov API and Pages site: a fake `curl`
// answers from a scenario while `sleep` and `date` drive a virtual clock, so the 15-minute bound costs milliseconds.

const DEPLOY_DOCS = '.github/workflows/deploy-docs.yml';
const WAIT_STEP = 'Wait for Codecov and read the coverage totals';
const WRITE_STEP = 'Write the coverage badges';
const HEAD_SHA = '0ac8355c5975ef41eeac3ca3514512dda410d104';
const CLOCK_START = 1_700_000_000;
const hasJq = spawnSync('jq', ['--version']).status === 0;
const needsJq = { skip: !hasJq && 'jq is not installed' };

const deployFlags = () => job(read(DEPLOY_DOCS), 'build').match(/^ {6}BADGE_FLAGS: (.+)$/mu)?.[1].split(' ') ?? [];

// A step of the deploy build job: its text, its literal `run:` script and its `env:` values.
function stepText(workflow, name) {
  const matches = job(workflow, 'build').split(/\n(?= {6}- )/u).filter((step) => step.startsWith(`      - name: ${name}\n`));
  assert.equal(matches.length, 1, `${name} exists exactly once`);
  return matches[0];
}

function stepRun(step) {
  const lines = step.split('\n');
  const start = lines.indexOf('        run: |');
  assert.ok(start >= 0, 'the step has a literal run script');
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line !== '' && !line.startsWith('          ')) break;
    body.push(line.slice(10));
  }
  return `${body.join('\n').replace(/\n+$/u, '')}\n`;
}

function stepEnv(step) {
  const lines = step.split('\n');
  const env = {};
  for (const line of lines.slice(lines.indexOf('        env:') + 1)) {
    const entry = /^ {10}([A-Z_]+): (.+)$/u.exec(line);
    if (!entry) break;
    env[entry[1]] = entry[2].replace(/^'(.*)'$/u, '$1');
  }
  return env;
}

// Runs as the `curl` of the scripts under test (serialized into the shim): answers from the scenario and records each request.
function fakeCurl() {
  const fs = process.getBuiltinModule('node:fs');
  const args = process.argv.slice(2);
  const url = args.at(-1);
  const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const scenario = JSON.parse(fs.readFileSync(process.env.BADGE_SCENARIO, 'utf8'));
  const at = Number(fs.readFileSync(process.env.BADGE_CLOCK, 'utf8'));
  fs.appendFileSync(process.env.BADGE_CALLS, `${JSON.stringify({ url, args: args.slice(0, -1), at })}\n`);
  const uploads = /^https:\/\/api\.codecov\.io\/api\/v2\/github\/aceshooting\/repos\/lyra-ui\/commits\/[0-9a-f]{40}\/uploads\/\?page_size=100$/u;
  const totals = /^https:\/\/api\.codecov\.io\/api\/v2\/github\/aceshooting\/repos\/lyra-ui\/totals\/\?sha=[0-9a-f]{40}&flag=([\w-]+)$/u.exec(url);
  const live = /^https:\/\/aceshooting\.github\.io\/lyra-ui\/badges\/coverage-([\w-]+)\.json$/u.exec(url);
  let reply = { status: 0 };
  if (uploads.test(url)) {
    const counter = `${process.env.BADGE_CALLS}.uploads`;
    const polled = fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0;
    fs.writeFileSync(counter, String(polled + 1));
    reply = scenario.uploads[Math.min(polled, scenario.uploads.length - 1)];
  } else if (totals) {
    reply = scenario.totals[totals[1]] ?? { status: 404, body: '' };
  } else if (live) {
    reply = scenario.live[live[1]] ?? { status: 404, body: '<html>Not Found</html>' };
  }
  if (reply.status === 0) {
    process.stderr.write('curl: (28) Operation timed out\n');
    if (args.includes('--write-out')) process.stdout.write('000');
    process.exit(28);
  }
  const body = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body);
  if (option('--output')) fs.writeFileSync(option('--output'), body);
  else process.stdout.write(body);
  if (args.includes('--write-out')) process.stdout.write(String(reply.status));
}

/**
 * Runs both badge steps in order, as the job does, in a scratch workspace that already holds a downloaded artifact.
 * `uploads` is the list of replies to successive polls of the commit's uploads (the last one repeats).
 */
function runBadgeSteps({ uploads, totals = {}, live = {}, sha = HEAD_SHA, waitEnv = {} }) {
  const workflow = read(DEPLOY_DOCS);
  const flags = deployFlags();
  const dir = mkdtempSync(join(tmpdir(), 'deploy-docs-badges-'));
  try {
    const paths = {
      bin: join(dir, 'bin'),
      runnerTemp: join(dir, 'runner-temp'),
      workspace: join(dir, 'workspace'),
      scenario: join(dir, 'scenario.json'),
      calls: join(dir, 'calls.jsonl'),
      sleeps: join(dir, 'sleeps.txt'),
      clock: join(dir, 'clock.txt'),
    };
    const badgeDirectory = join(paths.workspace, 'storybook-static', 'badges');
    mkdirSync(paths.bin);
    mkdirSync(paths.runnerTemp);
    mkdirSync(badgeDirectory, { recursive: true });
    writeFileSync(join(badgeDirectory, 'stale.txt'), 'left behind by the downloaded artifact');
    writeFileSync(paths.scenario, JSON.stringify({ uploads: Array.isArray(uploads) ? uploads : [uploads], totals, live }));
    writeFileSync(paths.calls, '');
    writeFileSync(paths.sleeps, '');
    writeFileSync(paths.clock, String(CLOCK_START));
    const shims = {
      curl: `#!${process.execPath}\n(${fakeCurl.toString()})();\n`,
      sleep: '#!/bin/sh\necho "$1" >> "$BADGE_SLEEPS"\necho $(( $(cat "$BADGE_CLOCK") + $1 )) > "$BADGE_CLOCK"\n',
      date: '#!/bin/sh\ncat "$BADGE_CLOCK"\n',
    };
    for (const [name, source] of Object.entries(shims)) {
      writeFileSync(join(paths.bin, name), source);
      chmodSync(join(paths.bin, name), 0o755);
    }
    const environment = {
      PATH: `${paths.bin}:${process.env.PATH}`,
      HOME: dir,
      GITHUB_REPOSITORY: 'aceshooting/lyra-ui',
      RUNNER_TEMP: paths.runnerTemp,
      BADGE_FLAGS: flags.join(' '),
      BADGE_SCENARIO: paths.scenario,
      BADGE_CALLS: paths.calls,
      BADGE_SLEEPS: paths.sleeps,
      BADGE_CLOCK: paths.clock,
    };
    const run = (name, extra) => {
      const step = stepText(workflow, name);
      const script = join(dir, `${name.replace(/\W+/gu, '-')}.sh`);
      writeFileSync(script, stepRun(step));
      const { status, stdout, stderr } = spawnSync('bash', [script], {
        cwd: paths.workspace,
        encoding: 'utf8',
        timeout: 120_000,
        env: { ...environment, ...stepEnv(step), ...extra },
      });
      return { status, stdout, stderr };
    };
    const wait = run(WAIT_STEP, { RUN_SHA: sha, ...waitEnv });
    const write = run(WRITE_STEP, {});
    const text = (file) => readFileSync(file, 'utf8');
    const badge = (flag) => join(badgeDirectory, `coverage-${flag}.json`);
    return {
      wait,
      write,
      raw: Object.fromEntries(flags.map((flag) => [flag, existsSync(badge(flag)) ? text(badge(flag)) : null])),
      published: readdirSync(badgeDirectory).sort(),
      calls: text(paths.calls).split('\n').filter(Boolean).map((line) => JSON.parse(line)),
      sleeps: text(paths.sleeps).split('\n').filter(Boolean).map(Number),
      elapsed: Number(text(paths.clock)) - CLOCK_START,
      tree: readdirSync(dir, { recursive: true }),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// What Codecov lists for a commit: a merged coverage upload per flag, the test-results upload that carries the lyra-ui flag but
// never merges, and the carried-forward placeholder that carries no flag.
const record = (flags, state = 'merged', extra = {}) => ({
  flags, state, state_name: state.toUpperCase(), storage_path: 'shelter/github/aceshooting::::lyra-ui/upload.txt', upload_type: 'uploaded', totals: null, ...extra,
});
const NOISE = [
  record(['lyra-ui'], 'processed', { state_name: 'UPLOADED', storage_path: 'test_results/v1/raw/github/upload.txt' }),
  record([], 'processed', { upload_type: 'carriedforward', storage_path: '' }),
];
const listing = (...records) => ({ status: 200, body: { count: records.length + NOISE.length, next: null, previous: null, results: [...records, ...NOISE] } });
const merged = (flags) => listing(...flags.map((flag) => record([flag])));
const totalsReply = (hits, lines) => ({ status: 200, body: { totals: { files: 3, lines, hits, misses: lines - hits, partials: 0, coverage: 0 }, files: [] } });
const priorReply = (message, color = 'blue') => ({ status: 200, body: { schemaVersion: 1, label: 'coverage', message, color } });
const shield = (message, color) => ({ schemaVersion: 1, label: 'CodeCov', message, color, namedLogo: 'codecov' });
const badgesOf = (run) => Object.fromEntries(Object.entries(run.raw).map(([flag, text]) => [flag, text === null ? null : JSON.parse(text)]));
const unknown = shield('unknown', 'lightgrey');

test('the docs deploy finds its artifact beyond the first API page and rejects stale or unavailable builds', needsJq, () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-docs-head-'));
  try {
    const gh = join(dir, 'gh');
    writeFileSync(gh, `#!/bin/bash
set -euo pipefail
if [[ "$*" == *"commits/main"* ]]; then printf '%s\\n' "$MAIN_SHA"; exit; fi
paginate=false
slurp=false
query=''
formatted=false
while (( $# )); do
  case "$1" in
    --paginate) paginate=true ;;
    --slurp) slurp=true ;;
    --jq|-q|--template|-t) formatted=true; shift; query="$1" ;;
  esac
  shift
done
if [[ "$slurp" == true && "$formatted" == true ]]; then
  echo 'the --slurp option is not supported with --jq or --template' >&2
  exit 1
fi
if [[ "$paginate" == true && "$slurp" == true ]]; then
  cat "$ARTIFACT_PAGES"
else
  jq ".[0] | $query" "$ARTIFACT_PAGES"
fi
`);
    chmodSync(gh, 0o755);
    const pagesFile = join(dir, 'pages.json');
    const output = join(dir, 'output');
    const script = stepRun(stepText(read(DEPLOY_DOCS), 'Require the head of main and a Storybook build in that run'));
    const first = { artifacts: Array.from({ length: 30 }, (_, index) => ({ name: `coverage-${index}`, expired: false })) };
    for (const scenario of [
      { artifact: { name: 'storybook-static', expired: false }, main: HEAD_SHA, expected: true },
      { artifact: { name: 'storybook-static', expired: false }, main: '1'.repeat(40), expected: false },
      { artifact: { name: 'storybook-static', expired: true }, main: HEAD_SHA, expected: false },
      { artifact: { name: 'other', expired: false }, main: HEAD_SHA, expected: false },
    ]) {
      writeFileSync(pagesFile, JSON.stringify([first, { artifacts: [scenario.artifact] }]));
      writeFileSync(output, '');
      const result = spawnSync('bash', ['-c', script], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GITHUB_REPOSITORY: 'aceshooting/lyra-ui',
          RUN_ID: '123', RUN_SHA: HEAD_SHA, MAIN_SHA: scenario.main, ARTIFACT_PAGES: pagesFile, GITHUB_OUTPUT: output },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(output, 'utf8'), `current=${scenario.expected}\n`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the docs deploy publishes the coverage badges without loosening its privileged guards', () => {
  const workflow = read(DEPLOY_DOCS);
  const build = job(workflow, 'build');
  const order = ['uses: actions/download-artifact@', `name: ${WAIT_STEP}`, `name: ${WRITE_STEP}`, 'uses: actions/upload-pages-artifact@']
    .map((marker) => build.indexOf(marker));
  assert.ok(order.every((at, index) => at >= 0 && (index === 0 || at > order[index - 1])), 'badges are written after the artifact download and before the Pages upload');

  // The job checks nothing out, so it cannot read codecov.yml: the two flag lists are kept equal here instead.
  const config = read('codecov.yml');
  const declared = [...config.slice(config.indexOf('\nflags:\n'), config.indexOf('\n# Separate product')).matchAll(/^ {2}([\w-]+):\n {4}paths:/gmu)].map(([, flag]) => flag);
  assert.deepEqual([...deployFlags()].sort(), [...declared].sort(), 'one badge per Codecov flag');

  // No new action, secret or checkout: the only `uses:` are the two pinned ones, and the guards at the top stay.
  assert.deepEqual([...build.matchAll(/^ {8}uses: (\S+)/gmu)].map(([, action]) => action.replace(/@[0-9a-f]{40}$/u, '@<sha>')),
    ['actions/download-artifact@<sha>', 'actions/upload-pages-artifact@<sha>']);
  assert.doesNotMatch(build, /secrets\.|actions\/checkout|persist-credentials/u);
  assert.match(build, /^ {4}permissions:\n {6}actions: read\n {6}contents: read\n/mu);

  const waiting = stepText(workflow, WAIT_STEP);
  const writing = stepText(workflow, WRITE_STEP);
  for (const step of [waiting, writing]) {
    assert.match(step, /^ {8}if: steps\.head\.outputs\.current == 'true'$/mu, 'only the head of main gets badges');
    assert.doesNotMatch(stepRun(step), /\$\{\{/u, 'event values reach the shell through env only');
  }
  assert.match(waiting, /^ {8}continue-on-error: true$/mu, 'Codecov stays informational: a failing or hanging step cannot fail the deploy');
  assert.doesNotMatch(writing, /continue-on-error/u, 'the step that writes the files is not allowed to fail silently');
  const env = stepEnv(waiting);
  assert.equal(env.RUN_SHA, '${{ github.event.workflow_run.head_sha }}');
  assert.deepEqual([env.WAIT_SECONDS, env.POLL_SECONDS, env.ABSENT_SECONDS], ['900', '30', '60'], 'waits at most 15 minutes, polling every 30 seconds');
  const timeout = Number(waiting.match(/^ {8}timeout-minutes: (\d+)$/mu)?.[1]);
  assert.ok(timeout * 60 > Number(env.WAIT_SECONDS) + deployFlags().length * 60, 'the step timeout covers the wait plus one full totals request per flag');

  const script = stepRun(waiting);
  assert.match(script, /^\[\[ "\$RUN_SHA" =~ \^\[0-9a-f\]\{40\}\$ \]\] \|\| \{ echo '::error::[^']+'; exit 1; \}$/mu, 'the SHA is exactly 40 lowercase hex characters');
  assert.ok(script.indexOf('[[ "$RUN_SHA" =~') < script.indexOf('curl'), 'the SHA is validated before any request');
  assert.equal([...script.matchAll(/curl /gu)].length, 1, 'one curl wrapper for every Codecov request');
  assert.match(script, /curl --silent --show-error --proto '=https' --max-time/u, 'Codecov is only requested over https');
  assert.match(script, /api\.codecov\.io\/api\/v2\/github\/\$\{GITHUB_REPOSITORY%%\/\*\}\/repos\/\$\{GITHUB_REPOSITORY#\*\/\}/u);

  // The JSON is built by jq from text that matched a strict pattern, with the bands below (the documented 99.74 target on top).
  const output = stepRun(writing);
  assert.match(output, /jq -nc --arg message "\$message" --arg color "\$color" '\{schemaVersion: 1, label: "CodeCov", message: \$message, color: \$color, namedLogo: "codecov"\}'/u);
  assert.match(output, /\[\[ "\$percent" =~ \^\(100\\\.00\|\[0-9\]\{1,2\}\\\.\[0-9\]\{2\}\)\$ \]\]/u);
  const bands = [...output.matchAll(/(?:if|elif) \(\( basis >= (\d+) \)\); then\n\s+color=(\w+)/gu)].map(([, floor, color]) => [Number(floor), color]);
  assert.deepEqual(bands, [[9974, 'brightgreen'], [9900, 'green'], [9800, 'yellowgreen'], [9500, 'yellow'], [9000, 'orange']]);
  assert.match(output, /else\n\s+color=red\n/u);
  for (const [floor, color] of bands) assert.ok(workflow.includes(`>= ${(floor / 100).toFixed(2)} ${color}`), `the workflow header documents the ${color} band`);
  assert.ok(read('docs/agents/ci-and-gates.md').replace(/\s+/gu, ' ').includes(
    'brightgreen from 99.74%, then green from 99, yellowgreen from 98, yellow from 95, orange from 90 and red below'), 'the contributor guide documents the same bands');
});

test('the badge steps publish each flag\'s Codecov figure truncated to two decimals, banded, as compact endpoint JSON', needsJq, () => {
  const figures = {
    'lyra-ui': [521842, 526131], // 99.1847: green
    'lyra-map': [1629, 1630], // 99.9386: 99.93 truncated, 99.94 if it were rounded
    'lyra-3d': [99740, 100000], // exactly 99.74: meets the target
    'lyra-ide': [99739, 100000], // 99.739: must not claim the 99.74 target
    'lyra-docs': [11202, 11223], // 99.8129
    'lyra-flags': [834, 834], // 100.00
    'lyra-translations': [9500, 10000], // 95.00: yellow
  };
  const flags = deployFlags();
  assert.deepEqual(Object.keys(figures).sort(), [...flags].sort());
  const run = runBadgeSteps({
    uploads: merged(flags),
    totals: Object.fromEntries(Object.entries(figures).map(([flag, [hits, lines]]) => [flag, totalsReply(hits, lines)])),
  });
  assert.deepEqual([run.wait.status, run.write.status], [0, 0], `${run.wait.stderr}${run.write.stderr}`);
  assert.deepEqual(badgesOf(run), {
    'lyra-ui': shield('99.18%', 'green'),
    'lyra-map': shield('99.93%', 'brightgreen'),
    'lyra-3d': shield('99.74%', 'brightgreen'),
    'lyra-ide': shield('99.73%', 'green'),
    'lyra-docs': shield('99.81%', 'brightgreen'),
    'lyra-flags': shield('100.00%', 'brightgreen'),
    'lyra-translations': shield('95.00%', 'yellow'),
  });
  assert.equal(run.raw['lyra-ui'], '{"schemaVersion":1,"label":"CodeCov","message":"99.18%","color":"green","namedLogo":"codecov"}\n');
  assert.deepEqual(run.published, flags.map((flag) => `coverage-${flag}.json`).sort(), 'exactly one file per flag, and nothing the artifact held under badges/');

  // Everything is already merged: no waiting, one poll, one totals request per flag, all over https and never through a redirect.
  assert.deepEqual([run.sleeps, run.elapsed], [[], 0]);
  const api = 'https://api.codecov.io/api/v2/github/aceshooting/repos/lyra-ui';
  assert.deepEqual(run.calls.map((call) => call.url), [
    `${api}/commits/${HEAD_SHA}/uploads/?page_size=100`,
    ...flags.map((flag) => `${api}/totals/?sha=${HEAD_SHA}&flag=${flag}`),
  ]);
  for (const call of run.calls) {
    assert.equal(call.args[call.args.indexOf('--proto') + 1], '=https');
    assert.ok(!call.args.includes('--location'));
  }
});

test('the badge step waits for a flag Codecov has not merged yet, then republishes the previous figure when it never is', needsJq, () => {
  const flags = deployFlags();
  const others = flags.filter((flag) => flag !== 'lyra-ui');
  const pending = listing(...others.map((flag) => record([flag])), record(['lyra-ui'], 'processed'));
  const ready = merged(flags);
  const figures = { 'lyra-ui': totalsReply(521842, 526131) };

  const arrives = runBadgeSteps({ uploads: [pending, pending, ready], totals: figures });
  assert.deepEqual([arrives.wait.status, arrives.write.status], [0, 0]);
  assert.deepEqual(arrives.sleeps, [30, 30], 'polls every 30 seconds');
  assert.deepEqual(arrives.calls.filter((call) => call.url.includes('/uploads/')).map((call) => call.at - CLOCK_START), [0, 30, 60]);
  assert.deepEqual(badgesOf(arrives)['lyra-ui'], shield('99.18%', 'green'));

  // Never merged: at the bound the previously deployed figure is republished, banded again (the old colour is not trusted).
  // A shorter bound keeps this fast; the outage test below runs the real 15 minutes.
  const stuck = runBadgeSteps({ uploads: [pending], totals: figures, live: { 'lyra-ui': priorReply('98.98%', 'blue') }, waitEnv: { WAIT_SECONDS: '120' } });
  assert.deepEqual([stuck.wait.status, stuck.write.status], [0, 0]);
  assert.deepEqual([stuck.sleeps, stuck.elapsed], [[30, 30, 30, 30], 120]);
  assert.match(stuck.wait.stdout, /::warning::Codecov had not merged the uploads for: lyra-ui\n/u);
  assert.equal(stuck.calls.filter((call) => call.url.includes('/totals/?')).some((call) => call.url.endsWith('flag=lyra-ui')), false, 'no totals are read for an unmerged flag');
  assert.deepEqual(badgesOf(stuck)['lyra-ui'], shield('98.98%', 'yellowgreen'));
  const prior = stuck.calls.find((call) => call.url.startsWith('https://aceshooting.github.io/'));
  assert.equal(prior.url, 'https://aceshooting.github.io/lyra-ui/badges/coverage-lyra-ui.json');
  assert.ok(prior.args.includes('--location'), 'the github.io address redirects to the account domain');
});

test('a flag with no upload for the commit (a docs-only push) is not waited for beyond a minute', needsJq, () => {
  const flags = deployFlags();
  const withoutUi = merged(flags.filter((flag) => flag !== 'lyra-ui'));
  const totals = Object.fromEntries(flags.map((flag) => [flag, totalsReply(100, 100)]));
  const run = runBadgeSteps({ uploads: [withoutUi], totals, live: { 'lyra-ui': priorReply('99.18%') } });
  assert.deepEqual([run.wait.status, run.write.status], [0, 0]);
  assert.deepEqual([run.sleeps, run.elapsed], [[30, 30], 60]);
  const badges = badgesOf(run);
  assert.deepEqual(badges['lyra-ui'], shield('99.18%', 'green'), 'the figure of the last commit that had coverage stays');
  assert.deepEqual(badges['lyra-map'], shield('100.00%', 'brightgreen'));
  assert.equal(run.calls.some((call) => call.url.endsWith('flag=lyra-ui')), false, 'the empty answer Codecov gives for an absent flag is never read');
  assert.match(run.write.stdout, /::warning::Codecov gave no figure for lyra-ui; publishing 99.18% from the previous deploy\./u);

  // Codecov has not heard of the commit at all (HTTP 404): every flag is absent, the same minute applies.
  const unheard = runBadgeSteps({ uploads: [{ status: 404, body: { detail: 'The commit is not in our records.' } }], live: { 'lyra-ide': priorReply('100.00%') } });
  assert.deepEqual([unheard.wait.status, unheard.write.status, unheard.elapsed], [0, 0, 60]);
  assert.deepEqual(badgesOf(unheard)['lyra-ide'], shield('100.00%', 'brightgreen'));
  assert.deepEqual(badgesOf(unheard)['lyra-ui'], unknown);
});

test('a Codecov outage never fails the deploy: previous figures stay, "unknown" on grey when there are none', needsJq, () => {
  const live = { 'lyra-ui': priorReply('99.18%'), 'lyra-3d': priorReply('100.00%') };
  const expected = (run) => {
    assert.deepEqual([run.wait.status, run.write.status], [0, 0], `${run.wait.stderr}${run.write.stderr}`);
    assert.deepEqual(badgesOf(run), {
      'lyra-ui': shield('99.18%', 'green'),
      'lyra-map': unknown,
      'lyra-3d': shield('100.00%', 'brightgreen'),
      'lyra-docs': unknown,
      'lyra-flags': unknown,
      'lyra-ide': unknown,
      'lyra-translations': unknown,
    });
  };
  const down = runBadgeSteps({ uploads: [{ status: 503, body: 'Service Unavailable' }], live });
  expected(down);
  assert.equal(down.elapsed, 900, 'an unreachable API is retried until the 15-minute bound');
  assert.equal(down.calls.filter((call) => call.url.includes('/totals/?')).length, 0);
  // The same end state when the transfer itself fails or the answer is not the API's JSON (faster: shorter bound).
  for (const uploads of [{ status: 0 }, { status: 200, body: '<html>maintenance</html>' }, { status: 200, body: '{"results":' }]) {
    expected(runBadgeSteps({ uploads: [uploads], live, waitEnv: { WAIT_SECONDS: '60' } }));
  }
});

test('totals that cannot be a percentage are never published as one', needsJq, () => {
  const flags = deployFlags();
  const run = runBadgeSteps({
    uploads: merged(flags),
    totals: {
      'lyra-ui': totalsReply(0, 0), // what Codecov answers for a flag without data: zero lines
      'lyra-map': totalsReply(1631, 1630), // more hits than lines
      'lyra-3d': { status: 200, body: { totals: { hits: '5044', lines: '5050' } } }, // strings
      'lyra-docs': { status: 500, body: 'Internal Server Error' },
      'lyra-flags': { status: 200, body: '<html>maintenance</html>' },
      'lyra-ide': { status: 200, body: { totals: { hits: 89.5, lines: 89 } } }, // not whole numbers
      'lyra-translations': totalsReply(133, 133),
    },
    live: { 'lyra-ui': priorReply('99.18%'), 'lyra-map': priorReply('99.93%') },
  });
  assert.deepEqual([run.wait.status, run.write.status], [0, 0], `${run.wait.stderr}${run.write.stderr}`);
  assert.deepEqual(badgesOf(run), {
    'lyra-ui': shield('99.18%', 'green'),
    'lyra-map': shield('99.93%', 'brightgreen'),
    'lyra-3d': unknown,
    'lyra-docs': unknown,
    'lyra-flags': unknown,
    'lyra-ide': unknown,
    'lyra-translations': shield('100.00%', 'brightgreen'),
  });
  assert.match(run.wait.stdout, /::warning::Codecov returned no usable totals for lyra-ui \(HTTP 200\)\./u);
  assert.match(run.wait.stdout, /::warning::Codecov returned no usable totals for lyra-docs \(HTTP 500\)\./u);
  assert.doesNotMatch(Object.values(run.raw).join(''), /NaN|Infinity|null|"0(?:\.00)?%"/u, 'no figure was invented from empty or malformed totals');
});

test('a previously deployed figure is untrusted input: only a bare percentage survives, and nothing is evaluated', needsJq, () => {
  const marker = 'PWNED';
  const live = {
    'lyra-ui': priorReply(`a[$(touch ${marker})]%`), // would run in a bash arithmetic context
    'lyra-map': priorReply('100.01%'),
    'lyra-3d': priorReply('99.18% <img src=x>'),
    'lyra-docs': priorReply('-1.00%'),
    'lyra-flags': priorReply('99.1%'),
    'lyra-ide': { status: 200, body: { schemaVersion: 1, label: 'coverage', message: { nested: true }, color: `$(touch ${marker})` } },
    'lyra-translations': priorReply('100.00%', `$(touch ${marker})`),
  };
  const run = runBadgeSteps({ uploads: [{ status: 404, body: {} }], live, waitEnv: { WAIT_SECONDS: '60' } });
  assert.deepEqual([run.wait.status, run.write.status], [0, 0], `${run.wait.stderr}${run.write.stderr}`);
  assert.deepEqual(badgesOf(run), {
    'lyra-ui': unknown,
    'lyra-map': unknown,
    'lyra-3d': unknown,
    'lyra-docs': unknown,
    'lyra-flags': unknown,
    'lyra-ide': unknown,
    'lyra-translations': shield('100.00%', 'brightgreen'),
  });
  assert.equal(run.tree.some((entry) => entry.endsWith(marker)), false, 'nothing from the answer was executed');
});

test('a head SHA that is not exactly 40 lowercase hex characters stops the Codecov step before any request, and the badges are still written', needsJq, () => {
  for (const sha of [HEAD_SHA.toUpperCase(), HEAD_SHA.slice(1), `${HEAD_SHA}0`, `${HEAD_SHA}\n`, `$(touch PWNED)${HEAD_SHA.slice(14)}`, '']) {
    const run = runBadgeSteps({ uploads: [merged(deployFlags())], sha, live: { 'lyra-ui': priorReply('99.18%') } });
    assert.equal(run.wait.status, 1, JSON.stringify(sha));
    assert.match(run.wait.stdout, /^::error::The CI run head SHA is not 40 lowercase hex characters\.$/mu);
    assert.deepEqual(run.calls.filter((call) => call.url.startsWith('https://api.codecov.io/')), [], 'no request is built from an unvalidated SHA');
    assert.equal(run.write.status, 0);
    assert.deepEqual(badgesOf(run)['lyra-ui'], shield('99.18%', 'green'));
    assert.deepEqual(badgesOf(run)['lyra-map'], unknown);
    assert.equal(run.tree.some((entry) => entry.endsWith('PWNED')), false);
  }
});
