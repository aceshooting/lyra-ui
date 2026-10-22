import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  annotationsFor,
  describeRun,
  evaluateHunt,
  expensiveTestFiles,
  parseFailureReport,
  renderMarkdown,
  summarizeRuns,
} from './flake-hunt.mjs';

test('picks the costliest files that still exist, breaking ties by path', () => {
  const costs = new Map([
    ['src/a.test.ts', 5],
    ['src/b.test.ts', 9],
    ['src/removed.test.ts', 100],
    ['src/c.test.ts', 9],
    ['src/d.test.ts', 1],
  ]);
  const available = ['src/a.test.ts', 'src/b.test.ts', 'src/c.test.ts', 'src/d.test.ts', 'src/unlisted.test.ts'];
  assert.deepEqual(expensiveTestFiles({ count: 3, costs, available }), ['src/b.test.ts', 'src/c.test.ts', 'src/a.test.ts']);
  assert.deepEqual(expensiveTestFiles({ count: 10, costs, available }).length, 4, 'files absent from the table or the tree are never invented');
});

const reportText = [
  { type: 'failure', file: 'src/a.test.ts', test: 'outer > fails', message: 'Timeout of 6000ms exceeded' },
  { type: 'error', file: 'src/b.test.ts', message: 'Uncaught TypeError: x' },
  { type: 'file', file: 'src/a.test.ts', tests: 4, failed: 1 },
  { type: 'file', file: 'src/b.test.ts', tests: 0, failed: 0 },
].map((line) => JSON.stringify(line)).join('\n');

test('parses the failure report lines', () => {
  const report = parseFailureReport(`${reportText}\n\n`);
  assert.deepEqual(report.failures, [{ file: 'src/a.test.ts', test: 'outer > fails', message: 'Timeout of 6000ms exceeded' }]);
  assert.deepEqual(report.errors, [{ file: 'src/b.test.ts', message: 'Uncaught TypeError: x' }]);
  assert.deepEqual([...report.files], [['src/a.test.ts', { tests: 4, failed: 1 }], ['src/b.test.ts', { tests: 0, failed: 0 }]]);
  assert.deepEqual(parseFailureReport('').failures, []);
});

test('folds runs into failing tests with their counts and flags runs that lost files', () => {
  const expectedFiles = ['src/a.test.ts', 'src/b.test.ts', 'src/c.test.ts'];
  const first = describeRun({ engine: 'chromium', run: 1, status: 1, seconds: 90, report: parseFailureReport(reportText), expectedFiles });
  const second = describeRun({ engine: 'chromium', run: 2, status: 0, seconds: 88, report: parseFailureReport(''), expectedFiles: [] });
  assert.equal(first.tests, 4);
  assert.deepEqual(first.missing, ['src/c.test.ts'], 'a file the run never reported is called out');
  const summary = summarizeRuns([first, second]);
  assert.deepEqual(summary.failing.map(({ test, runs }) => [test, runs]), [
    ['outer > fails', ['chromium #1']],
    ['(file-level error)', ['chromium #1']],
  ]);
  assert.deepEqual(summary.incomplete.map((run) => run.run), [1]);
});

