// Runs the coverage suite across several isolated `wtr` sessions instead of one long-lived
// single-session sweep across all ~500 files, then merges the results into the same
// coverage/lcov.info + coverage/coverage-summary.json + coverage/junit.xml a plain coverage run
// produces, in the same shape/location, so downstream consumers (check:coverage-floors and
// Codecov) need no report-format exceptions.
//
// The default command deliberately runs the shards one after another. `--shard N` exists for a
// hosted CI matrix, where each shard owns an independent runner; it does not raise browser-page
// concurrency inside a process. `--merge` consumes those jobs' raw reports and refuses partial,
// overlapping, non-exhaustive, or differently-partitioned inputs.
//
// Why shard at all: the former single session was observed dying silently near the tail of the
// full file list after cumulative pressure built up in one coverage-instrumented Chromium page.
// Isolating every suspect tail file ran clean, so bounding each page's lifetime is the relevant
// safeguard rather than excluding a component or increasing a timeout.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import { discoverTestFiles, shardTestFiles } from './full-engine-shard.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coverageDir = resolve(packageDir, 'coverage');
const SHARD_MANIFEST = 'test-files.json';
export const COVERAGE_SHARD_TOTAL = 4;

function shardIndices() {
  return Array.from({ length: COVERAGE_SHARD_TOTAL }, (_unused, index) => index + 1);
}

function positiveInteger(value, label) {
  const normalized = String(value ?? '');
  if (!/^[1-9]\d*$/u.test(normalized)) {
    throw new Error(`${label} must be a positive integer; received ${JSON.stringify(value)}.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} must be a safe positive integer; received ${JSON.stringify(value)}.`);
  }
  return parsed;
}

export function parseCoverageArguments(argv) {
  if (argv.length === 0) return { mode: 'all' };
  if (argv.length === 1 && argv[0] === '--merge') return { mode: 'merge' };
  if (argv.length === 2 && argv[0] === '--shard') {
    const shardIndex = positiveInteger(argv[1], 'coverage shard');
    if (shardIndex > COVERAGE_SHARD_TOTAL) {
      throw new Error(
        `Coverage shard ${shardIndex} exceeds the configured total of ${COVERAGE_SHARD_TOTAL}.`,
      );
    }
    return { mode: 'shard', shardIndex };
  }
  throw new Error(
    `Coverage usage: coverage-shard-runner.mjs [--shard 1-${COVERAGE_SHARD_TOTAL}|--merge].`,
  );
}

function coverageShardsDirectory(coverageDirectory) {
  return resolve(coverageDirectory, 'shards');
}

export function coverageShardDirectory(coverageDirectory, shardIndex) {
  const index = positiveInteger(shardIndex, 'coverage shard');
  if (index > COVERAGE_SHARD_TOTAL) {
    throw new Error(`Coverage shard ${index} exceeds the configured total of ${COVERAGE_SHARD_TOTAL}.`);
  }
  return resolve(coverageShardsDirectory(coverageDirectory), `coverage-shard-${index}`);
}

function manifestPayload(shardIndex, testFiles) {
  return {
    schemaVersion: 1,
    shardIndex,
    shardTotal: COVERAGE_SHARD_TOTAL,
    testFiles: shardTestFiles(testFiles, shardIndex, COVERAGE_SHARD_TOTAL),
  };
}

function writeShardManifest(directory, shardIndex, testFiles) {
  writeFileSync(
    resolve(directory, SHARD_MANIFEST),
    `${JSON.stringify(manifestPayload(shardIndex, testFiles), null, 2)}\n`,
  );
}

export function runCoverageShard(
  shardIndex,
  testFiles,
  {
    coverageDirectory = coverageDir,
    environment = process.env,
    packageDirectory = packageDir,
    spawn = spawnSync,
  } = {},
) {
  if (testFiles.length === 0) throw new Error('No coverage test files were discovered.');
  const files = shardTestFiles(testFiles, shardIndex, COVERAGE_SHARD_TOTAL);
  if (files.length === 0) {
    throw new Error(
      `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL} is empty for ${testFiles.length} test files.`,
    );
  }

  const directory = coverageShardDirectory(coverageDirectory, shardIndex);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  writeShardManifest(directory, shardIndex, testFiles);
  console.log(
    `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL}: ` +
      `${files.length} of ${testFiles.length} sorted test files.`,
  );

  const executable = resolve(
    packageDirectory,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wtr.cmd' : 'wtr',
  );
  const result = spawn(executable, files, {
    cwd: packageDirectory,
    env: {
      ...environment,
      WTR_COVERAGE: '1',
      WTR_COVERAGE_REPORT_DIR: directory,
    },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal) {
    throw new Error(
      `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL} was terminated by signal ${result.signal}.`,
    );
  }
  return result.status ?? 1;
}

function requiredShardFile(coverageDirectory, shardIndex, filename) {
  const file = resolve(coverageShardDirectory(coverageDirectory, shardIndex), filename);
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new Error(
      `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL} is missing ${filename} at ${file}.`,
    );
  }
  return file;
}

