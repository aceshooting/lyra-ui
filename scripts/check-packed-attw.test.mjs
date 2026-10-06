import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  ATTW_CI_SHARD_TOTAL,
  ATTW_CI_WORKERS,
  attwCommandArguments,
  attwEntrypoints,
  validatePackedAttwManifest,
  parseAttwArguments,
  parsePackedConsumerArguments,
  partitionAttwEntrypoints,
} from './packed-attw.mjs';

const manifest = JSON.parse(
  await readFile(new URL('../packages/lyra-ui/package.json', import.meta.url), 'utf8'),
);

test('checks every live typed export while preserving blocked retired routes', () => {
  const entrypoints = attwEntrypoints(manifest);
  assert.equal(entrypoints.length, 2444, 'the reviewed package has 2444 live typed exports');
  assert.ok(entrypoints.includes('.'));
  assert.ok(entrypoints.includes('./package.json'));
  assert.ok(entrypoints.includes('./theme/*'));
  assert.ok(entrypoints.includes('./theme/looks/shadcn.js'), 'current look routes remain checked');
  assert.ok(entrypoints.includes('./components/lr-currency-picker.js'));
  assert.ok(entrypoints.includes('./components/forms/currency-picker/currency-picker.class.js'));
  for (const name of ['country-picker', 'time-zone-picker', 'unit-picker']) {
    assert.ok(entrypoints.includes(`./components/lr-${name}.js`), `${name} stable registration is checked`);
    assert.ok(entrypoints.includes(`./components/forms/${name}/${name}.class.js`), `${name} class is checked`);
  }
  for (const name of ['currency', 'countries', 'time-zones', 'units']) {
    assert.ok(entrypoints.includes(`./${name}.js`), `${name} public helper is checked`);
  }
  for (const route of ['./utilities/*', './theme/presets.js', './theme/presets/shadcn.js']) {
    assert.equal(manifest.exports[route], null, `${route} remains an explicit closed door`);
    assert.ok(!entrypoints.includes(route), `${route} has no typed target for ATTW to resolve`);
  }
  assert.ok(entrypoints.every((entrypoint) => !entrypoint.endsWith('.css')));
  assert.ok(!entrypoints.includes('./theme-bootstrap.js'), 'classic-script assets are untyped by design');

  const shards = Array.from({ length: ATTW_CI_SHARD_TOTAL }, (_, index) =>
    partitionAttwEntrypoints(entrypoints, index + 1, ATTW_CI_SHARD_TOTAL),
  );
  const entriesPerShard = Math.floor(entrypoints.length / ATTW_CI_SHARD_TOTAL);
  const largerShardCount = entrypoints.length % ATTW_CI_SHARD_TOTAL;
  assert.deepEqual(
    shards.map((shard) => shard.length),
    Array.from({ length: ATTW_CI_SHARD_TOTAL }, (_, index) =>
      entriesPerShard + (index < largerShardCount ? 1 : 0),
    ),
  );
  assert.equal(new Set(shards.flat()).size, entrypoints.length, 'shards are disjoint');
  assert.deepEqual(shards.flat().sort(), entrypoints, 'shards cover every typed export');

  // Each CI job splits its shard once more across its concurrent workers.
  const workerPartitions = shards.flatMap((shard) =>
    Array.from({ length: ATTW_CI_WORKERS }, (_, index) =>
      partitionAttwEntrypoints(shard, index + 1, ATTW_CI_WORKERS),
    ),
  );
  assert.ok(workerPartitions.every((partition) => partition.length > 0), 'no worker is idle');
  assert.equal(new Set(workerPartitions.flat()).size, entrypoints.length, 'worker partitions are disjoint');
  assert.deepEqual(workerPartitions.flat().sort(), entrypoints, 'worker partitions cover every typed export');
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
    workers: 1,
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
    { shardIndex: 3, shardTotal: 4, tarball: '/tmp/package.tgz', workers: 1 },
  );
  assert.deepEqual(
    parseAttwArguments(['--shard-index', '2', '--shard-total', '4', '--workers', '4']),
    { shardIndex: 2, shardTotal: 4, tarball: undefined, workers: 4 },
  );
  assert.throws(() => parseAttwArguments(['--workers', '0']), /positive integer/u);
  assert.throws(() => parseAttwArguments(['--workers']), /positive integer/u);
  assert.throws(() => parseAttwArguments(['--workers', '2', '--workers', '2']), /once/u);
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
  assert.throws(() => attwEntrypoints({ exports: { './retired.js': null } }), /no typed/u);
  assert.throws(() => attwEntrypoints({ exports: { public: './dist/public.js' } }), /Invalid/u);
});


test('packed manifest must match checkout identity and ordered export conditions', () => {
  const source = { name: '@example/ui', version: '22.0.0', exports: {
    '.': { types: './dist/index.d.ts', default: './dist/index.js' },
    './style.css': './dist/style.css',
  } };
  const packed = structuredClone(source);
  assert.deepEqual(validatePackedAttwManifest(packed, source), ['.']);
  for (const key of ['name', 'version']) {
    assert.throws(() => validatePackedAttwManifest({ ...packed, [key]: 'wrong' }, source), new RegExp(key, 'u'));
  }
  for (const exports of [undefined, {}, { ...packed.exports, './extra.js': './extra.js' },
    { ...packed.exports, '.': { types: './wrong.d.ts', default: './dist/index.js' } },
    { ...packed.exports, '.': { default: './dist/index.js', types: './dist/index.d.ts' } }]) {
    assert.throws(() => validatePackedAttwManifest({ ...packed, exports }, source), /exports/u);
  }
  assert.throws(() => validatePackedAttwManifest(null, source), /manifest/u);
});


test('runner rejects a foreign real tarball before invoking ATTW', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-attw-manifest-'));
  try {
    await mkdir(join(directory, 'package'));
    await writeFile(join(directory, 'package/package.json'), JSON.stringify({ ...manifest, version: '0.0.0-foreign' }));
    const tarball = join(directory, 'foreign.tgz');
    execFileSync('tar', ['-czf', tarball, '-C', directory, 'package']);
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL('./check-packed-attw.mjs', import.meta.url)), '--tarball', tarball,
    ], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Packed package version does not match/u);
    assert.doesNotMatch(result.stdout, /ATTW shard|package SHA-256/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
