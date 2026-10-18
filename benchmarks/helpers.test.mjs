import './list-fixtures.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregate, validateSample, validateResult, makeSchema } from './lib/results.mjs';
import { compareResults, renderComparisonSummary } from './compare.mjs';
import { parseOptions } from './lib/options.mjs';

const catalog = {
  SCENARIOS: [{ id: 'noop-control', profiles: ['quick', 'stress'], parameters: { size: 0 }, assertionIds: ['mounted'] }],
  CHECK_IDS: ['mounted'], METRICS: { assignmentMs: { unit: 'ms' }, totalMs: { unit: 'ms' } }, COUNT_KEYS: ['rendered'], ERROR_CODES: ['assertion-failed'],
};
const hash = 'a'.repeat(64);
const benchmarksDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = dirname(benchmarksDirectory);
function sample(value = 2) { return { status: 'passed', code: null, metrics: { assignmentMs: value, totalMs: value + 1 }, assertions: [{ id: 'mounted', passed: true }], counts: { rendered: 1 } }; }
function result(value = 2) {
  return { schemaVersion: 1, recordedAt: '2026-10-12T12:00:00.000Z', harness: { hash, fixturesHash: hash }, library: { version: '28.1.0', distHash: hash, publicCommit: null },
    environment: { node: '22.23.2', playwright: '1.64.0', vite: '8.3.4', chartJs: '4.5.1', os: 'linux', osVersion: '6.8', arch: 'x64', cpuModel: 'Generic CPU', logicalCpus: 8, memoryBytes: 16000000000, dpr: 1, viewport: { width: 1280, height: 900 }, headless: true, softwareRendering: false },
    configuration: { profile: 'quick', samples: 3, warmups: 1, timeoutMs: 30000, browsers: ['chromium'], scenarioIds: ['noop-control'] },
    browsers: [{ id: 'chromium', version: '140.0.0.0', status: 'passed', code: null, scenarios: [{ id: 'noop-control', parameters: { size: 0 }, status: 'passed', code: null, samples: [sample(value), sample(value + 1), sample(value + 2)], warmupStatus: 'passed' }] }], status: 'passed' };
}

test('raw samples retain fractional timings and use nearest-rank p95', () => {
  assert.deepEqual(aggregate([1, 2, 3, 4, 100]), { count: 5, min: 1, median: 3, p95: 100, max: 100 });
  assert.equal(aggregate([0.1, 0.2]).median, 0.15000000000000002);
  assert.throws(() => aggregate([]));
});
test('strict sample schema rejects raw errors, paths, unknown IDs and non-finite numbers', () => {
  assert.deepEqual(validateSample(sample(), catalog, catalog.SCENARIOS[0]), sample());
  for (const invalid of [ { ...sample(), error: 'unexpected text' }, { ...sample(), metrics: { assignmentMs: Infinity } }, { ...sample(), assertions: [{ id: 'unknown', passed: true }] }, { ...sample(), counts: { unknown: 3 } }, { ...sample(), code: 'unregistered-code' } ]) assert.throws(() => validateSample(invalid, catalog, catalog.SCENARIOS[0]));
});
test('passing sample requires every scenario assertion and complete numeric metrics', () => {
  assert.throws(() => validateSample({ ...sample(), assertions: [] }, catalog, catalog.SCENARIOS[0]));
  assert.throws(() => validateSample({ ...sample(), assertions: [{ id: 'mounted', passed: false }] }, catalog, catalog.SCENARIOS[0]));
  assert.throws(() => validateSample({ ...sample(), metrics: { assignmentMs: 2 } }, catalog, catalog.SCENARIOS[0]));
});
test('result rejects unapproved metadata and a vacuous success', () => {
  validateResult(result(), catalog);
  for (const mutate of [r => { r.hostname = 'example'; }, r => { r.environment.cwd = 'example'; }, r => { r.browsers = []; }, r => { r.browsers[0].scenarios[0].samples = []; }, r => { r.browsers[0].scenarios[0].parameters.size = 1; }]) { const r = result(); mutate(r); assert.throws(() => validateResult(r, catalog)); }
  const schema = makeSchema(catalog); assert.equal(schema.additionalProperties, false);
});
test('comparison requires relative AND absolute thresholds and retains raw distributions', () => {
  const stable = compareResults(result(2), result(2.5), catalog, { relative: 0.1, absoluteMs: 1 });
  assert.equal(stable.status, 'passed');
  const slower = compareResults(result(2), result(6), catalog, { relative: 0.1, absoluteMs: 1 });
  assert.equal(slower.status, 'regression');
  assert.equal(slower.comparisons[0].baseline.median, 3);
  assert.equal(slower.comparisons[0].candidate.median, 7);
});
test('version changes are allowed; environmental and harness changes require an explicit non-green override', () => {
  const candidate = result(); candidate.library.version = '29.0.0'; candidate.library.distHash = 'b'.repeat(64);
  assert.equal(compareResults(result(), candidate, catalog).status, 'passed');
  candidate.environment.cpuModel = 'Another CPU';
  assert.equal(compareResults(result(), candidate, catalog).status, 'incompatible');
  assert.equal(compareResults(result(), candidate, catalog, { allowIncompatible: true }).status, 'incomparable-override');
});
test('missing, unsupported or failed evidence never compares green', () => {
  const candidate = result(); candidate.browsers[0].status = 'unavailable'; candidate.browsers[0].code = 'browser-unavailable'; candidate.browsers[0].version = null; candidate.browsers[0].scenarios = []; candidate.status = 'incomplete';
  assert.equal(compareResults(result(), candidate, catalog).status, 'incomplete');
});
test('CLI constrains workloads, sample counts and sequential browser selection', () => {
  const opts = parseOptions(['--profile', 'stress', '--browsers', 'chromium,firefox', '--samples', '7']);
  assert.equal(opts.profile, 'stress'); assert.deepEqual(opts.browsers, ['chromium', 'firefox']);
  assert.throws(() => parseOptions(['--samples', '0'])); assert.throws(() => parseOptions(['--browsers', 'unknown'])); assert.throws(() => parseOptions(['--profile', 'unknown']));
});

