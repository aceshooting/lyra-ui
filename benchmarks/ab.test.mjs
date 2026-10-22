import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_FAIL_ABOVE_PERCENT, TACHOMETER_VERSION, WORKLOADS, evaluateAb, judgeWorkload, parseArguments, renderSummary, splitFlags,
  summarizeResult, tachometerConfig, workloadPage,
} from './ab.mjs';

test('pins tachometer and describes three workloads that assert real work after the timed region', () => {
  assert.match(TACHOMETER_VERSION, /^\d+\.\d+\.\d+$/u);
  assert.deepEqual(Object.keys(WORKLOADS), ['button', 'data-grid', 'virtual-list']);
  for (const { entry } of Object.values(WORKLOADS)) {
    assert.ok(entry.indexOf('bench.start()') < entry.indexOf('bench.stop()'), 'the timed region is bracketed');
    assert.ok(entry.indexOf('bench.stop()') < entry.indexOf('throw new Error'), 'the work is checked after the clock stops');
  }
  assert.match(workloadPage('button'), /import \{ run \} from '\.\/button\.js'/u);
});

test('compares the published and the local page of one workload in one configuration', () => {
  const config = tachometerConfig({
    workload: 'data-grid', publishedVersion: '29.2.2', localVersion: '30.0.0', sampleSize: 60,
    timeoutMinutes: 4, autoSampleConditions: ['-5%', '+5%'], browserBinary: '/opt/chrome',
  });
  assert.deepEqual(config.benchmarks.map(({ name, url }) => [name, url]), [
    ['data-grid [published 29.2.2]', 'suite/published/data-grid.html'],
    ['data-grid [local 30.0.0]', 'suite/local/data-grid.html'],
  ]);
  assert.equal(config.resolveBareModules, false, 'pages are pre-bundled: tachometer cannot read exports maps');
  assert.deepEqual(config.autoSampleConditions, ['-5%', '+5%']);
  assert.equal(config.benchmarks[0].browser.binary, '/opt/chrome');
  assert.equal(tachometerConfig({ workload: 'button', publishedVersion: '1.0.0', localVersion: '1.0.1', sampleSize: 10, timeoutMinutes: 1, autoSampleConditions: ['0%'] }).benchmarks[0].browser.binary, undefined);
});

const results = [
  { name: 'button [published 1.0.0]', mean: { low: 9, high: 11 }, differences: [null, { absolute: { low: -1, high: 3 }, percentChange: { low: -10, high: 30 } }] },
  { name: 'button [local 1.0.1]', mean: { low: 9.5, high: 11.5 }, differences: [{ absolute: { low: -3, high: 1 }, percentChange: { low: -25, high: 10 } }, null] },
];

test('reads the local build against the published one from tachometer results', () => {
  assert.deepEqual(summarizeResult(results), {
    published: 10, local: 10.5, percent: { low: -25, high: 10 }, milliseconds: { low: -3, high: 1 },
  });
  assert.equal(summarizeResult([results[0]]), null);
});

test('renders a table row per workload with its verdict, and says so when a workload produced no result', () => {
  const markdown = renderSummary([{ title: 'create 1,000 buttons', summary: summarizeResult(results) }, { title: 'missing', summary: null }]);
  assert.match(markdown, /\| create 1,000 buttons \| 10\.00 ms \| 10\.50 ms \| -3\.00 to 1\.00 \| -25\.00 to 10\.00 \| no regression \|/u);
  assert.match(markdown, /\| missing \| - \| - \| no result \| no result \| no interval: cannot judge \|/u);
  assert.match(markdown, /fails when .*95% interval.* entirely above 10%/su, 'the rule and its limit are printed with the numbers');
});

const row = (title, low, high) => ({ title, summary: { published: 10, local: 11, percent: { low, high }, milliseconds: { low: low / 10, high: high / 10 } } });

