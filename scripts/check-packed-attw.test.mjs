import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ATTW_CI_SHARD_TOTAL,
  attwCommandArguments,
  attwEntrypoints,
  parseAttwArguments,
  parsePackedConsumerArguments,
  partitionAttwEntrypoints,
} from './packed-attw.mjs';

const manifest = JSON.parse(
  await readFile(new URL('../packages/lyra-ui/package.json', import.meta.url), 'utf8'),
);

test('derives every non-CSS package export and partitions it exhaustively once', () => {
  const entrypoints = attwEntrypoints(manifest);
  assert.equal(entrypoints.length, 935, 'the reviewed package has 935 typed exports');
  assert.ok(entrypoints.includes('.'));
  assert.ok(entrypoints.includes('./package.json'));
  assert.ok(entrypoints.includes('./theme/*'));
  assert.ok(entrypoints.every((entrypoint) => !entrypoint.endsWith('.css')));

  const shards = Array.from({ length: ATTW_CI_SHARD_TOTAL }, (_, index) =>
    partitionAttwEntrypoints(entrypoints, index + 1, ATTW_CI_SHARD_TOTAL),
  );
  assert.deepEqual(shards.map((shard) => shard.length), [234, 234, 234, 233]);
  assert.equal(new Set(shards.flat()).size, entrypoints.length, 'shards are disjoint');
  assert.deepEqual(shards.flat().sort(), entrypoints, 'shards cover every typed export');
});

test('partitioning is deterministic and rejects ambiguous coordinates or inventories', () => {
  const entries = ['./z.js', '.', './b.js', './a.js'];
  assert.deepEqual(partitionAttwEntrypoints(entries, 1, 2), ['.', './b.js']);
  assert.deepEqual(partitionAttwEntrypoints(entries, 2, 2), ['./a.js', './z.js']);
  assert.deepEqual(partitionAttwEntrypoints([...entries].reverse(), 1, 2), ['.', './b.js']);
  assert.throws(() => partitionAttwEntrypoints(entries, 0, 2), /index/u);
  assert.throws(() => partitionAttwEntrypoints(entries, 3, 2), /index/u);
  assert.throws(() => partitionAttwEntrypoints(['.', '.'], 1, 2), /unique/u);
  assert.throws(() => partitionAttwEntrypoints(['.'], 1, 2), /one per shard/u);
});

test('ATTW arguments are explicit and fail closed', () => {
  assert.deepEqual(parseAttwArguments([]), {
    shardIndex: 1,
    shardTotal: 1,
    tarball: undefined,
  });
  assert.deepEqual(
    parseAttwArguments([
      '--shard-index',
      '3',
      '--shard-total',
      '4',
      '--tarball',
      '/tmp/package.tgz',
    ]),
    { shardIndex: 3, shardTotal: 4, tarball: '/tmp/package.tgz' },
  );
  assert.throws(() => parseAttwArguments(['--shard-index', '1']), /specified together/u);
  assert.throws(() => parseAttwArguments(['--shard-total', '4']), /specified together/u);
  assert.throws(
    () => parseAttwArguments(['--shard-index', '5', '--shard-total', '4']),
    /exceeds/u,
  );
  assert.throws(() => parseAttwArguments(['--shard-index', 'nope']), /positive integer/u);
  assert.throws(() => parseAttwArguments(['--unknown']), /Unknown ATTW argument/u);

  const command = attwCommandArguments(['.', './all.js'], '/tmp/package.tgz');
  assert.deepEqual(command.slice(0, 5), ['exec', 'attw', '--profile', 'esm-only', '--entrypoints']);
  assert.deepEqual(command.slice(-4), ['--format', 'table', '--summary', '/tmp/package.tgz']);
  assert.doesNotMatch(command.join(' '), /exclude-entrypoints/u);
});

test('the packed-consumer default remains full and only accepts an explicit ATTW skip', () => {
  assert.deepEqual(parsePackedConsumerArguments([]), { runAttw: true });
  assert.deepEqual(parsePackedConsumerArguments(['--skip-attw']), { runAttw: false });
  assert.throws(() => parsePackedConsumerArguments(['--skip-attw', '--skip-attw']), /once/u);
  assert.throws(() => parsePackedConsumerArguments(['--skip-publint']), /Unknown/u);
});

test('rejects malformed exports maps instead of silently checking an empty subset', () => {
  assert.throws(() => attwEntrypoints({}), /exports object/u);
  assert.throws(() => attwEntrypoints({ exports: {} }), /no typed/u);
  assert.throws(() => attwEntrypoints({ exports: { public: './dist/public.js' } }), /Invalid/u);
});
