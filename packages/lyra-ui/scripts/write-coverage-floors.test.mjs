import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextFloors, parseArgs, resolveMinimums } from './write-coverage-floors.mjs';

const current = { statements: 98, branches: 95, functions: 98, lines: 98 };
const measured = { statements: 99.75, branches: 96.97, functions: 99.9, lines: 99.8 };

test('fractional minima raise only the requested metrics', () => {
  const { next } = nextFloors({ current, measured, minimums: { statements: 99.6, lines: 99.6 } });
  assert.deepEqual(next, { statements: 99.6, branches: 95, functions: 98, lines: 99.6 });
});

test('the default margin and no-lowering policy still apply', () => {
  assert.deepEqual(nextFloors({ current, measured }).next, current);
  const raised = { ...current, statements: 99.7, lines: 99.7 };
  const { next, changes } = nextFloors({
    current: raised, measured, minimums: { statements: 99.6, lines: 99.6 },
  });
  assert.deepEqual(next, raised);
  assert.deepEqual(changes.filter((change) => change.direction === 'blocked').map((change) => change.metric), [
    'statements', 'lines',
  ]);
});

test('a later ordinary refresh keeps reviewed minima without a blocked lowering', () => {
  const stored = { ...current, statements: 99.6, lines: 99.6,
    minimums: { statements: 99.6, lines: 99.6 } };
  const minimums = resolveMinimums(stored);
  const { next, changes } = nextFloors({ current: stored, measured, minimums });
  assert.deepEqual(next, { statements: 99.6, branches: 95, functions: 98, lines: 99.6 });
  assert.deepEqual(changes, []);
  assert.deepEqual(resolveMinimums(current), {});
});

test('an explicit minimum override retains other reviewed values and cannot silently lower one', () => {
  const stored = { ...current, minimums: { statements: 99.6, lines: 99.6 } };
  assert.deepEqual(resolveMinimums(stored, { lines: 99.7 }), { statements: 99.6, lines: 99.7 });
  assert.throws(() => resolveMinimums(stored, { lines: 99.5 }), /--allow-lower/);
  assert.deepEqual(resolveMinimums(stored, { lines: 99.5 }, true), { statements: 99.6, lines: 99.5 });
});

test('requested minima must be finite percentages supported by the measurement', () => {
  for (const minimum of [-1, 100.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => nextFloors({ current, measured, minimums: { lines: minimum } }), /minimum lines/);
  }
  assert.throws(() => nextFloors({
    current, measured, minimums: { statements: 99.76 },
  }), /minimum statements.*measured/);
});

test('CLI accepts explicit line and statement minima only', () => {
  assert.deepEqual(parseArgs(['--write-floors', '--minimum-lines', '99.6', '--minimum-statements', '99.6']).minimums, {
    lines: 99.6,
    statements: 99.6,
  });
  assert.throws(() => parseArgs(['--minimum-lines', 'not-a-number']), /--minimum-lines/);
  assert.throws(() => parseArgs(['--minimum-branches', '99.6']), /Unknown argument/);
});
