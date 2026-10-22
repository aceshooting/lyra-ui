#!/usr/bin/env node
// Flake hunt: runs the most expensive test files repeatedly with mocha's retry switched off
// (`WTR_RETRIES=0`) so a test that only passes on its second attempt shows up as a failure.
//
// Verdicts, over the runs of one invocation (the "Quality tools" workflow does three):
//   broken  a test fails its first attempt in `--broken-after` (default 2) or more runs: the job fails;
//   flaky   a test fails its first attempt in fewer runs: reported as a warning annotation, job passes;
//   lost    a run never reported some file (the harness crashed, so those files proved nothing): the job fails.
// `--fail-on-failure` also fails the job on a flaky test, for a strict local run.
//
//   node scripts/flake-hunt.mjs [--count 40] [--runs 3] [--engine chromium] [--concurrency 4]
//                               [--broken-after 2] [--fail-on-failure]
//                               [--output-dir .quality-tools/flake-hunt] [--summary <markdown file>]
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCosts } from './ci-costs.mjs';
import { discoverTestFiles } from './full-engine-shard.mjs';
import { isMainModule } from './is-main-module.mjs';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_COUNT = 40;
const DEFAULT_RUNS = 3;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_BROKEN_AFTER = 2;

const comparePaths = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

/** The `count` most expensive files of the committed cost table that still exist, costliest first. */
export function expensiveTestFiles({ count = DEFAULT_COUNT, costs, available }) {
  const present = new Set(available);
  return [...costs]
    .filter(([file]) => present.has(file))
    .sort(([leftFile, left], [rightFile, right]) => right - left || comparePaths(leftFile, rightFile))
    .slice(0, count)
    .map(([file]) => file);
}

/** Parses the JSON lines written by `scripts/wtr-failure-reporter.mjs` for one wtr run. */
export function parseFailureReport(text) {
  const failures = [];
  const errors = [];
  const files = new Map();
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (record.type === 'failure') failures.push({ file: record.file, test: record.test, message: record.message });
    else if (record.type === 'error') errors.push({ file: record.file, message: record.message });
    else if (record.type === 'file') files.set(record.file, { tests: record.tests, failed: record.failed });
  }
  return { failures, errors, files };
}

/** One run's outcome: what failed, and which requested files never reported (a crashed run). */
export function describeRun({ engine, run, status, seconds, report, expectedFiles }) {
  const missing = expectedFiles.filter((file) => !report.files.has(file));
  return {
    engine,
    run,
    status,
    seconds,
    tests: [...report.files.values()].reduce((sum, entry) => sum + entry.tests, 0),
    failures: report.failures,
    errors: report.errors,
    missing,
  };
}

/**
 * Folds the runs into one list of failing tests with how often each failed. A test that failed its
 * first attempt in `brokenAfter` or more runs is `broken` (a real defect); one that failed in fewer
 * is `flaky`. `failing` holds both, most frequent first.
 */
export function summarizeRuns(runs, { brokenAfter = DEFAULT_BROKEN_AFTER } = {}) {
  const byTest = new Map();
  const note = (key, entry, run) => {
    const known = byTest.get(key) ?? { ...entry, runs: [] };
    if (!known.runs.includes(run)) known.runs.push(run);
    byTest.set(key, known);
  };
  for (const run of runs) {
    const label = `${run.engine} #${run.run}`;
    for (const failure of run.failures) note(`${failure.file} :: ${failure.test}`, { file: failure.file, test: failure.test, message: failure.message }, label);
    for (const error of run.errors) note(`${error.file} :: (file-level error)`, { file: error.file, test: '(file-level error)', message: error.message }, label);
  }
  const failing = [...byTest.values()].sort((left, right) => right.runs.length - left.runs.length || comparePaths(left.file + left.test, right.file + right.test));
  return {
    failing,
    broken: failing.filter((entry) => entry.runs.length >= brokenAfter),
    flaky: failing.filter((entry) => entry.runs.length < brokenAfter),
    incomplete: runs.filter((run) => run.missing.length > 0),
  };
}

