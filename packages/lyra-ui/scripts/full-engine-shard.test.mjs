import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  discoverTestFiles,
  nativeScrollbarVerificationCommand,
  NATIVE_SCROLLBAR_TEST_FILE,
  readShardConfiguration,
  runNativeScrollbarVerification,
  runShard,
  shardTestFiles,
  shouldRunNativeScrollbarVerification,
} from './full-engine-shard.mjs';

test('discovers only src/**/*.test.ts files in lexical order', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'lyra-full-engine-shard-'));
  try {
    await mkdir(join(fixture, 'src', 'nested'), { recursive: true });
    await Promise.all([
      writeFile(join(fixture, 'src', 'z.test.ts'), ''),
      writeFile(join(fixture, 'src', 'a.test.ts'), ''),
      writeFile(join(fixture, 'src', 'nested', 'b.test.ts'), ''),
      writeFile(join(fixture, 'src', 'nested', 'b.native-scrollbar.test.ts'), ''),
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

test('reserves native-scrollbar evidence for its owner shard', () => {
  assert.equal(shouldRunNativeScrollbarVerification([]), false);
  assert.equal(shouldRunNativeScrollbarVerification(['src/example.test.ts']), false);
  assert.equal(
    shouldRunNativeScrollbarVerification([
      'src/components/data/data-grid/data-grid.test.ts',
    ]),
    true,
  );
});

test('uses a one-file native mode and confines Xvfb to native headed engines', () => {
  const chromium = nativeScrollbarVerificationCommand('chromium', {
    executable: 'wtr',
  });
  assert.deepEqual(chromium, {
    command: 'wtr',
    args: [NATIVE_SCROLLBAR_TEST_FILE],
  });

  const firefox = nativeScrollbarVerificationCommand('firefox', {
    executable: 'wtr',
  });
  assert.deepEqual(firefox, {
    command: 'xvfb-run',
    args: ['-a', 'wtr', NATIVE_SCROLLBAR_TEST_FILE],
  });

  for (const browser of ['webkit', 'safari']) {
    assert.deepEqual(nativeScrollbarVerificationCommand(browser, { executable: 'wtr' }), {
      command: 'xvfb-run',
      args: ['-a', 'dbus-run-session', '--', 'wtr', NATIVE_SCROLLBAR_TEST_FILE],
    });
  }
});

test('runs the native verification coverage-free only after its owner shard passes', () => {
  const ownerFiles = ['src/components/data/data-grid/data-grid.test.ts'];
  const calls = [];
  const status = runNativeScrollbarVerification(ownerFiles, {
    browser: 'firefox',
    environment: {
      SENTINEL: 'preserved',
      WTR_COVERAGE: '1',
      WTR_COVERAGE_REPORT_DIR: 'coverage/shards/coverage-shard-1',
    },
    packageDirectory: '/tmp/lyra-native-scrollbar',
    spawn: (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0 };
    },
  });

  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'xvfb-run');
  assert.deepEqual(calls[0].args, [
    '-a',
    join(
      '/tmp/lyra-native-scrollbar',
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'wtr.cmd' : 'wtr',
    ),
    NATIVE_SCROLLBAR_TEST_FILE,
  ]);
  assert.equal(calls[0].options.env.SENTINEL, 'preserved');
  assert.equal(calls[0].options.env.WTR_NATIVE_SCROLLBAR, '1');
  assert.equal('WTR_COVERAGE' in calls[0].options.env, false);
  assert.equal('WTR_COVERAGE_REPORT_DIR' in calls[0].options.env, false);
});

test('fails clearly when the native Firefox lane cannot launch Xvfb', () => {
  assert.throws(
    () =>
      runNativeScrollbarVerification(['src/components/data/data-grid/data-grid.test.ts'], {
        browser: 'firefox',
        spawn: () => ({ error: Object.assign(new Error('not found'), { code: 'ENOENT' }) }),
      }),
    /requires xvfb-run/iu,
  );
});

test('propagates native verification results after, but not before, the owner shard', () => {
  const ownerFiles = ['src/components/data/data-grid/data-grid.test.ts'];
  const nativeCalls = [];
  const success = runShard(
    ownerFiles,
    { shardIndex: 1, shardTotal: 1 },
    { WTR_BROWSER: 'chromium' },
    {
      spawn: () => ({ status: 0 }),
      runNativeScrollbarVerification: (files, options) => {
        nativeCalls.push({ files, options });
        return 3;
      },
    },
  );
  assert.equal(success, 3);
  assert.equal(nativeCalls.length, 1);
  assert.deepEqual(nativeCalls[0].files, ownerFiles);
  assert.equal(nativeCalls[0].options.browser, 'chromium');

  let ranNative = false;
  const failed = runShard(
    ownerFiles,
    { shardIndex: 1, shardTotal: 1 },
    { WTR_BROWSER: 'chromium' },
    {
      spawn: () => ({ status: 2 }),
      runNativeScrollbarVerification: () => {
        ranNative = true;
        return 0;
      },
    },
  );
  assert.equal(failed, 2);
  assert.equal(ranNative, false);
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

test('keeps the expensive package-entrypoint contract from dominating one full-suite shard', () => {
  const heavyweight = 'src/package-entrypoints.test.ts';
  const files = [
    heavyweight,
    ...Array.from({ length: 15 }, (_value, index) => `src/component-${index}.test.ts`),
  ];

  const shards = [1, 2, 3, 4].map((index) => shardTestFiles(files, index, 4));
  const heavyweightShard = shards.find((shard) => shard.includes(heavyweight));

  assert.ok(heavyweightShard);
  const companionCounts = shards
    .filter((shard) => shard !== heavyweightShard)
    .map((shard) => shard.length);
  assert.ok(
    heavyweightShard.length < Math.min(...companionCounts),
  );
  assert.deepEqual([...shards.flat()].sort(), [...files].sort());
  assert.equal(new Set(shards.flat()).size, files.length);
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
