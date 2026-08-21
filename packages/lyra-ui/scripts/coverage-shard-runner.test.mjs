import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  COVERAGE_SHARD_TOTAL,
  coverageShardDirectory,
  executeCoverageCommand,
  mergeCoverageReports,
  parseCoverageArguments,
  runCoverageShard,
  validateCoverageShardManifests,
} from './coverage-shard-runner.mjs';
import { shardTestFiles } from './full-engine-shard.mjs';

const inventory = Array.from({ length: 12 }, (_value, index) =>
  `src/component-${String(index + 1).padStart(2, '0')}.test.ts`,
);

function fileCoverage(sourcePath, hits = 1) {
  return {
    path: sourcePath,
    statementMap: {
      0: {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 1 },
      },
    },
    fnMap: {},
    branchMap: {},
    s: { 0: hits },
    f: {},
    b: {},
  };
}

async function writeShardFixture(coverageDirectory, shardIndex, testFiles = inventory) {
  const directory = coverageShardDirectory(coverageDirectory, shardIndex);
  const selectedFiles = shardTestFiles(testFiles, shardIndex, COVERAGE_SHARD_TOTAL);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(
      join(directory, 'test-files.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        shardIndex,
        shardTotal: COVERAGE_SHARD_TOTAL,
        testFiles: selectedFiles,
      }, null, 2)}\n`,
    ),
    writeFile(
      join(directory, 'coverage-final.json'),
      `${JSON.stringify({
        [`/workspace/src/source-${shardIndex}.ts`]: fileCoverage(
          `/workspace/src/source-${shardIndex}.ts`,
        ),
      })}\n`,
    ),
    writeFile(
      join(directory, 'junit.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites><testsuite name="shard-${shardIndex}" tests="1" failures="0" /></testsuites>\n`,
    ),
  ]);
  return directory;
}

async function writeCompleteFixture(coverageDirectory, testFiles = inventory) {
  await Promise.all(
    Array.from({ length: COVERAGE_SHARD_TOTAL }, (_value, index) =>
      writeShardFixture(coverageDirectory, index + 1, testFiles),
    ),
  );
}

test('parses only the full, single-shard, and merge coverage commands', () => {
  assert.deepEqual(parseCoverageArguments([]), { mode: 'all' });
  assert.deepEqual(parseCoverageArguments(['--shard', '2']), {
    mode: 'shard',
    shardIndex: 2,
  });
  assert.deepEqual(parseCoverageArguments(['--merge']), { mode: 'merge' });

  for (const args of [
    ['--shard'],
    ['--shard', '0'],
    ['--shard', '5'],
    ['--shard', '2.5'],
    ['--merge', '1'],
    ['--unknown'],
  ]) {
    assert.throws(() => parseCoverageArguments(args), /coverage|shard|usage/iu);
  }
});

test('dispatches one selected shard without merging or cleaning other shard artifacts', async () => {
  const actions = [];
  const result = await executeCoverageCommand(
    { mode: 'shard', shardIndex: 3 },
    {
      discover: async () => inventory,
      runShard: (shardIndex, testFiles) => {
        actions.push(['run', shardIndex, testFiles]);
        return 0;
      },
      merge: () => actions.push(['merge']),
      cleanup: () => actions.push(['cleanup']),
    },
  );

  assert.equal(result, 0);
  assert.deepEqual(actions, [['run', 3, inventory]]);
});

test('keeps the default command sequential, exhaustive, merged, and cleaned', async () => {
  const actions = [];
  const result = await executeCoverageCommand(
    { mode: 'all' },
    {
      discover: async () => inventory,
      runShard: (shardIndex) => {
        actions.push(`run-${shardIndex}`);
        return shardIndex === 2 ? 1 : 0;
      },
      merge: () => actions.push('merge'),
      cleanup: () => actions.push('cleanup'),
    },
  );

  assert.equal(result, 1);
  assert.deepEqual(actions, ['run-1', 'run-2', 'run-3', 'run-4', 'merge', 'cleanup']);
});

test('the merge command performs no browser work and retains downloaded artifacts', async () => {
  const actions = [];
  const result = await executeCoverageCommand(
    { mode: 'merge' },
    {
      discover: async () => inventory,
      runShard: () => actions.push('run'),
      merge: (testFiles) => actions.push(['merge', testFiles]),
      cleanup: () => actions.push('cleanup'),
    },
  );

  assert.equal(result, 0);
  assert.deepEqual(actions, [['merge', inventory]]);
});

test('command execution fails closed on a mode that bypassed argument parsing', async () => {
  await assert.rejects(
    executeCoverageCommand(
      { mode: 'unexpected' },
      { discover: async () => inventory },
    ),
    /unsupported coverage command/iu,
  );
});

