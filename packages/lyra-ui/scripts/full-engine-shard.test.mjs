import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';

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
import { costsFromTimingReports, readCosts } from './ci-costs.mjs';
import { waitUntilPollIntervalPlugin } from './wait-until-poll-interval.mjs';

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

test('runs Linux Firefox shards headed under Xvfb without native-scrollbar mode', () => {
  const files = ['src/example.test.ts'];
  const environment = { WTR_BROWSER: 'firefox', WTR_STRICT_CONSOLE: '1', WTR_CONCURRENCY: '1' };
  const calls = [];
  const status = runShard(files, { shardIndex: 1, shardTotal: 1 }, environment, {
    platform: 'linux',
    spawn: (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0 };
    },
    runNativeScrollbarVerification: () => 0,
  });
  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'xvfb-run');
  assert.deepEqual(calls[0].args, ['-a', 'wtr', ...files]);
  assert.deepEqual(calls[0].options.env, { ...environment, WTR_HEADED: '1' });
  assert.equal('WTR_NATIVE_SCROLLBAR' in calls[0].options.env, false);
  assert.equal('WTR_HEADED' in environment, false);
});

test('preserves ordinary launches outside Linux Firefox', () => {
  for (const [platform, browser] of [['linux', 'chromium'], ['linux', 'webkit'], ['darwin', 'firefox']]) {
    let call;
    const environment = { WTR_BROWSER: browser };
    assert.equal(runShard(['src/example.test.ts'], { shardIndex: 1, shardTotal: 1 }, environment, {
      platform,
      spawn: (command, args, options) => {
        call = { command, args, options };
        return { status: 2 };
      },
    }), 2);
    assert.equal(call.command, 'wtr');
    assert.deepEqual(call.args, ['src/example.test.ts']);
    assert.equal(call.options.env, environment);
  }
});

test('keeps Linux Firefox platform contracts outside automatic headed routing', () => {
  const environment = { WTR_BROWSER: 'firefox', WTR_TEST_SUITE: ' PLATFORM ' };
  let call;
  assert.equal(runShard(['src/example.test.ts'], { shardIndex: 1, shardTotal: 1 }, environment, {
    platform: 'linux',
    spawn: (command, args, options) => {
      call = { command, args, options };
      return { status: 2 };
    },
  }), 2);
  assert.equal(call.command, 'wtr');
  assert.deepEqual(call.args, ['src/example.test.ts']);
  assert.equal(call.options.env, environment);
});

