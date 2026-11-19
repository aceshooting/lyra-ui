import assert from 'node:assert/strict';
import test from 'node:test';
import { literalLongWaits, newLongWaits } from './check-test-waits.mjs';

test('counts literal waits by test title across line moves', () => {
  const original = literalLongWaits("it('copy', async () => {\n  await aTimeout(1600);\n});", 'src/copy.test.ts');
  const moved = literalLongWaits("\n\nit('copy', async () => {\n  await aTimeout(1600);\n});", 'src/copy.test.ts');
  const baseline = { [original[0].key]: 1 };
  assert.deepEqual(newLongWaits(moved, baseline), []);
  assert.equal(newLongWaits([...moved, ...moved], baseline).length, 1);
});

test('requires an explicit reason for a new long wait', () => {
  const unjustified = literalLongWaits("test('later', async () => {\n  await aTimeout(200);\n});", 'src/later.test.ts');
  const justified = literalLongWaits("test('later', async () => {\n  // wait-reason: exercises the real product timeout.\n  await aTimeout(200);\n});", 'src/later.test.ts');
  assert.equal(newLongWaits(unjustified, {}).length, 1);
  assert.deepEqual(newLongWaits(justified, {}), []);
});

test('ignores short frame yields and rejection watchdogs', () => {
  const rows = literalLongWaits("await aTimeout(20);\nsetTimeout(() => reject(new Error('late')), 3000);", 'src/wait.test.ts');
  assert.deepEqual(rows, []);
});

test('sees waits made through a local sleep wrapper and resolves a named delay constant', () => {
  const source = [
    "const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));",
    "const SETTLE_WAIT_MS = 150;",
    "it('settles', async () => {",
    "  await delay(120);",
    "  await aTimeout(SETTLE_WAIT_MS);",
    "  await delay(20);",
    "});",
  ].join('\n');
  const rows = literalLongWaits(source, 'src/wrapped.test.ts');
  assert.deepEqual(rows.map(row => row.key.split('\t')[2]), ['delay(120)', 'aTimeout(SETTLE_WAIT_MS=150)']);
  assert.equal(newLongWaits(rows, {}).length, 2);
});

test('a function that does not wrap a timer is not treated as a sleep helper', () => {
  const source = "const compute = (ms: number) => ms * 2;\nit('x', () => { compute(500); });";
  assert.deepEqual(literalLongWaits(source, 'src/plain.test.ts'), []);
});
