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

test('CI output keeps every concurrent lane attributable line by line', async () => {
  const written = [];
  const result = await runParallelLint({
    jobs: 3,
    prefixOutput: true,
    write: (text) => written.push(text),
    spawn(_command, args, options) {
      assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      const coordinate = args.at(-1);
      setImmediate(() => {
        child.stdout.emit('data', `first ${coordinate}\nsecond`);
        child.stdout.emit('data', ` ${coordinate}\n`);
        child.stderr.emit('data', `tail ${coordinate}`);
        child.stdout.emit('end');
        child.stderr.emit('end');
        child.emit('exit', 0, null);
      });
      return child;
    },
  });
  assert.equal(result, 0);
  for (const shard of ['1/3', '2/3', '3/3']) {
    for (const line of [`first ${shard}`, `second ${shard}`, `tail ${shard}`]) {
      assert.ok(written.includes(`[lint ${shard}] ${line}\n`), `${line} is prefixed`);
    }
  }
});

test('parallel lint rejects invalid worker budgets', async () => {
  for (const jobs of [0, -1, NaN, Infinity, 1.5, '2oops']) {
    await assert.rejects(runParallelLint({ jobs }), /positive integer/);
  }
});