test('benchmark CLI guards recognize symlinked directory and file invocations', async t => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'lyra-benchmark-cli-'));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));

  const linkedDirectory = join(temporaryDirectory, 'linked-benchmarks');
  const linkedFile = join(temporaryDirectory, 'compare-link.mjs');
  await symlink(benchmarksDirectory, linkedDirectory, 'dir');
  await symlink(join(benchmarksDirectory, 'compare.mjs'), linkedFile, 'file');

  await t.test('run help works through a symlinked directory', () => {
    const result = spawnSync(process.execPath, [join(linkedDirectory, 'run.mjs'), '--help'], { cwd: repositoryDirectory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^Usage: node benchmarks\/run\.mjs/m);
  });

  await t.test('schema check works through a symlinked directory', () => {
    const result = spawnSync(process.execPath, [join(linkedDirectory, 'schema.mjs'), '--check'], { cwd: repositoryDirectory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Benchmark schema validation passed/);
  });

  await t.test('compare reports invalid input through a symlinked file', () => {
    const result = spawnSync(process.execPath, [linkedFile], { cwd: repositoryDirectory, encoding: 'utf8' });
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /Benchmark comparison failed/);
  });
});

test('importing a CLI stays inert when argv points to a missing path', () => {
  const importModule = `await import(${JSON.stringify(new URL('./schema.mjs', import.meta.url).href)})`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', importModule, 'missing-entry.mjs'], { cwd: repositoryDirectory, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('p95 catches a tail regression even when median stays unchanged', () => {
  const before = result(), after = result();
  before.configuration.samples = 5; after.configuration.samples = 5;
  before.browsers[0].scenarios[0].samples = [1, 1, 1, 1, 1].map(value => sample(value));
  after.browsers[0].scenarios[0].samples = [1, 1, 1, 1, 20].map(value => sample(value));
  const comparison = compareResults(before, after, catalog);
  assert.equal(comparison.status, 'regression');
  assert.equal(comparison.comparisons[0].statistics.median.regressed, false);
  assert.equal(comparison.comparisons[0].statistics.p95.regressed, true);
});
test('fixture output cannot hide identifiers in numeric fields or nested assertion fields', () => {
  for (const invalid of [
    { ...sample(), metrics: { ...sample().metrics, totalMs: 'not-a-number' } },
    { ...sample(), assertions: [{ id: 'mounted', passed: true, details: 'unexpected' }] },
    { ...sample(), counts: { rendered: -1 } },
  ]) assert.throws(() => validateSample(invalid, catalog, catalog.SCENARIOS[0]));
});
test('raw distribution and workload differences cannot pass through compatible comparison', () => {
  const changed = result(); changed.harness.hash = 'b'.repeat(64);
  assert.equal(compareResults(result(), changed, catalog).status, 'incompatible');
  const failed = result(); failed.browsers[0].scenarios[0].samples[0] = { status: 'failed', code: 'assertion-failed', metrics: {}, assertions: [{ id: 'mounted', passed: false }], counts: {} };
  failed.browsers[0].scenarios[0].status = 'failed'; failed.browsers[0].scenarios[0].code = 'assertion-failed'; failed.browsers[0].status = 'failed'; failed.status = 'failed';
  assert.equal(compareResults(result(), failed, catalog, { allowIncompatible: true }).status, 'incomplete');
});


test('human comparison output is bounded and omits arbitrary extra strings', () => {
  const comparison = compareResults(result(2), result(6), catalog);
  comparison.comparisons = Array.from({ length: 700 }, () => structuredClone(comparison.comparisons[0]));
  comparison.note = 'UNAPPROVED_TEXT';
  comparison.comparisons[0].details = 'UNAPPROVED_DETAIL';
  const output = renderComparisonSummary(comparison, catalog);
  assert.match(output, /700 regressed/);
  assert.equal(output.split('\n').filter(line => line.startsWith('  chromium /')).length, 20);
  assert.ok(output.split('\n').length <= 30);
  assert.ok(output.length < 6000);
  assert.ok(!output.includes('UNAPPROVED'));
  assert.match(output, /680 additional material changes/);
  assert.match(output, /not causal/);
});
test('human improvement counts require mirrored absolute and relative thresholds', () => {
  const improved = renderComparisonSummary(compareResults(result(10), result(2), catalog), catalog);
  assert.match(improved, /0 regressed, 2 improved/);
  assert.match(improved, /observed improvement/);
  const small = renderComparisonSummary(compareResults(result(2), result(1.5), catalog), catalog);
  assert.match(small, /0 regressed, 0 improved/);
});
test('human renderer rejects unknown identifiers without echoing them', () => {
  const comparison = compareResults(result(), result(8), catalog);
  comparison.comparisons[0].scenario = 'UNAPPROVED_SCENARIO';
  assert.throws(() => renderComparisonSummary(comparison, catalog), error => error.message === 'invalid-comparison');
  const incomplete = compareResults(result(), result(), catalog);
  incomplete.compatibility.mismatches = ['UNAPPROVED_REASON'];
  assert.throws(() => renderComparisonSummary(incomplete, catalog), error => error.message === 'invalid-comparison');
});