/** The Markdown written to the job summary. */
export function renderMarkdown({ runs, summary, files, brokenAfter = DEFAULT_BROKEN_AFTER }) {
  const out = ['## Flake hunt', ''];
  const engines = [...new Set(runs.map((run) => run.engine))].join(', ');
  out.push(`${runs.length} run(s) on ${engines} of the ${files.length} most expensive test files with \`WTR_RETRIES=0\` (a test must pass on its first attempt).`, '');
  out.push(`The job fails when a test fails its first attempt in ${brokenAfter} or more of the ${runs.length} runs (a broken test) or when a run loses a file; a test that fails in fewer runs is flaky and is reported as a warning.`, '');
  out.push('| Run | Exit | Seconds | Tests | Failed | File errors | Files not reported |', '|---|---|---|---|---|---|---|');
  for (const run of runs) {
    out.push(`| ${run.engine} #${run.run} | ${run.status} | ${run.seconds} | ${run.tests} | ${run.failures.length} | ${run.errors.length} | ${run.missing.length} |`);
  }
  out.push('');
  if (summary.failing.length === 0 && summary.incomplete.length === 0) {
    out.push('No test failed on its first attempt.');
  }
  const cell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  const table = (heading, entries) => {
    if (entries.length === 0) return;
    out.push(heading, '', '| Test | File | Failed in | First line of the error |', '|---|---|---|---|');
    for (const entry of entries) {
      out.push(`| ${cell(entry.test)} | \`${entry.file}\` | ${entry.runs.length} of ${runs.length} (${entry.runs.join(', ')}) | ${cell(entry.message)} |`);
    }
    out.push('');
  };
  table('### Broken tests (the job fails)', summary.broken);
  table('### Flaky tests (warning)', summary.flaky);
  if (summary.failing.length > 0) {
    out.push('Reproduce one with `WTR_RETRIES=0 pnpm --filter @aceshooting/lyra-ui exec wtr --files <file>`; `docs/agents/testing.md` lists the usual causes.');
  }
  for (const run of summary.incomplete) {
    out.push('', `### ${run.engine} #${run.run} did not report ${run.missing.length} file(s) (exit ${run.status})`, '', ...run.missing.map((file) => `- \`${file}\``));
  }
  return `${out.join('\n')}\n`;
}

// GitHub workflow commands end at the first newline; `%`, newline and (in a property) `:` and `,` are escaped.
const escapeData = (value) => String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
const escapeProperty = (value) => escapeData(value).replaceAll(':', '%3A').replaceAll(',', '%2C');

