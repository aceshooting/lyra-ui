import { isMainModule } from './is-main-module.mjs';

import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NATIVE_SCROLLBAR_TEST_SUFFIX = '.native-scrollbar.test.ts';
export const NATIVE_SCROLLBAR_TEST_FILE =
  'src/components/data/data-grid/data-grid.native-scrollbar.test.ts';
const NATIVE_SCROLLBAR_OWNER_FILE = 'src/components/data/data-grid/data-grid.test.ts';

// The package-entrypoint contract imports the complete unbundled package graph in a fresh iframe
// realm. On CI it costs roughly as much wall time as 50 ordinary test files, so plain file-count
// round-robin assignment leaves its shard on the critical path long after the others finish.
// Explicit, source-controlled costs keep the split deterministic; unknown and new files retain a
// unit cost and therefore preserve the former lexical round-robin behavior.
const TEST_FILE_COSTS = new Map([['src/package-entrypoints.test.ts', 50]]);

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toPosixPath(value) {
  return value.split(sep).join('/');
}

async function collectTestFiles(directory, root, files) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => comparePaths(left.name, right.name));

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectTestFiles(absolutePath, root, files);
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith(NATIVE_SCROLLBAR_TEST_SUFFIX)
    ) {
      files.push(toPosixPath(relative(root, absolutePath)));
    }
  }
}

function parseTestFileList(environment) {
  const source = environment.WTR_TEST_FILES;
  if (!source) {
    return null;
  }
  const normalized = String(source).trim();
  if (!normalized) {
    return null;
  }
  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry).trim()).filter(Boolean);
    }
  } catch {
    // Fallback to whitespace-delimited test file paths.
  }
  return normalized.split(/\s+/).filter(Boolean);
}

async function collectPlatformTestFiles(root = packageDirectory) {
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const platformScript = packageJson?.scripts?.['test:platform'];
  if (typeof platformScript !== 'string') {
    throw new Error('No test:platform script found in package.json');
  }
  const normalized = platformScript.trim().replace(/^\s*wtr\s+/, '').trim();
  if (!normalized) {
    return [];
  }
  return normalized.split(/\s+/).filter(Boolean);
}

async function collectTestFilesForShard(root = packageDirectory, environment = process.env) {
  const explicit = parseTestFileList(environment);
  if (explicit) {
    return explicit;
  }

  const suite = String(environment.WTR_TEST_SUITE ?? '').trim().toLowerCase();
  if (suite === 'platform') {
    return collectPlatformTestFiles(root);
  }

  return discoverTestFiles(root);
}

/** Returns every TypeScript test below src/ in deterministic lexical order. */
export async function discoverTestFiles(root = packageDirectory) {
  const files = [];
  await collectTestFiles(resolve(root, 'src'), root, files);
  return files.sort(comparePaths);
}

