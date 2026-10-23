import { isMainModule } from './is-main-module.mjs';

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
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import {
  discoverTestFiles,
  runNativeScrollbarVerification,
  shardTestFiles,
} from './full-engine-shard.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coverageDir = resolve(packageDir, 'coverage');
const SHARD_MANIFEST = 'test-files.json';
export const COVERAGE_SHARD_TOTAL = 5;
export const MAX_FILES_PER_COVERAGE_SESSION = 140;

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
    runNativeScrollbarVerification: runNative = runNativeScrollbarVerification,
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
  // One coverage-instrumented browser session is bounded in files, not only in shards: a session
  // that ran 263 files passed every test and then exited 1 with no summary and no report, while
  // each half of the same files completed cleanly. A shard therefore runs its files in sessions of
  // at most MAX_FILES_PER_COVERAGE_SESSION and merges their raw reports back into the shard
  // directory, so CI's matrix, artifacts and merge job are unchanged.
  const chunks = [];
  for (let start = 0; start < files.length; start += MAX_FILES_PER_COVERAGE_SESSION) {
    chunks.push(files.slice(start, start + MAX_FILES_PER_COVERAGE_SESSION));
  }
  // Even split, so no session is a tiny remainder.
  const balanced = [];
  if (chunks.length > 1) {
    const size = Math.ceil(files.length / chunks.length);
    for (let start = 0; start < files.length; start += size) balanced.push(files.slice(start, start + size));
  } else {
    balanced.push(files);
  }
  const partDirectories = [];
  let status = 0;
  for (const [partIndex, partFiles] of balanced.entries()) {
    const reportDirectory = balanced.length === 1 ? directory : resolve(directory, `part-${partIndex + 1}`);
    if (balanced.length > 1) {
      mkdirSync(reportDirectory, { recursive: true });
      partDirectories.push(reportDirectory);
      console.log(
        `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL}: session ${partIndex + 1}/${balanced.length}, ` +
          `${partFiles.length} files.`,
      );
    }
    const result = spawn(executable, partFiles, {
      cwd: packageDirectory,
      env: {
        ...environment,
        WTR_COVERAGE: '1',
        WTR_COVERAGE_REPORT_DIR: reportDirectory,
      },
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.signal) {
      throw new Error(
        `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL} was terminated by signal ${result.signal}.`,
      );
    }
    const partStatus = result.status ?? 1;
    if (partStatus !== 0) {
      // A browser that dies while the page is torn down leaves wtr exiting nonzero with no summary
      // line at all; name the shard and the files it ran so the red job is attributable.
      console.error(
        `Coverage shard ${shardIndex}/${COVERAGE_SHARD_TOTAL}: wtr exited with status ${partStatus} ` +
          `after ${partFiles.length} test files; last file: ${partFiles.at(-1)}.`,
      );
      status = partStatus;
      break;
    }
  }
  if (partDirectories.length > 0) mergeSessionReports(directory, partDirectories, status === 0);
  if (status !== 0) return status;
  return runNative(files, {
    browser: environment.WTR_BROWSER,
    environment,
    packageDirectory,
    spawn,
  });
}

