import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkBudgets, writeBudgets, parseMeasurements } from './check-scale-budgets.mjs';
const rows = [{ tag: 'lr-table', scenario: 'mount@10000', counters: { domNodes: 10 }, engine: 'chromium' }];
const fixture = (value = 11) => ({ margin: 0.1, budgets: { 'lr-table': { 'mount@10000': { domNodes: value } } } });
test('counts pass, regressions fail, and stale ceilings fail', () => {
  assert.deepEqual(checkBudgets(rows, fixture()), []);
  assert.match(checkBudgets(rows, fixture(9)).join(), /exceeds/);
  assert.match(checkBudgets(rows, fixture(21)).join(), /stale/);
});
test('missing measurements and missing budgets fail closed', () => {
  assert.match(checkBudgets([], fixture()).join(), /missing measurement/);
  assert.match(checkBudgets(rows, { margin: 0.1, budgets: {} }).join(), /missing budget/);
  assert.match(checkBudgets([{ ...rows[0], counters: { domNodes: 10, calls: 1 } }], fixture()).join(), /missing budget/);
});
test('unknown component tags cannot pass or become new budgets', () => {
  const componentTags = new Set(['lr-table']);
  const unknownRows = [{ ...rows[0], tag: 'lr-missing-control' }];
  const unknownFixture = { margin: 0.1, budgets: { 'lr-missing-control': fixture().budgets['lr-table'] } };
  assert.deepEqual(checkBudgets(rows, fixture(), { componentTags }), []);
  assert.throws(() => checkBudgets(unknownRows, unknownFixture, { componentTags }), /Unknown scale component/);
  assert.throws(() => checkBudgets(rows, unknownFixture, { componentTags }), /Unknown scale component/);
  assert.throws(() => writeBudgets(unknownRows, { margin: 0.1, budgets: {} }, { componentTags }), /Unknown scale component/);
  assert.throws(() => parseMeasurements([...unknownRows, { complete: true }].map(JSON.stringify).join('\n'), { componentTags }), /Unknown scale component/);
});
test('ratchet only raises with explicit authorization', () => {
  assert.throws(() => writeBudgets(rows, fixture(9)), /raise/);
  assert.equal(writeBudgets(rows, fixture(9), { allowHigher: true }).budgets['lr-table']['mount@10000'].domNodes, 11);
  assert.equal(writeBudgets(rows, fixture(100)).budgets['lr-table']['mount@10000'].domNodes, 11);
  assert.throws(() => writeBudgets([], fixture()), /missing measurement/);
});
test('malformed, duplicate, partial, non-Chromium and elapsed counters are rejected', () => {
  const serialize = (records) => records.map(JSON.stringify).join('\n');
  const complete = { complete: true };
  assert.deepEqual(parseMeasurements(serialize([...rows, complete])), rows);
  for (const invalid of [[], rows, [...rows, ...rows, complete], [{ ...rows[0], engine: 'firefox' }, complete], [{ ...rows[0], counters: { elapsedMs: 1 } }, complete], [{ ...rows[0], counters: { calls: -1 } }, complete]]) {
    assert.throws(() => parseMeasurements(serialize(invalid)));
  }
  assert.throws(() => parseMeasurements('{broken'));
});

test('reporter truncates stale runs and emits completion only for successful sessions', async () => {
  const { mkdtempSync, readFileSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { scaleReporter } = await import('./wtr-scale-reporter.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'lyra-scale-'));
  try {
    const path = join(directory, 'measurements.jsonl');
    const reporter = scaleReporter(path);
    writeFileSync(path, 'stale report');
    reporter.start();
    assert.equal(readFileSync(path, 'utf8'), '');
    const session = { browser: { product: 'chromium' }, passed: true, errors: [], logs: [[`[lr-scale] ${JSON.stringify(rows[0])}`], ['unrelated']] };
    reporter.onTestRunFinished({ sessions: [session] });
    assert.deepEqual(parseMeasurements(readFileSync(path, 'utf8')), rows);
    reporter.onTestRunStarted();
    reporter.onTestRunFinished({ sessions: [{ ...session, passed: false }] });
    assert.throws(() => parseMeasurements(readFileSync(path, 'utf8')), /completed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('invalid fixtures and unsafe values cannot create passing ceilings', () => {
  for (const value of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => checkBudgets(rows, fixture(value)));
  }
  assert.throws(() => checkBudgets(rows, { ...fixture(), margin: -1 }));
  assert.throws(() => checkBudgets(rows, { ...fixture(), margin: 2 }));
  assert.throws(() => checkBudgets(rows, { margin: 0.1, budgets: { 'lr-table': { mount: { medianMs: 10 } } } }));
  assert.deepEqual(checkBudgets([{ ...rows[0], counters: { domNodes: 0 } }], fixture(0)), []);
});
