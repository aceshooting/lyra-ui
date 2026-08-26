import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LINT_SHARD_TOTAL,
  buildLintInventory,
  parseLintShardArguments,
  partitionLintInventory,
  readPackageScripts,
  runLintShard,
} from './lint-ci-shard.mjs';

const currentScripts = readPackageScripts();

function commandCounts(commands) {
  const counts = new Map();
  for (const command of commands) {
    counts.set(command, (counts.get(command) ?? 0) + 1);
  }
  return counts;
}

function withScripts(overrides) {
  return { ...currentScripts, ...overrides };
}

test('partitions all 85 current lint command occurrences exactly once', () => {
  const inventory = buildLintInventory(currentScripts);
  const lanes = partitionLintInventory(inventory);
  const selected = lanes.flatMap((lane) => lane.commands);

  assert.equal(inventory.length, 85);
  assert.equal(inventory.filter((item) => item.source === 'contract-policy').length, 82);
  assert.deepEqual(
    inventory.slice(-3).map((item) => item.command),
    [
      'tsc --noEmit -p tsconfig.json',
      'pnpm run test:types',
      'pnpm run check:test-types',
    ],
  );
  assert.deepEqual(
    selected.map((item) => item.ordinal).sort((left, right) => left - right),
    Array.from({ length: inventory.length }, (_unused, index) => index + 1),
  );
  assert.deepEqual(
    commandCounts(selected.map((item) => item.command)),
    commandCounts(inventory.map((item) => item.command)),
  );
  assert.equal(new Set(selected.map((item) => item.ordinal)).size, inventory.length);
  assert.deepEqual(lanes.map((lane) => lane.totalWeight), [170, 170, 170]);
  for (const lane of lanes) {
    assert.deepEqual(
      lane.commands.map((item) => item.ordinal),
      lane.commands.map((item) => item.ordinal).sort((left, right) => left - right),
    );
  }
});

test('produces the same exhaustive weighted assignment on every call', () => {
  const inventory = buildLintInventory(currentScripts);
  const first = partitionLintInventory(inventory);
  const second = partitionLintInventory(inventory.map((item) => ({ ...item })));

  assert.deepEqual(second, first);
  assert.deepEqual(
    first.map((lane) => [lane.shardIndex, lane.shardTotal]),
    [[1, LINT_SHARD_TOTAL], [2, LINT_SHARD_TOTAL], [3, LINT_SHARD_TOTAL]],
  );
});

test('assigns unknown valid commands and preserves repeated occurrences by ordinal', () => {
  const futureCommand = 'pnpm run check:future-policy';
  const scripts = withScripts({
    'check:future-policy': 'node scripts/future-policy.mjs',
    'contract-policy': `${currentScripts['contract-policy']} && ${futureCommand} && ${futureCommand}`,
  });
  const inventory = buildLintInventory(scripts);
  const selected = partitionLintInventory(inventory).flatMap((lane) => lane.commands);

  assert.equal(inventory.length, 87);
  assert.equal(inventory.filter((item) => item.command === futureCommand).length, 2);
  assert.equal(selected.filter((item) => item.command === futureCommand).length, 2);
  assert.deepEqual(
    selected.map((item) => item.ordinal).sort((left, right) => left - right),
    Array.from({ length: inventory.length }, (_unused, index) => index + 1),
  );
});

test('rejects malformed policy chains, unsupported operators, and unsupported commands', () => {
  const first = 'pnpm run check:script-paths';
  const second = 'pnpm run test:script-paths';
  const invalidPolicies = [
    undefined,
    '',
    ` ${first}`,
    `${first} &&`,
    `${first} && && ${second}`,
    `${first}&&${second}`,
    `${first} || ${second}`,
    `${first}; ${second}`,
    `${first} | ${second}`,
    `node scripts/check-component-coverage.mjs && echo skipped`,
    'node scripts/../outside.mjs',
    'pnpm run missing-policy-script',
    'pnpm run contract-policy',
  ];

  for (const policy of invalidPolicies) {
    assert.throws(
      () => buildLintInventory(withScripts({ 'contract-policy': policy })),
      /contract-policy|command|operator|script|whitespace|chain/iu,
      String(policy),
    );
  }
});

test('requires the exact contract-policy lint wrapper and all three blocking type-checks', () => {
  const exactSuffix =
    'tsc --noEmit -p tsconfig.json && pnpm run test:types && pnpm run check:test-types';
  for (const lint of [
    exactSuffix,
    'pnpm run contract-policy',
    'pnpm run contract-policy && pnpm run test:types',
    'pnpm run contract-policy && pnpm run test:types && tsc --noEmit -p tsconfig.json',
    'pnpm run contract-policy && tsc --noEmit -p tsconfig.json && pnpm run test:types',
    `pnpm run contract-policy && ${exactSuffix} && pnpm run check:script-paths`,
    'pnpm run contract-policy; tsc --noEmit -p tsconfig.json && pnpm run test:types',
  ]) {
    assert.throws(
      () => buildLintInventory(withScripts({ lint })),
      /lint|wrapper|suffix|operator/iu,
      lint,
    );
  }
});

test('accepts only safe coordinates for the fixed three-lane partition', () => {
  assert.deepEqual(parseLintShardArguments(['--shard', '2/3']), {
    shardIndex: 2,
    shardTotal: 3,
  });

  for (const argv of [
    [],
    ['--shard'],
    ['--unknown', '1/3'],
    ['--shard', '1'],
    ['--shard', '0/3'],
    ['--shard', '1.5/3'],
    ['--shard', '4/3'],
    ['--shard', '1/2'],
    ['--shard', '1/4'],
    ['--shard', '1/3/3'],
    ['--shard', '9007199254740992/3'],
    ['--shard', '1/3', 'extra'],
  ]) {
    assert.throws(() => parseLintShardArguments(argv), /lint shard|usage|coordinate|integer/iu);
  }
  assert.throws(
    () => partitionLintInventory(buildLintInventory(currentScripts), 4),
    /shard total must remain 3/iu,
  );
});

test('executes original lane order and propagates the first non-zero child status', () => {
  const lane = partitionLintInventory(buildLintInventory(currentScripts))[0];
  const calls = [];
  const status = runLintShard(
    currentScripts,
    { shardIndex: 1, shardTotal: 3 },
    {
      cwd: '/fixture/package',
      environment: { SENTINEL: 'preserved' },
      platform: 'linux',
      spawn: (executable, args, options) => {
        calls.push({ executable, args, options });
        return { status: calls.length === 2 ? 7 : 0 };
      },
    },
  );

  assert.equal(status, 7);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map(({ executable, args }) => [executable, ...args].join(' ')),
    lane.commands.slice(0, 2).map((item) => item.command),
  );
  assert.equal(calls[0].options.cwd, '/fixture/package');
  assert.equal(calls[0].options.env.SENTINEL, 'preserved');
  assert.equal(calls[0].options.stdio, 'inherit');
});

test('propagates child spawn errors and signal termination', () => {
  const configuration = { shardIndex: 2, shardTotal: 3 };
  assert.throws(
    () =>
      runLintShard(currentScripts, configuration, {
        spawn: () => ({ error: new Error('spawn exploded') }),
      }),
    /spawn exploded/iu,
  );
  assert.throws(
    () =>
      runLintShard(currentScripts, configuration, {
        spawn: () => ({ status: null, signal: 'SIGTERM' }),
      }),
    /terminated by signal SIGTERM/iu,
  );
  assert.equal(
    runLintShard(currentScripts, configuration, {
      spawn: () => ({ status: null, signal: null }),
    }),
    1,
  );
});