function positiveInteger(value, name) {
  const normalized = String(value ?? '');
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${name} must be a positive integer; received ${JSON.stringify(value)}.`);
  }
  const integer = Number(normalized);
  if (!Number.isSafeInteger(integer)) {
    throw new Error(`${name} must be a safe positive integer; received ${JSON.stringify(value)}.`);
  }
  return integer;
}

export function readShardConfiguration(environment = process.env) {
  const shardIndex = positiveInteger(environment.WTR_SHARD_INDEX, 'WTR_SHARD_INDEX');
  const shardTotal = positiveInteger(environment.WTR_SHARD_TOTAL, 'WTR_SHARD_TOTAL');
  if (shardIndex > shardTotal) {
    throw new Error(`WTR_SHARD_INDEX (${shardIndex}) cannot exceed WTR_SHARD_TOTAL (${shardTotal}).`);
  }
  return { shardIndex, shardTotal };
}

/** Assigns test paths deterministically, balancing known expensive contracts by estimated cost. */
export function shardTestFiles(testFiles, shardIndex, shardTotal) {
  const index = positiveInteger(shardIndex, 'shardIndex');
  const total = positiveInteger(shardTotal, 'shardTotal');
  if (index > total) {
    throw new Error(`shardIndex (${index}) cannot exceed shardTotal (${total}).`);
  }

  const shards = Array.from({ length: total }, () => []);
  const costs = Array.from({ length: total }, () => 0);
  const ordered = [...testFiles].sort((left, right) => {
    const costDifference = (TEST_FILE_COSTS.get(right) ?? 1) - (TEST_FILE_COSTS.get(left) ?? 1);
    return costDifference || comparePaths(left, right);
  });

  for (const file of ordered) {
    let target = 0;
    for (let candidate = 1; candidate < total; candidate += 1) {
      if (costs[candidate] < costs[target]) target = candidate;
    }
    shards[target].push(file);
    costs[target] += TEST_FILE_COSTS.get(file) ?? 1;
  }

  return shards[index - 1].sort(comparePaths);
}

export function shouldRunNativeScrollbarVerification(testFiles) {
  return testFiles.includes(NATIVE_SCROLLBAR_OWNER_FILE);
}

export function nativeScrollbarVerificationCommand(
  browser,
  { executable = process.platform === 'win32' ? 'wtr.cmd' : 'wtr' } = {},
) {
  const product = String(browser ?? 'chromium').toLowerCase();
  if (product === 'webkit' || product === 'safari') {
    return {
      command: 'xvfb-run',
      args: ['-a', 'dbus-run-session', '--', executable, NATIVE_SCROLLBAR_TEST_FILE],
    };
  }
  if (product === 'firefox') {
    return {
      command: 'xvfb-run',
      args: ['-a', executable, NATIVE_SCROLLBAR_TEST_FILE],
    };
  }
  return { command: executable, args: [NATIVE_SCROLLBAR_TEST_FILE] };
}

export function runNativeScrollbarVerification(
  testFiles,
  {
    browser = process.env.WTR_BROWSER ?? 'chromium',
    environment = process.env,
    packageDirectory: directory = packageDirectory,
    spawn = spawnSync,
  } = {},
) {
  if (!shouldRunNativeScrollbarVerification(testFiles)) return 0;

  const executable = resolve(
    directory,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wtr.cmd' : 'wtr',
  );
  const { command, args } = nativeScrollbarVerificationCommand(browser, { executable });
  const nativeEnvironment = {
    ...environment,
    WTR_NATIVE_SCROLLBAR: '1',
  };
  delete nativeEnvironment.WTR_COVERAGE;
  delete nativeEnvironment.WTR_COVERAGE_REPORT_DIR;

  console.log(`Native scrollbar verification: ${NATIVE_SCROLLBAR_TEST_FILE}`);
  const result = spawn(command, args, {
    cwd: directory,
    env: nativeEnvironment,
    stdio: 'inherit',
  });
  if (result.error) {
    if (command === 'xvfb-run' && result.error.code === 'ENOENT') {
      throw new Error(`Native ${String(browser).toLowerCase()} scrollbar verification requires xvfb-run.`);
    }
    throw result.error;
  }
  if (result.signal) {
    throw new Error(`Native scrollbar verification was terminated by signal ${result.signal}.`);
  }
  return result.status ?? 1;
}

export function runShard(
  testFiles,
  { shardIndex, shardTotal },
  environment = process.env,
  {
    spawn = spawnSync,
    runNativeScrollbarVerification: runNative = runNativeScrollbarVerification,
  } = {},
) {
  const selectedFiles = shardTestFiles(testFiles, shardIndex, shardTotal);
  if (testFiles.length === 0) {
    throw new Error('No test files were discovered.');
  }
  if (selectedFiles.length === 0) {
    throw new Error(
      `Test shard ${shardIndex}/${shardTotal} is empty for ${testFiles.length} test files.`,
    );
  }

  console.log(
    `Test shard ${shardIndex}/${shardTotal}: ` +
      `${selectedFiles.length} of ${testFiles.length} sorted test files.`,
  );
  for (const file of selectedFiles) console.log(`  ${file}`);

  const executable = process.platform === 'win32' ? 'wtr.cmd' : 'wtr';
  const result = spawn(executable, selectedFiles, {
    cwd: packageDirectory,
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal) {
    throw new Error(`Web Test Runner was terminated by signal ${result.signal}.`);
  }
  const status = result.status ?? 1;
  if (status !== 0) return status;
  return runNative(selectedFiles, {
    browser: environment.WTR_BROWSER,
    environment,
    packageDirectory,
    spawn,
  });
}

async function main() {
  const configuration = readShardConfiguration();
  const testFiles = await collectTestFilesForShard();
  process.exitCode = runShard(testFiles, configuration);
}

if (isMainModule(import.meta.url)) {
  await main();
}
