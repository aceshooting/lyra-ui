import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
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

/**
 * Assigns sorted test paths round-robin so the shards are deterministic,
 * disjoint, exhaustive, and reasonably balanced by file count.
 */
export function shardTestFiles(testFiles, shardIndex, shardTotal) {
  const index = positiveInteger(shardIndex, 'shardIndex');
  const total = positiveInteger(shardTotal, 'shardTotal');
  if (index > total) {
    throw new Error(`shardIndex (${index}) cannot exceed shardTotal (${total}).`);
  }

  return [...testFiles]
    .sort(comparePaths)
    .filter((_file, fileIndex) => fileIndex % total === index - 1);
}

export function runShard(testFiles, { shardIndex, shardTotal }, environment = process.env) {
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
  const result = spawnSync(executable, selectedFiles, {
    cwd: packageDirectory,
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal) {
    throw new Error(`Web Test Runner was terminated by signal ${result.signal}.`);
  }
  return result.status ?? 1;
}

async function main() {
  const configuration = readShardConfiguration();
  const testFiles = await collectTestFilesForShard();
  process.exitCode = runShard(testFiles, configuration);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  await main();
}
