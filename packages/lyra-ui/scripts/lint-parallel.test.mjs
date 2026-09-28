import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { runParallelLint } from './lint-parallel.mjs';

test('parallel lint runs all three authoritative shards with a bounded worker count', async () => {
  const coordinates = [];
  let active = 0;
  let peak = 0;
  const result = await runParallelLint({
    jobs: 2,
    spawn(_command, args) {
      const child = new EventEmitter();
      coordinates.push(args.at(-1));
      peak = Math.max(peak, ++active);
      setImmediate(() => { active--; child.emit('exit', 0, null); });
      return child;
    },
  });
  assert.equal(result, 0);
  assert.equal(peak, 2);
  assert.deepEqual(coordinates.sort(), ['1/3', '2/3', '3/3']);
});

test('parallel lint preserves failures while draining every scheduled shard', async () => {
  const completed = [];
  const result = await runParallelLint({
    jobs: 1,
    spawn(_command, args) {
      const child = new EventEmitter();
      const coordinate = args.at(-1);
      setImmediate(() => {
        completed.push(coordinate);
        child.emit('exit', coordinate === '2/3' ? 7 : 0, null);
      });
      return child;
    },
  });
  assert.equal(result, 7);
  assert.deepEqual(completed, ['1/3', '2/3', '3/3']);
});

test('parallel lint fails closed on process launch errors and signals', async () => {
  for (const event of ['error', 'exit']) {
    assert.equal(await runParallelLint({
      spawn() {
        const child = new EventEmitter();
        setImmediate(() => event === 'error'
          ? child.emit('error', new Error('cannot launch'))
          : child.emit('exit', null, 'SIGTERM'));
        return child;
      },
    }), 1);
  }
});

test('parallel lint rejects invalid worker budgets', async () => {
  for (const jobs of [0, -1, NaN, Infinity, 1.5, '2oops']) {
    await assert.rejects(runParallelLint({ jobs }), /positive integer/);
  }
});
