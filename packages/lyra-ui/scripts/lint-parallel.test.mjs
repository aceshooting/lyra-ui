import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { runLintQueue, runParallelLint } from './lint-parallel.mjs';
import { RESERVED_CORES, localWorkerCount } from './local-parallelism.mjs';

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
      jobs: 3,
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

const queueScripts = {
  'contract-policy': 'pnpm run check:a && node scripts/check-b.mjs',
  lint: 'pnpm run contract-policy && tsc --noEmit -p tsconfig.json && pnpm run test:types && pnpm run check:test-types',
  'check:a': 'node a.mjs',
  'test:types': 'tsc -p a',
  'check:test-types': 'tsc -p b',
};

function queueChild(status, output = '') {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => {
    if (output) child.stdout.emit('data', output);
    child.emit('close', status, null);
  });
  return child;
}

test('the local queue runs every inventory command once within the worker budget', async () => {
  const commands = [];
  let active = 0;
  let peak = 0;
  const result = await runLintQueue({
    jobs: 2,
    scripts: queueScripts,
    environment: {},
    write() {},
    spawn(executable, args) {
      commands.push([executable, ...args].join(' '));
      peak = Math.max(peak, ++active);
      const child = queueChild(0);
      child.once('close', () => active--);
      return child;
    },
  });
  assert.equal(result, 0);
  assert.equal(peak, 2);
  assert.deepEqual(commands.sort(), [
    'node scripts/check-b.mjs', 'pnpm run check:a', 'pnpm run check:test-types',
    'pnpm run test:types', 'tsc --noEmit -p tsconfig.json',
  ].map((command) => process.platform === 'win32' ? command.replace(/^(pnpm|tsc) /u, '$1.cmd ') : command).sort());
});

test('the local queue drains every command and prints each failing command whole', async () => {
  const written = [];
  const result = await runLintQueue({
    jobs: 3,
    scripts: queueScripts,
    environment: {},
    write: (text) => written.push(text),
    spawn: (_executable, args) => queueChild(args.includes('check:a') ? 5 : 0, `out ${args.at(-1)}\n`),
  });
  assert.equal(result, 5);
  assert.equal(written.filter((line) => line.startsWith('ok  ')).length, 4);
  assert.ok(written.includes('out check:a\n'));
  assert.ok(!written.includes('out tsconfig.json\n'), 'passing output stays quiet');
  assert.ok(written.some((line) => line.startsWith('Lint failed (5): ')));
});

test('without CI_JOBS lint sizes the queue to the host instead of the CI lanes', async () => {
  let spawned = 0;
  const result = await runParallelLint({
    environment: {},
    scripts: queueScripts,
    write() {},
    spawn() { spawned++; return queueChild(0); },
  });
  assert.equal(result, 0);
  assert.equal(spawned, 5);
});

test('host worker counts keep two cores free and respect available memory', () => {
  const gib = 1024 ** 3;
  assert.equal(RESERVED_CORES, 2);
  assert.equal(localWorkerCount({ cores: 60, freeMemoryBytes: 512 * gib }), 58);
  assert.equal(localWorkerCount({ cores: 16, freeMemoryBytes: 64 * gib, memoryPerWorkerMb: 2048 }), 14);
  assert.equal(localWorkerCount({ cores: 60, freeMemoryBytes: 20 * gib, memoryPerWorkerMb: 2048 }), 10);
  assert.equal(localWorkerCount({ cores: 60, freeMemoryBytes: 512 * gib, coresPerWorker: 10 }), 5);
  assert.equal(localWorkerCount({ cores: 2, freeMemoryBytes: 0, memoryPerWorkerMb: 2048 }), 1);
  assert.throws(() => localWorkerCount({ coresPerWorker: 0 }), /positive/);
});