test('judges a workload by where its confidence interval lies against the limit', () => {
  assert.equal(DEFAULT_FAIL_ABOVE_PERCENT, 10, 'the documented default');
  const verdict = (low, high, limit) => judgeWorkload({ percent: { low, high } }, limit).verdict;
  assert.equal(verdict(12, 30), 'regression', 'the whole interval is above the limit');
  assert.equal(verdict(10.01, 12), 'regression');
  assert.equal(verdict(10, 20), 'inconclusive', 'touching the limit is not proof');
  assert.equal(verdict(-5, 25), 'inconclusive', 'the interval includes 0 but reaches past the limit');
  assert.equal(verdict(2, 8), 'slower', 'a proven slowdown inside the limit is reported, not failed');
  assert.equal(verdict(-12, 4), 'ok');
  assert.equal(verdict(-30, -10), 'ok', 'faster');
  assert.equal(verdict(0, 10), 'ok');
  assert.equal(verdict(12, 30, 40), 'slower', 'the limit is a parameter: the same interval no longer exceeds it');
  assert.equal(verdict(-3, 30, 40), 'ok');
  assert.equal(judgeWorkload(null).verdict, 'no-interval');
  assert.equal(judgeWorkload({ percent: null }).verdict, 'no-interval');
});

test('fails the job on a significant regression, warns on an inconclusive workload, and never passes on no result', () => {
  const clean = evaluateAb({ rows: [row('w0', -5, 4), row('w1', -12, 3)] });
  assert.equal(clean.exitCode, 0);
  assert.deepEqual(clean.annotations, []);

  const unsure = evaluateAb({ rows: [row('w0', -5, 25)] });
  assert.equal(unsure.exitCode, 0, 'an interval that cannot rule a regression out is a warning');
  assert.deepEqual(unsure.annotations, [
    // `%` is escaped as %25 in a workflow command; GitHub shows it decoded.
    '::warning title=A/B benchmark inconclusive::w0 may be slower than the published release by up to 25.00%25 (limit 10%25): rerun on a quieter runner or raise --timeout.',
  ]);

  const regressed = evaluateAb({ rows: [row('w0', 12, 30), row('w1', -1, 2)] });
  assert.equal(regressed.exitCode, 1);
  assert.deepEqual(regressed.annotations, [
    '::error title=A/B benchmark regression::w0 is slower than the published release by 12.00%25 to 30.00%25 (95%25 interval), above the 10%25 limit.',
  ]);
  assert.match(regressed.markdown, /\*\*regression\*\*/u);

  const missing = evaluateAb({ rows: [{ title: 'w0', summary: null }] });
  assert.equal(missing.exitCode, 1, 'a gate that produced no interval proves nothing');
  assert.match(missing.annotations[0], /^::error title=A\/B benchmark has no interval::w0/u);

  assert.equal(evaluateAb({ rows: [row('w0', 12, 30)], failAbovePercent: 40 }).exitCode, 0);
});

test('--fail-above takes a non-negative percentage and defaults to the documented limit', () => {
  assert.equal(parseArguments([]).failAbovePercent, DEFAULT_FAIL_ABOVE_PERCENT);
  assert.equal(parseArguments(['--fail-above', '7.5']).failAbovePercent, 7.5);
  assert.equal(parseArguments(['--fail-above=0']).failAbovePercent, 0);
  for (const bad of ['-1', 'abc', '', 'Infinity']) assert.throws(() => parseArguments(['--fail-above', bad]), /--fail-above/u, bad);
});

test('splits --flag=value so a dash-leading value survives', () => {
  assert.deepEqual(splitFlags(['--timeout', '3', '--auto-sample-conditions=-5%,+5%', '--workloads=button,data-grid']), [
    '--timeout', '3', '--auto-sample-conditions', '-5%,+5%', '--workloads', 'button,data-grid',
  ]);
  assert.deepEqual(splitFlags(['--published', 'latest', 'x=y']), ['--published', 'latest', 'x=y']);
});