test('runs exactly the deterministic shard selection and writes its manifest before WTR', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'lyra-coverage-shard-runner-'));
  try {
    const calls = [];
    const packageDirectory = join(fixture, 'package');
    const result = runCoverageShard(2, inventory, {
      coverageDirectory: fixture,
      environment: { SENTINEL: 'preserved' },
      packageDirectory,
      spawn: (executable, files, options) => {
        calls.push({ executable, files, options });
        return { status: 0 };
      },
    });

    assert.equal(result, 0);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].executable,
      join(
        packageDirectory,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'wtr.cmd' : 'wtr',
      ),
    );
    assert.deepEqual(calls[0].files, shardTestFiles(inventory, 2, COVERAGE_SHARD_TOTAL));
    assert.equal(calls[0].options.env.SENTINEL, 'preserved');
    assert.equal(calls[0].options.env.WTR_COVERAGE, '1');
    assert.equal(
      calls[0].options.env.WTR_COVERAGE_REPORT_DIR,
      coverageShardDirectory(fixture, 2),
    );

    const manifest = JSON.parse(
      await readFile(join(coverageShardDirectory(fixture, 2), 'test-files.json'), 'utf8'),
    );
    assert.deepEqual(manifest, {
      schemaVersion: 1,
      shardIndex: 2,
      shardTotal: COVERAGE_SHARD_TOTAL,
      testFiles: shardTestFiles(inventory, 2, COVERAGE_SHARD_TOTAL),
    });
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('validates deterministic, disjoint, exhaustive shard manifests', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'lyra-coverage-manifests-'));
  try {
    await writeCompleteFixture(fixture);
    assert.deepEqual(
      validateCoverageShardManifests(inventory, { coverageDirectory: fixture }),
      Array.from({ length: COVERAGE_SHARD_TOTAL }, (_value, index) => index + 1),
    );

    const firstManifestPath = join(coverageShardDirectory(fixture, 1), 'test-files.json');
    const secondManifestPath = join(coverageShardDirectory(fixture, 2), 'test-files.json');
    const first = JSON.parse(await readFile(firstManifestPath, 'utf8'));
    const second = JSON.parse(await readFile(secondManifestPath, 'utf8'));
    second.testFiles.push(first.testFiles[0]);
    await writeFile(secondManifestPath, `${JSON.stringify(second, null, 2)}\n`);
    assert.throws(
      () => validateCoverageShardManifests(inventory, { coverageDirectory: fixture }),
      /duplicate|disjoint/iu,
    );

    await writeCompleteFixture(fixture);
    const missing = JSON.parse(await readFile(firstManifestPath, 'utf8'));
    missing.testFiles.shift();
    await writeFile(firstManifestPath, `${JSON.stringify(missing, null, 2)}\n`);
    assert.throws(
      () => validateCoverageShardManifests(inventory, { coverageDirectory: fixture }),
      /exhaustive|missing/iu,
    );

    await writeCompleteFixture(fixture);
    const swappedFirst = JSON.parse(await readFile(firstManifestPath, 'utf8'));
    const swappedSecond = JSON.parse(await readFile(secondManifestPath, 'utf8'));
    const firstFile = swappedFirst.testFiles.shift();
    const secondFile = swappedSecond.testFiles.shift();
    swappedFirst.testFiles.push(secondFile);
    swappedSecond.testFiles.push(firstFile);
    swappedFirst.testFiles.sort();
    swappedSecond.testFiles.sort();
    await Promise.all([
      writeFile(firstManifestPath, `${JSON.stringify(swappedFirst, null, 2)}\n`),
      writeFile(secondManifestPath, `${JSON.stringify(swappedSecond, null, 2)}\n`),
    ]);
    assert.throws(
      () => validateCoverageShardManifests(inventory, { coverageDirectory: fixture }),
      /deterministic|assignment/iu,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('merges all raw coverage and junit reports into the established top-level outputs', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'lyra-coverage-merge-'));
  try {
    await writeCompleteFixture(fixture);
    mergeCoverageReports(inventory, { coverageDirectory: fixture });

    const summary = JSON.parse(await readFile(join(fixture, 'coverage-summary.json'), 'utf8'));
    assert.equal(summary.total.statements.total, COVERAGE_SHARD_TOTAL);
    assert.equal(summary.total.statements.covered, COVERAGE_SHARD_TOTAL);
    assert.equal(existsSync(join(fixture, 'lcov.info')), true);

    const junit = await readFile(join(fixture, 'junit.xml'), 'utf8');
    assert.equal((junit.match(/<testsuite name=/gu) ?? []).length, COVERAGE_SHARD_TOTAL);
    assert.match(junit, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<testsuites>/u);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('merge fails closed when any raw coverage, junit, or shard manifest is absent', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'lyra-coverage-missing-'));
  try {
    await writeCompleteFixture(fixture);
    await unlink(join(coverageShardDirectory(fixture, 2), 'coverage-final.json'));
    assert.throws(
      () => mergeCoverageReports(inventory, { coverageDirectory: fixture }),
      /shard 2\/4.*coverage-final\.json/iu,
    );

    await writeShardFixture(fixture, 2);
    await unlink(join(coverageShardDirectory(fixture, 4), 'junit.xml'));
    assert.throws(
      () => mergeCoverageReports(inventory, { coverageDirectory: fixture }),
      /shard 4\/4.*junit\.xml/iu,
    );

    await writeShardFixture(fixture, 4);
    await unlink(join(coverageShardDirectory(fixture, 3), 'test-files.json'));
    assert.throws(
      () => mergeCoverageReports(inventory, { coverageDirectory: fixture }),
      /shard 3\/4.*test-files\.json/iu,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