test('renders a table of failures, and a clean sentence when nothing failed', () => {
  const expectedFiles = ['src/a.test.ts', 'src/b.test.ts'];
  const run = describeRun({ engine: 'chromium', run: 1, status: 1, seconds: 90, report: parseFailureReport(reportText), expectedFiles });
  const markdown = renderMarkdown({ runs: [run], summary: summarizeRuns([run]), files: expectedFiles });
  assert.match(markdown, /1 run\(s\) on chromium of the 2 most expensive test files/u);
  assert.match(markdown, /\| outer > fails \| `src\/a\.test\.ts` \| 1 of 1 \(chromium #1\) \| Timeout of 6000ms exceeded \|/u);

  const clean = describeRun({ engine: 'chromium', run: 1, status: 0, seconds: 80, report: parseFailureReport(
    JSON.stringify({ type: 'file', file: 'src/a.test.ts', tests: 3, failed: 0 })), expectedFiles: ['src/a.test.ts'] });
  assert.match(renderMarkdown({ runs: [clean], summary: summarizeRuns([clean]), files: ['src/a.test.ts'] }), /No test failed on its first attempt\./u);
});

test('escapes table separators and line breaks in an error message', () => {
  const report = parseFailureReport(JSON.stringify({ type: 'failure', file: 'src/a.test.ts', test: 'a | b', message: 'x | y' }));
  const run = describeRun({ engine: 'webkit', run: 2, status: 1, seconds: 1, report, expectedFiles: [] });
  const markdown = renderMarkdown({ runs: [run], summary: summarizeRuns([run]), files: ['src/a.test.ts'] });
  assert.match(markdown, /\| a \\\| b \|/u);
  assert.match(markdown, /\| x \\\| y \|/u);
});

// Three runs of the same files, as the release workflow does. `failingIn` lists the runs (1-based) in which
// `test` failed its first attempt; every run reports both files, so none counts as incomplete.
function huntRuns({ failures = [], expectedFiles = ['src/a.test.ts', 'src/b.test.ts'], runs = 3 } = {}) {
  return Array.from({ length: runs }, (_, index) => {
    const lines = [
      ...failures
        .filter(({ failingIn }) => failingIn.includes(index + 1))
        .map(({ file, test, message }) => ({ type: 'failure', file, test, message })),
      ...expectedFiles.map((file) => ({ type: 'file', file, tests: 5, failed: 0 })),
    ];
    return describeRun({
      engine: 'chromium', run: index + 1, status: lines.some((line) => line.type === 'failure') ? 1 : 0, seconds: 60,
      report: parseFailureReport(lines.map((line) => JSON.stringify(line)).join('\n')), expectedFiles,
    });
  });
}
const files = ['src/a.test.ts', 'src/b.test.ts'];
const broken = { file: 'src/a.test.ts', test: 'always > broken', message: 'expected 1 to equal 2', failingIn: [1, 2, 3] };
const brokenTwice = { file: 'src/a.test.ts', test: 'twice > broken', message: 'timed out', failingIn: [1, 3] };
const flaky = { file: 'src/b.test.ts', test: 'sometimes > flaky', message: 'Timeout of 6000ms exceeded', failingIn: [2] };

test('a test that fails its first attempt in two or more of three runs is broken; one failure is only flaky', () => {
  const summary = summarizeRuns(huntRuns({ failures: [broken, brokenTwice, flaky] }));
  assert.deepEqual(summary.broken.map(({ test }) => test), ['always > broken', 'twice > broken']);
  assert.deepEqual(summary.flaky.map(({ test }) => test), ['sometimes > flaky']);
  assert.deepEqual(summary.failing.map(({ test }) => test), ['always > broken', 'twice > broken', 'sometimes > flaky'],
    'failing keeps every test, most frequent first, whatever its verdict');
  // The threshold is a parameter: three-of-three only, or any single failure.
  assert.deepEqual(summarizeRuns(huntRuns({ failures: [broken, brokenTwice] }), { brokenAfter: 3 }).broken.map(({ test }) => test), ['always > broken']);
  assert.deepEqual(summarizeRuns(huntRuns({ failures: [flaky] }), { brokenAfter: 1 }).broken.map(({ test }) => test), ['sometimes > flaky']);
});

test('a file-level error counts like a failing test: twice is broken', () => {
  const runs = [1, 2, 3].map((run) => describeRun({
    engine: 'chromium', run, status: 1, seconds: 5, expectedFiles: ['src/a.test.ts'],
    report: parseFailureReport([
      run === 3 ? null : { type: 'error', file: 'src/a.test.ts', message: 'Uncaught TypeError: x' },
      { type: 'file', file: 'src/a.test.ts', tests: 0, failed: 0 },
    ].filter(Boolean).map((line) => JSON.stringify(line)).join('\n')),
  }));
  assert.deepEqual(summarizeRuns(runs).broken.map(({ test }) => test), ['(file-level error)']);
});

test('the job passes with a clean hunt or a single flake, and fails on a broken test, a lost file, or --fail-on-failure', () => {
  const outcome = (options) => evaluateHunt({ files, brokenAfter: 2, failOnFailure: false, ...options });
  assert.equal(outcome({ runs: huntRuns() }).exitCode, 0, 'a clean hunt passes');
  assert.equal(outcome({ runs: huntRuns({ failures: [flaky] }) }).exitCode, 0, 'a 1-of-3 flake is a warning, not a failure');
  assert.equal(outcome({ runs: huntRuns({ failures: [flaky] }), failOnFailure: true }).exitCode, 1, 'strict mode fails on any first-attempt failure');
  assert.equal(outcome({ runs: huntRuns({ failures: [brokenTwice] }) }).exitCode, 1, 'two of three runs is a broken test');
  assert.equal(outcome({ runs: huntRuns({ failures: [broken, flaky] }) }).exitCode, 1);
  // A run that never reported a file proves nothing about it: the harness broke, so the job must not pass.
  const lost = huntRuns();
  lost[1] = describeRun({ engine: 'chromium', run: 2, status: 1, seconds: 3, report: parseFailureReport(''), expectedFiles: files });
  assert.equal(outcome({ runs: lost }).exitCode, 1);
  assert.match(outcome({ runs: lost }).markdown, /did not report 2 file\(s\)/u);
});

test('writes GitHub annotations: an error per broken test, a warning per flaky one, an error per lost run', () => {
  const lines = annotationsFor(summarizeRuns(huntRuns({ failures: [broken, flaky] })), { runCount: 3 });
  assert.deepEqual(lines, [
    '::error title=Broken test (3 of 3 runs),file=src/a.test.ts::always > broken failed its first attempt in 3 of 3 runs: expected 1 to equal 2',
    '::warning title=Flaky test (1 of 3 runs),file=src/b.test.ts::sometimes > flaky failed its first attempt in 1 of 3 runs: Timeout of 6000ms exceeded',
  ]);
  // Workflow-command escaping: a newline, `%`, `:` or `,` in a message or title must not end the command early.
  const hostile = summarizeRuns(huntRuns({ failures: [{ file: 'src/a.test.ts', test: 'x', message: '50% done\nnext: a,b', failingIn: [1] }] }));
  const [line] = annotationsFor(hostile, { runCount: 3 });
  assert.ok(!line.includes('\n'), 'a newline would start a second command');
  assert.match(line, /50%25 done%0Anext: a,b$/u);
  const lostRun = huntRuns();
  lostRun[0] = describeRun({ engine: 'chromium', run: 1, status: 1, seconds: 3, report: parseFailureReport(''), expectedFiles: files });
  assert.deepEqual(annotationsFor(summarizeRuns(lostRun), { runCount: 3 }), [
    '::error title=Flake hunt incomplete::chromium #1 did not report 2 file(s) (exit 1); a test that never ran cannot be called stable.',
  ]);
});

test('the summary states the verdict rule and separates broken tests from flaky ones', () => {
  const runs = huntRuns({ failures: [broken, flaky] });
  const markdown = renderMarkdown({ runs, summary: summarizeRuns(runs), files, brokenAfter: 2 });
  assert.match(markdown, /The job fails when a test fails its first attempt in 2 or more of the 3 runs/u);
  assert.match(markdown, /### Broken tests[\s\S]*always > broken[\s\S]*### Flaky tests[\s\S]*sometimes > flaky/u);
  assert.doesNotMatch(markdown, /No test failed on its first attempt/u);
  const flakyOnly = huntRuns({ failures: [flaky] });
  const flakyMarkdown = renderMarkdown({ runs: flakyOnly, summary: summarizeRuns(flakyOnly), files, brokenAfter: 2 });
  assert.doesNotMatch(flakyMarkdown, /### Broken tests/u);
  assert.match(flakyMarkdown, /### Flaky tests/u);
});

// End to end: the real command line against a package directory whose `wtr` is a script that replays
// scripted per-run outcomes, so the arguments, the environment, the failure-report plumbing, the
// annotations and the exit status are all the code that runs in CI.
const FAKE_WTR = `#!/usr/bin/env node
const fs = require('node:fs');
const scenario = JSON.parse(fs.readFileSync(process.env.FAKE_SCENARIO, 'utf8'));
const counter = process.env.FAKE_SCENARIO + '.count';
const run = (fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0) + 1;
fs.writeFileSync(counter, String(run));
fs.appendFileSync(process.env.FAKE_SCENARIO + '.env', JSON.stringify({ run, retries: process.env.WTR_RETRIES, browser: process.env.WTR_BROWSER, strict: process.env.WTR_STRICT_CONSOLE, concurrency: process.env.WTR_CONCURRENCY, files: process.argv.slice(2) }) + '\\n');
const files = process.argv.slice(2);
const lines = [];
for (const file of files) {
  if (scenario.lose && scenario.lose.run === run && scenario.lose.file === file) continue;
  for (const failure of scenario.failures) if (failure.file === file && failure.runs.includes(run)) lines.push({ type: 'failure', file, test: failure.test, message: failure.message });
  lines.push({ type: 'file', file, tests: 3, failed: scenario.failures.filter((failure) => failure.file === file && failure.runs.includes(run)).length });
}
fs.appendFileSync(process.env.WTR_FAILURE_REPORT, lines.map((line) => JSON.stringify(line) + '\\n').join(''));
process.exit(lines.some((line) => line.type === 'failure') ? 1 : 0);
`;

function runCommandLine(scenario, args = []) {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = mkdtempSync(join(tmpdir(), 'lyra-flake-hunt-'));
  try {
    mkdirSync(join(root, 'scripts', 'fixtures'), { recursive: true });
    for (const name of ['flake-hunt.mjs', 'ci-costs.mjs', 'full-engine-shard.mjs', 'is-main-module.mjs']) copyFileSync(join(here, name), join(root, 'scripts', name));
    writeFileSync(join(root, 'scripts', 'fixtures', 'test-file-costs.json'), JSON.stringify({ 'src/a.test.ts': 9, 'src/b.test.ts': 5 }));
    mkdirSync(join(root, 'src'), { recursive: true });
    for (const name of ['a', 'b']) writeFileSync(join(root, 'src', `${name}.test.ts`), '');
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(join(root, 'node_modules', '.bin', 'wtr'), FAKE_WTR);
    chmodSync(join(root, 'node_modules', '.bin', 'wtr'), 0o755);
    const scenarioFile = join(root, 'scenario.json');
    writeFileSync(scenarioFile, JSON.stringify(scenario));
    const summaryFile = join(root, 'step-summary.md');
    const result = spawnSync(process.execPath, [join(root, 'scripts', 'flake-hunt.mjs'), '--count', '2', '--runs', '3', '--output-dir', join(root, 'out'), ...args], {
      encoding: 'utf8', env: { ...process.env, FAKE_SCENARIO: scenarioFile, GITHUB_STEP_SUMMARY: summaryFile },
    });
    const read = (file) => { try { return readFileSync(file, 'utf8'); } catch { return ''; } };
    return { ...result, summary: read(summaryFile), invocations: read(`${scenarioFile}.env`).split('\n').filter(Boolean).map((line) => JSON.parse(line)) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the command line passes a clean hunt and a single flake with a warning annotation', () => {
  const clean = runCommandLine({ failures: [] });
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(clean.invocations.length, 3, 'three runs');
  assert.deepEqual(clean.invocations[0], { run: 1, retries: '0', browser: 'chromium', strict: '1', concurrency: '4', files: ['src/a.test.ts', 'src/b.test.ts'] });
  assert.match(clean.summary, /No test failed on its first attempt\./u);

  const flaky = runCommandLine({ failures: [{ file: 'src/b.test.ts', test: 'sometimes', message: 'Timeout of 6000ms exceeded', runs: [2] }] });
  assert.equal(flaky.status, 0, 'one failure in three runs must not fail the job');
  assert.match(flaky.stdout, /::warning title=Flaky test \(1 of 3 runs\),file=src\/b\.test\.ts::sometimes failed its first attempt in 1 of 3 runs: Timeout of 6000ms exceeded/u);
  assert.match(flaky.summary, /### Flaky tests \(warning\)/u, 'the job summary carries the findings');
  assert.equal(runCommandLine({ failures: [{ file: 'src/b.test.ts', test: 'sometimes', message: 'x', runs: [2] }] }, ['--fail-on-failure']).status, 1, 'strict mode fails on a flake');
});

test('the command line fails on a test broken in two of three runs, on a lost file, and respects --broken-after', () => {
  const broken = runCommandLine({ failures: [{ file: 'src/a.test.ts', test: 'always', message: 'expected 1 to equal 2', runs: [1, 3] }] });
  assert.equal(broken.status, 1, 'two of three runs is broken');
  assert.match(broken.stdout, /::error title=Broken test \(2 of 3 runs\),file=src\/a\.test\.ts::always failed its first attempt in 2 of 3 runs: expected 1 to equal 2/u);
  assert.match(broken.summary, /### Broken tests \(the job fails\)/u);
  assert.equal(runCommandLine({ failures: [{ file: 'src/a.test.ts', test: 'always', message: 'x', runs: [1, 3] }] }, ['--broken-after', '3']).status, 0, 'a threshold of three tolerates two failures');

  const lost = runCommandLine({ failures: [], lose: { run: 2, file: 'src/b.test.ts' } });
  assert.equal(lost.status, 1, 'a file that never reported is a harness failure');
  assert.match(lost.stdout, /::error title=Flake hunt incomplete::chromium #2 did not report 1 file\(s\)/u);
});
