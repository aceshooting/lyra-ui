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

test('finds multiline calls and the delay parameter of a multiline sleep helper', () => {
  const source = `
    const SETTLE_MS: number = 1_000;
    function pause(
      label: string,
      milliseconds: number,
    ) {
      console.log(label);
      return new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, milliseconds);
      });
    }
    it('settles', async () => {
      await pause(
        'render',
        SETTLE_MS,
      );
      await aTimeout(
        125,
      );
      await new Promise<void>((resolve) => {
        setTimeout(
          resolve,
          225,
        );
      });
    });
  `;
  assert.deepEqual(literalLongWaits(source, 'src/wrapped.test.ts').map(({ key, line }) => [key.split('\t')[2], line]), [
    ['pause(SETTLE_MS=1000)', 13],
    ['aTimeout(125)', 17],
    ['setTimeout(225)', 21],
  ]);
});

test('ignores timer-shaped prose and ordinary functions near a real wait helper', () => {
  const source = `
    const compute = (milliseconds: number) => milliseconds * 2;
    const pause = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
    const watchdog = (milliseconds: number) => new Promise<void>((_resolve, reject) => setTimeout(reject, milliseconds));
    const externalExecutor = () => new Promise<void>(executor);
    it('checks timing', async () => {
      // aTimeout(200);
      console.log('pause(400)');
      compute(500);
      queue.pause(600);
      await watchdog(700);
      await externalExecutor(750);
      await pause(800);
    });
  `;
  assert.deepEqual(literalLongWaits(source, 'src/plain.test.ts').map(({ key }) => key.split('\t')[2]), ['pause(800)']);
});