function readShardManifest(coverageDirectory, shardIndex) {
  const file = requiredShardFile(coverageDirectory, shardIndex, SHARD_MANIFEST);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL} has an invalid ${SHARD_MANIFEST}: ${error.message}`,
    );
  }
  if (
    manifest?.schemaVersion !== 1 ||
    manifest.shardIndex !== shardIndex ||
    manifest.shardTotal !== COVERAGE_SHARD_TOTAL ||
    !Array.isArray(manifest.testFiles) ||
    manifest.testFiles.length === 0 ||
    manifest.testFiles.some((filePath) => typeof filePath !== 'string' || filePath.length === 0)
  ) {
    throw new Error(
      `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL} has an invalid ${SHARD_MANIFEST} contract.`,
    );
  }
  return manifest;
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validateCoverageShardManifests(
  testFiles,
  { coverageDirectory = coverageDir } = {},
) {
  if (testFiles.length === 0) throw new Error('No coverage test files were discovered.');
  const indices = shardIndices();
  const manifests = indices.map((shardIndex) =>
    readShardManifest(coverageDirectory, shardIndex),
  );

  const owners = new Map();
  const duplicates = [];
  for (const manifest of manifests) {
    for (const filePath of manifest.testFiles) {
      const previousOwner = owners.get(filePath);
      if (previousOwner !== undefined) {
        duplicates.push(`${filePath} (shards ${previousOwner} and ${manifest.shardIndex})`);
      } else {
        owners.set(filePath, manifest.shardIndex);
      }
    }
  }
  if (duplicates.length > 0) {
    throw new Error(
      `Coverage shard manifests are not disjoint; duplicate test files: ${duplicates.join(', ')}.`,
    );
  }

  const expectedInventory = [...testFiles].sort();
  const actualInventory = [...owners.keys()].sort();
  if (!sameArray(actualInventory, expectedInventory)) {
    const actual = new Set(actualInventory);
    const expected = new Set(expectedInventory);
    const missing = expectedInventory.filter((filePath) => !actual.has(filePath));
    const unexpected = actualInventory.filter((filePath) => !expected.has(filePath));
    throw new Error(
      'Coverage shard manifests are not exhaustive for the current test inventory; ' +
        `missing: ${missing.join(', ') || '(none)'}; ` +
        `unexpected: ${unexpected.join(', ') || '(none)'}.`,
    );
  }

  for (const manifest of manifests) {
    const expected = shardTestFiles(
      testFiles,
      manifest.shardIndex,
      COVERAGE_SHARD_TOTAL,
    );
    if (!sameArray(manifest.testFiles, expected)) {
      throw new Error(
        `Coverage shard ${manifest.shardIndex}/${COVERAGE_SHARD_TOTAL} manifest does not match ` +
          'the deterministic shard assignment.',
      );
    }
  }
  return indices;
}

function loadShardCoverage(coverageDirectory, shardIndex) {
  const file = requiredShardFile(coverageDirectory, shardIndex, 'coverage-final.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL} has invalid coverage-final.json: ${error.message}`,
    );
  }
}

function mergeCoverageMap(coverageDirectory, indices) {
  const map = libCoverage.createCoverageMap({});
  for (const shardIndex of indices) {
    map.merge(loadShardCoverage(coverageDirectory, shardIndex));
  }
  return map;
}

function writeMergedCoverageReport(coverageDirectory, map) {
  mkdirSync(coverageDirectory, { recursive: true });
  const context = libReport.createContext({ dir: coverageDirectory, coverageMap: map });
  reports.create('lcovonly', {}).execute(context);
  reports.create('json-summary', {}).execute(context);
}

function extractTestsuites(xml, shardIndex) {
  const match = xml.match(/<testsuites(?:\s[^>]*)?>([\s\S]*)<\/testsuites>/u);
  if (!match) {
    throw new Error(
      `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL}'s junit.xml has no <testsuites> root.`,
    );
  }
  return match[1];
}

function mergeJunitReports(coverageDirectory, indices) {
  const inner = indices
    .map((shardIndex) => {
      const file = requiredShardFile(coverageDirectory, shardIndex, 'junit.xml');
      return extractTestsuites(readFileSync(file, 'utf8'), shardIndex);
    })
    .join('');
  writeFileSync(
    resolve(coverageDirectory, 'junit.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>${inner}</testsuites>\n`,
  );
}

export function mergeCoverageReports(testFiles, { coverageDirectory = coverageDir } = {}) {
  for (const shardIndex of shardIndices()) {
    requiredShardFile(coverageDirectory, shardIndex, 'coverage-final.json');
    requiredShardFile(coverageDirectory, shardIndex, 'junit.xml');
    requiredShardFile(coverageDirectory, shardIndex, SHARD_MANIFEST);
  }
  const indices = validateCoverageShardManifests(testFiles, { coverageDirectory });
  writeMergedCoverageReport(coverageDirectory, mergeCoverageMap(coverageDirectory, indices));
  mergeJunitReports(coverageDirectory, indices);
}

function cleanupCoverageShards(coverageDirectory = coverageDir) {
  rmSync(coverageShardsDirectory(coverageDirectory), { recursive: true, force: true });
}

export async function executeCoverageCommand(
  command,
  {
    cleanup = cleanupCoverageShards,
    discover = discoverTestFiles,
    merge = mergeCoverageReports,
    runShard = runCoverageShard,
  } = {},
) {
  if (!['all', 'merge', 'shard'].includes(command?.mode)) {
    throw new Error(`Unsupported coverage command mode: ${JSON.stringify(command?.mode)}.`);
  }
  const testFiles = await discover();
  if (command.mode === 'shard') return runShard(command.shardIndex, testFiles);
  if (command.mode === 'merge') {
    merge(testFiles);
    return 0;
  }

  let failed = false;
  for (const shardIndex of shardIndices()) {
    if (runShard(shardIndex, testFiles) !== 0) failed = true;
  }

  // Merge even when a shard reported failing tests. A single-session coverage run still writes
  // its report in that case, and retaining the complete numbers makes the failure diagnosable.
  merge(testFiles);
  cleanup();
  return failed ? 1 : 0;
}

const isMain =
  process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const command = parseCoverageArguments(process.argv.slice(2));
  process.exitCode = await executeCoverageCommand(command);
}