/** One workflow-command line per finding: an error for each broken test and lost run, a warning for each flaky test. */
export function annotationsFor(summary, { runCount }) {
  const lines = [];
  const verdict = (kind, title, entry) => lines.push(
    `::${kind} title=${escapeProperty(`${title} (${entry.runs.length} of ${runCount} runs)`)},file=${escapeProperty(entry.file)}::${escapeData(`${entry.test} failed its first attempt in ${entry.runs.length} of ${runCount} runs: ${entry.message}`)}`,
  );
  for (const entry of summary.broken) verdict('error', 'Broken test', entry);
  for (const entry of summary.flaky) verdict('warning', 'Flaky test', entry);
  for (const run of summary.incomplete) {
    lines.push(`::error title=Flake hunt incomplete::${escapeData(`${run.engine} #${run.run} did not report ${run.missing.length} file(s) (exit ${run.status}); a test that never ran cannot be called stable.`)}`);
  }
  return lines;
}

/** Everything the command line prints and decides once the runs are done (no I/O, so it is testable). */
export function evaluateHunt({ runs, files, brokenAfter = DEFAULT_BROKEN_AFTER, failOnFailure = false }) {
  const summary = summarizeRuns(runs, { brokenAfter });
  const fatal = summary.broken.length + summary.incomplete.length + (failOnFailure ? summary.flaky.length : 0);
  return {
    summary,
    markdown: renderMarkdown({ runs, summary, files, brokenAfter }),
    annotations: annotationsFor(summary, { runCount: runs.length }),
    exitCode: fatal > 0 ? 1 : 0,
  };
}

function parseArguments(argv) {
  const options = {
    count: DEFAULT_COUNT, runs: DEFAULT_RUNS, engine: 'chromium', concurrency: DEFAULT_CONCURRENCY,
    brokenAfter: DEFAULT_BROKEN_AFTER, outputDir: resolve(packageDirectory, '.quality-tools', 'flake-hunt'),
    summary: process.env.GITHUB_STEP_SUMMARY, failOnFailure: false,
  };
  const positive = (name, value) => {
    if (!/^[1-9]\d*$/u.test(String(value))) throw new Error(`${name} must be a positive integer; received ${JSON.stringify(value)}.`);
    return Number(value);
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) throw new Error(`${flag} needs a value.`);
      index += 1;
      return next;
    };
    if (flag === '--count') options.count = positive(flag, value());
    else if (flag === '--runs') options.runs = positive(flag, value());
    else if (flag === '--concurrency') options.concurrency = positive(flag, value());
    else if (flag === '--broken-after') options.brokenAfter = positive(flag, value());
    else if (flag === '--engine') options.engine = value().toLowerCase();
    else if (flag === '--output-dir') options.outputDir = resolve(value());
    else if (flag === '--summary') options.summary = resolve(value());
    else if (flag === '--fail-on-failure') options.failOnFailure = true;
    else throw new Error(`Unknown option ${flag}.`);
  }
  if (!['chromium', 'firefox', 'webkit'].includes(options.engine)) throw new Error(`--engine must be chromium, firefox or webkit; received ${options.engine}.`);
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const { costs } = readCosts('tests');
  const files = expensiveTestFiles({ count: options.count, costs, available: await discoverTestFiles(packageDirectory) });
  if (files.length === 0) throw new Error('No test files were selected.');
  mkdirSync(options.outputDir, { recursive: true });
  console.log(`Flake hunt: ${files.length} files, ${options.runs} run(s) on ${options.engine}, retries off.`);

  const executable = resolve(packageDirectory, 'node_modules', '.bin', process.platform === 'win32' ? 'wtr.cmd' : 'wtr');
  const runs = [];
  for (let run = 1; run <= options.runs; run += 1) {
    const stem = resolve(options.outputDir, `${options.engine}-${run}`);
    const reportPath = `${stem}.failures.jsonl`;
    writeFileSync(reportPath, '');
    const log = openSync(`${stem}.log`, 'w');
    const started = Date.now();
    const result = spawnSync(executable, files, {
      cwd: packageDirectory,
      env: {
        ...process.env,
        WTR_BROWSER: options.engine,
        WTR_RETRIES: '0',
        WTR_CONCURRENCY: String(options.concurrency),
        WTR_STRICT_CONSOLE: '1',
        WTR_FAILURE_REPORT: reportPath,
      },
      stdio: ['ignore', log, log],
    });
    closeSync(log);
    const seconds = Math.round((Date.now() - started) / 1000);
    const status = result.error ? `error: ${result.error.message}` : result.signal ?? result.status ?? 1;
    const report = parseFailureReport(existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : '');
    runs.push(describeRun({ engine: options.engine, run, status, seconds, report, expectedFiles: files }));
    const last = runs.at(-1);
    console.log(`  ${options.engine} #${run}: exit ${status}, ${seconds} s, ${last.tests} tests, ${last.failures.length} failed, ${last.missing.length} file(s) not reported`);
  }

  const { summary, markdown, annotations, exitCode } = evaluateHunt({
    runs, files, brokenAfter: options.brokenAfter, failOnFailure: options.failOnFailure,
  });
  writeFileSync(resolve(options.outputDir, 'summary.md'), markdown);
  writeFileSync(resolve(options.outputDir, 'summary.json'), `${JSON.stringify({ files, runs, ...summary }, null, 2)}\n`);
  if (options.summary) appendFileSync(options.summary, markdown);
  console.log(markdown);
  for (const line of annotations) console.log(line);
  process.exitCode = exitCode;
}

if (isMainModule(import.meta.url)) await main();
