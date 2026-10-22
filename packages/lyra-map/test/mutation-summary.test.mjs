import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertUsableReport, renderMarkdown, scoreOf, summarizeReport } from '../scripts/mutation-summary.mjs';

const mutant = (status, line = 1, column = 1, extra = {}) => ({ status, mutatorName: 'ConditionalExpression', replacement: 'true', location: { start: { line, column }, end: { line, column: column + 1 } }, ...extra });
const report = {
  files: {
    'scripts/b.mjs': { source: 'const a = 1;\nif (a | b) {}\n', mutants: [mutant('Killed'), mutant('Timeout'), mutant('Survived', 2, 5), mutant('NoCoverage', 1, 1), mutant('RuntimeError')] },
    'scripts/a.mjs': { source: 'x', mutants: [mutant('Killed'), mutant('Killed')] },
  },
};

test('scores killed and timed-out mutants against every detectable one, excluding errors', () => {
  assert.equal(scoreOf({ killed: 3, survived: 1, errors: 9 }), 75);
  assert.equal(scoreOf({ killed: 0, survived: 0, errors: 2 }), 100);
});

test('summarizes per file, in name order, with survivors sorted by position', () => {
  const summary = summarizeReport(report);
  assert.deepEqual(summary.files.map((file) => file.name), ['scripts/a.mjs', 'scripts/b.mjs']);
  assert.deepEqual(summary.files[1].counts, { killed: 2, survived: 2, errors: 1 });
  assert.deepEqual(summary.files[1].survivors.map(({ line, column }) => [line, column]), [[1, 1], [2, 5]]);
  assert.equal(summary.files[1].survivors[1].original, 'if (a | b) {}');
  assert.deepEqual(summary.total.counts, { killed: 4, survived: 2, errors: 1 });
  assert.ok(Math.abs(summary.total.score - (4 / 6) * 100) < 1e-9);
});

test('renders the table, escapes cell separators and limits the survivor list', () => {
  const markdown = renderMarkdown(summarizeReport(report), { maxSurvivors: 1 });
  assert.match(markdown, /\| `scripts\/a\.mjs` \| 100\.0% \| 2 \| 0 \| 0 \|/u);
  assert.match(markdown, /\| `scripts\/b\.mjs` \| 50\.0% \| 2 \| 2 \| 1 \|/u);
  assert.match(markdown, /\| \*\*Total\*\* \| \*\*66\.7%\*\* \| 4 \| 2 \| 1 \|/u);
  assert.match(markdown, /…and 1 more in the HTML report\./u);
  assert.doesNotMatch(markdown, /2:5/u, 'the second survivor is cut by the limit');
  assert.doesNotMatch(markdown, /scripts\/a\.mjs<\/code>: \d+ surviving/u, 'a file with no survivor has no list');
});

test('a report with no mutants is a tool failure, never a clean pass; a low score is not', () => {
  assert.throws(() => assertUsableReport(summarizeReport({ files: {} })), /no mutants/u);
  assert.throws(() => assertUsableReport(summarizeReport({})), /no mutants/u);
  assert.throws(
    () => assertUsableReport(summarizeReport({ files: { 'scripts/a.mjs': { source: 'x', mutants: [] } } })),
    /no mutants/u,
  );
  // Only mutants Stryker itself could not run: the tool failed even though the file is listed.
  assert.throws(
    () => assertUsableReport(summarizeReport({ files: { 'scripts/a.mjs': { source: 'x', mutants: [mutant('RuntimeError'), mutant('CompileError'), mutant('Ignored')] } } })),
    /no mutant could be tested/u,
  );
  const lowScore = summarizeReport({ files: { 'scripts/a.mjs': { source: 'x', mutants: [mutant('Survived'), mutant('Survived'), mutant('Killed')] } } });
  assert.doesNotThrow(() => assertUsableReport(lowScore), 'the score is a finding, not a failure');
  assert.doesNotThrow(() => assertUsableReport(summarizeReport(report)));
});

test('the command line fails on a missing or empty report and appends the table to the job summary otherwise', () => {
  const script = fileURLToPath(new URL('../scripts/mutation-summary.mjs', import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), 'lyra-map-mutation-summary-'));
  try {
    const summaryFile = join(directory, 'step-summary.md');
    const run = (...args) => spawnSync(process.execPath, [script, ...args], {
      encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: summaryFile },
    });
    // The positional path is honoured even without --max-survivors (it used to fall back to the default path).
    const missing = run(join(directory, 'missing.json'));
    assert.notEqual(missing.status, 0, 'a missing report is a tool failure');
    assert.match(missing.stderr, /missing\.json/u);

    const empty = join(directory, 'empty.json');
    writeFileSync(empty, JSON.stringify({ files: {} }));
    const emptyRun = run(empty);
    assert.notEqual(emptyRun.status, 0, 'a report with no mutants is a tool failure');
    assert.match(emptyRun.stderr, /no mutants/u);

    const good = join(directory, 'good.json');
    writeFileSync(good, JSON.stringify(report));
    const goodRun = run(good, '--max-survivors', '1');
    assert.equal(goodRun.status, 0, goodRun.stderr);
    assert.match(readFileSync(summaryFile, 'utf8'), /\| \*\*Total\*\* \| \*\*66\.7%\*\* \|/u, 'the job summary receives the table');
    assert.equal(run('--max-survivors', '1', good).status, 0, 'flag order does not matter');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
