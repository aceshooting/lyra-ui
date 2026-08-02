import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  discoverTestFiles,
  readShardConfiguration,
  shardTestFiles,
} from './full-engine-shard.mjs';

test('discovers only src/**/*.test.ts files in lexical order', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'lyra-full-engine-shard-'));
  try {
    await mkdir(join(fixture, 'src', 'nested'), { recursive: true });
    await Promise.all([
      writeFile(join(fixture, 'src', 'z.test.ts'), ''),
      writeFile(join(fixture, 'src', 'a.test.ts'), ''),
      writeFile(join(fixture, 'src', 'nested', 'b.test.ts'), ''),
      writeFile(join(fixture, 'src', 'nested', 'ignored.ts'), ''),
      writeFile(join(fixture, 'src', 'nested', 'ignored.test.js'), ''),
    ]);

    assert.deepEqual(await discoverTestFiles(fixture), [
      'src/a.test.ts',
      'src/nested/b.test.ts',
      'src/z.test.ts',
    ]);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('creates deterministic, disjoint, exhaustive round-robin shards', () => {
  const files = [
    'src/g.test.ts',
    'src/c.test.ts',
    'src/a.test.ts',
    'src/f.test.ts',
    'src/e.test.ts',
    'src/b.test.ts',
    'src/d.test.ts',
  ];

  const shards = [1, 2, 3].map((index) => shardTestFiles(files, index, 3));
  assert.deepEqual(shards, [
    ['src/a.test.ts', 'src/d.test.ts', 'src/g.test.ts'],
    ['src/b.test.ts', 'src/e.test.ts'],
    ['src/c.test.ts', 'src/f.test.ts'],
  ]);
  assert.deepEqual([...shards.flat()].sort(), [...files].sort());
  assert.equal(new Set(shards.flat()).size, files.length);
  assert.deepEqual(shardTestFiles([...files].reverse(), 1, 3), shards[0]);
});

test('validates environment shard coordinates', () => {
  assert.deepEqual(
    readShardConfiguration({ WTR_SHARD_INDEX: '2', WTR_SHARD_TOTAL: '4' }),
    { shardIndex: 2, shardTotal: 4 },
  );
  assert.throws(
    () => readShardConfiguration({ WTR_SHARD_INDEX: '0', WTR_SHARD_TOTAL: '4' }),
    /WTR_SHARD_INDEX must be a positive integer/,
  );
  assert.throws(
    () => readShardConfiguration({ WTR_SHARD_INDEX: '5', WTR_SHARD_TOTAL: '4' }),
    /cannot exceed/,
  );
  assert.throws(() => shardTestFiles([], 1, 0), /shardTotal must be a positive integer/);
});