/** Folds the raw reports of a shard's sessions into the shard directory, in the single-session shape. */
function mergeSessionReports(directory, partDirectories, requireAll) {
  const map = libCoverage.createCoverageMap({});
  const suites = [];
  for (const part of partDirectories) {
    const coverageFile = resolve(part, 'coverage-final.json');
    const junitFile = resolve(part, 'junit.xml');
    if (existsSync(coverageFile)) map.merge(JSON.parse(readFileSync(coverageFile, 'utf8')));
    else if (requireAll) throw new Error(`Coverage session ${part} wrote no coverage-final.json.`);
    if (existsSync(junitFile)) suites.push(extractTestsuites(readFileSync(junitFile, 'utf8'), 0));
    else if (requireAll) throw new Error(`Coverage session ${part} wrote no junit.xml.`);
  }
  if (map.files().length > 0) writeFileSync(resolve(directory, 'coverage-final.json'), JSON.stringify(map.toJSON()));
  if (suites.length > 0) {
    writeFileSync(
      resolve(directory, 'junit.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>${suites.join('')}</testsuites>\n`,
    );
  }
  for (const part of partDirectories) rmSync(part, { recursive: true, force: true });
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

function isCanonicalCoveragePath(value) {
  return typeof value === 'string' && isAbsolute(value) && !/[\0\\]/u.test(value) &&
    resolve(value) === value;
}

function insideCoverageRoot(root, file) {
  const suffix = relative(root, file);
  return suffix !== '' && suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix);
}

/** Rebase only an explicitly declared checkout root before Istanbul serializes relative SF paths. */
export function relocateCoverageSources(
  coverage,
  { sourceRepositoryRoot, repositoryRoot = resolve(packageDir, '../..') },
) {
  for (const root of [sourceRepositoryRoot, repositoryRoot]) {
    if (!isCanonicalCoveragePath(root) || root === resolve(root, '..')) {
      throw new Error('Coverage checkout roots must be canonical absolute paths.');
    }
  }
  const targetRoot = resolve(repositoryRoot, 'packages/lyra-ui');
  if (realpathSync(repositoryRoot) !== repositoryRoot || realpathSync(targetRoot) !== targetRoot) {
    throw new Error('Coverage checkout roots must be canonical absolute paths.');
  }
  const sourceRoot = resolve(sourceRepositoryRoot, 'packages/lyra-ui');
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) {
    throw new Error('Invalid coverage map.');
  }
  const mapped = {};
  for (const [name, entry] of Object.entries(coverage)) {
    if (!isCanonicalCoveragePath(name) || !entry || entry.path !== name) {
      throw new Error('Coverage source path must be canonical and match its map key.');
    }
    const candidate = insideCoverageRoot(sourceRoot, name)
      ? resolve(targetRoot, relative(sourceRoot, name))
      : insideCoverageRoot(targetRoot, name) ? name : undefined;
    if (!candidate) throw new Error('Coverage source is outside the declared package checkout.');
    const file = realpathSync(candidate);
    if (file !== candidate || !insideCoverageRoot(targetRoot, file) || !statSync(file).isFile()) {
      throw new Error('Coverage source must be a canonical regular file inside its package.');
    }
    if (Object.hasOwn(mapped, file)) throw new Error('Duplicate mapped coverage source.');
    mapped[file] = { ...entry, path: file };
  }
  return mapped;
}

function mergeCoverageMap(coverageDirectory, indices, sourceOptions) {
  const map = libCoverage.createCoverageMap({});
  for (const shardIndex of indices) {
    const coverage = loadShardCoverage(coverageDirectory, shardIndex);
    map.merge(sourceOptions.sourceRepositoryRoot === undefined
      ? coverage : relocateCoverageSources(coverage, sourceOptions));
  }
  return map;
}

function writeMergedCoverageReport(coverageDirectory, map, repositoryRoot) {
  mkdirSync(coverageDirectory, { recursive: true });
  const context = libReport.createContext({ dir: coverageDirectory, coverageMap: map });
  reports.create('lcovonly', { projectRoot: resolve(repositoryRoot, 'packages/lyra-ui') }).execute(context);
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

export function mergeCoverageReports(
  testFiles,
  {
    coverageDirectory = coverageDir,
    repositoryRoot = resolve(packageDir, '../..'),
    sourceRepositoryRoot = process.env.LYRA_COVERAGE_SOURCE_ROOT,
  } = {},
) {
  for (const shardIndex of shardIndices()) {
    requiredShardFile(coverageDirectory, shardIndex, 'coverage-final.json');
    requiredShardFile(coverageDirectory, shardIndex, 'junit.xml');
    requiredShardFile(coverageDirectory, shardIndex, SHARD_MANIFEST);
  }
  const indices = validateCoverageShardManifests(testFiles, { coverageDirectory });
  const map = mergeCoverageMap(coverageDirectory, indices, { repositoryRoot, sourceRepositoryRoot });
  writeMergedCoverageReport(coverageDirectory, map, repositoryRoot);
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

if (isMainModule(import.meta.url)) {
  const command = parseCoverageArguments(process.argv.slice(2));
  process.exitCode = await executeCoverageCommand(command);
}