test('fails clearly when Linux Firefox cannot launch Xvfb', () => {
  assert.throws(() => runShard(['src/example.test.ts'], { shardIndex: 1, shardTotal: 1 },
    { WTR_BROWSER: 'firefox' }, {
      platform: 'linux',
      spawn: () => ({ error: Object.assign(new Error('not found'), { code: 'ENOENT' }) }),
    }), /Firefox full-engine tests require xvfb-run/u);
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

test('balances the live test inventory by measured time across the CI shard counts', async () => {
  const { costs, fallback } = readCosts('tests');
  const files = await discoverTestFiles();
  assert.ok(
    files.filter((file) => costs.has(file)).length / files.length >= 0.85,
    'scripts/fixtures/test-file-costs.json is stale; regenerate it with ci-costs.mjs from the lyra-ui-test-timing artifacts',
  );
  for (const total of [5, 8]) {
    const shards = Array.from({ length: total }, (_value, index) => shardTestFiles(files, index + 1, total));
    assert.deepEqual(shards.flat().sort(), [...files].sort());
    const loads = shards.map((shard) => shard.reduce((sum, file) => sum + (costs.get(file) ?? fallback), 0));
    assert.ok(Math.max(...loads) / Math.min(...loads) < 1.05, loads.map(Math.round).join('/'));
  }
});

test('derives cost tables from timing lines and reads them fail-closed', async () => {
  assert.deepEqual(
    costsFromTimingReports('tests', [
      `${JSON.stringify({ file: 'src/b.test.ts', deltaMs: 1234 })}\n${JSON.stringify({ file: 'src/a.test.ts', deltaMs: 40 })}`,
      JSON.stringify({ file: 'src/b.test.ts', deltaMs: 2049 }),
    ]),
    { 'src/a.test.ts': 0.1, 'src/b.test.ts': 1.6 },
  );
  assert.deepEqual(
    costsFromTimingReports('tests', [1000, 1100, 9000].map((deltaMs) => JSON.stringify({ file: 'src/c.test.ts', deltaMs }))),
    { 'src/c.test.ts': 1.1 },
  );
  assert.deepEqual(costsFromTimingReports('lint', [JSON.stringify({ command: 'pnpm run a', seconds: 12.34 })]), { 'pnpm run a': 12.3 });
  assert.throws(() => costsFromTimingReports('tests', ['']), /No tests timing records/u);
  assert.throws(() => costsFromTimingReports('lint', [JSON.stringify({ seconds: 1 })]), /Invalid lint/u);
  const fixture = await mkdtemp(join(tmpdir(), 'lyra-costs-'));
  try {
    const file = join(fixture, 'costs.json');
    await writeFile(file, JSON.stringify({ a: 1, b: 3, c: 10 }));
    assert.equal(readCosts('tests', file).fallback, 3);
    await writeFile(file, JSON.stringify({ a: 0 }));
    assert.throws(() => readCosts('tests', file), /positive seconds/u);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
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

test('keeps the waitUntil poll-interval patch of web-test-runner.config.js applicable', () => {
  // pnpm links a package's dependencies beside its real directory.
  const testing = realpathSync(new URL('../node_modules/@open-wc/testing', import.meta.url));
  const helpers = join(testing, '..', 'testing-helpers', 'src', 'helpers.js');
  assert.ok(
    /\{\s*interval\s*=\s*50\s*,/u.test(readFileSync(helpers, 'utf8')),
    'the waitUntil default moved: update waitUntilPollIntervalPlugin in web-test-runner.config.js',
  );
});

test('patches only the helper JavaScript served by the polling plugin', () => {
  const body = 'const { interval = 50, timeout = 1000 } = options;';
  const context = (path, type = 'js') => ({ path, body, response: { is: (expected) => expected === type } });
  assert.equal(
    waitUntilPollIntervalPlugin.transform(context('/node_modules/@open-wc/testing-helpers/src/helpers.js')),
    'const { interval = 10, timeout = 1000 } = options;',
  );
  for (const [path, type] of [
    ['/node_modules/other/src/helpers.js', 'js'],
    ['/node_modules/@open-wc/testing-helpers/src/other.js', 'js'],
    ['/node_modules/@open-wc/testing-helpers/src/helpers.js', 'html'],
  ]) assert.equal(waitUntilPollIntervalPlugin.transform(context(path, type)), undefined);
});

test('polls the transformed installed helper at 10ms while preserving explicit options and timeouts', async () => {
  const testing = realpathSync(new URL('../node_modules/@open-wc/testing', import.meta.url));
  const path = join(testing, '..', 'testing-helpers', 'src', 'helpers.js');
  const require = createRequire(import.meta.url);
  const esbuild = createRequire(require.resolve('@web/dev-server-esbuild'))('esbuild');
  const { code } = await esbuild.transform(readFileSync(path, 'utf8'), { target: 'es2022', format: 'cjs' });
  const transformed = waitUntilPollIntervalPlugin.transform({
    path,
    body: code,
    response: { is: (type) => type === 'js' },
  });
  const timers = [];
  // The installed module has no imports. Evaluate it with scoped timers so assertions observe
  // requested delays without depending on wall-clock scheduling or modifying browser globals.
  const waitUntil = new Function('setTimeout', 'clearTimeout', `const module = { exports: {} }; ${transformed}; return module.exports.waitUntil;`)(
    (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    () => {},
  );
  for (const [options, interval, timeout] of [[undefined, 10, 1000], [{ interval: 73, timeout: 1234 }, 73, 1234]]) {
    timers.length = 0;
    let calls = 0;
    const ready = waitUntil(() => ++calls === 2, undefined, options);
    await Promise.resolve();
    assert.deepEqual(timers.map((timer) => timer.delay), [timeout, interval]);
    timers[1].callback();
    await ready;
    assert.equal(calls, 2);
  }
  timers.length = 0;
  const pending = waitUntil(() => false, 'still pending', { timeout: 321 });
  const rejection = assert.rejects(pending, /Timeout: still pending/u);
  timers[0].callback();
  await rejection;
  assert.equal(timers[0].delay, 321);
});
