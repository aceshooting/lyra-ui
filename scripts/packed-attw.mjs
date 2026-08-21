export const ATTW_CI_SHARD_TOTAL = 4;

function positiveInteger(value, label) {
  if (!/^\d+$/u.test(value ?? '')) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return parsed;
}

export function parsePackedConsumerArguments(arguments_) {
  let runAttw = true;
  for (const argument of arguments_) {
    if (argument === '--skip-attw') {
      if (!runAttw) throw new TypeError('--skip-attw may only be specified once.');
      runAttw = false;
      continue;
    }
    throw new TypeError(`Unknown packed-consumer argument: ${argument}`);
  }
  return { runAttw };
}

export function parseAttwArguments(arguments_) {
  let shardIndex;
  let shardTotal;
  let tarball;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const value = arguments_[index + 1];
    if (argument === '--shard-index') {
      if (shardIndex !== undefined) throw new TypeError('--shard-index may only be specified once.');
      shardIndex = positiveInteger(value, '--shard-index');
      index += 1;
      continue;
    }
    if (argument === '--shard-total') {
      if (shardTotal !== undefined) throw new TypeError('--shard-total may only be specified once.');
      shardTotal = positiveInteger(value, '--shard-total');
      index += 1;
      continue;
    }
    if (argument === '--tarball') {
      if (tarball !== undefined) throw new TypeError('--tarball may only be specified once.');
      if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
        throw new TypeError('--tarball requires a path.');
      }
      tarball = value;
      index += 1;
      continue;
    }
    throw new TypeError(`Unknown ATTW argument: ${argument}`);
  }

  if ((shardIndex === undefined) !== (shardTotal === undefined)) {
    throw new TypeError('--shard-index and --shard-total must be specified together.');
  }
  shardIndex ??= 1;
  shardTotal ??= 1;
  if (shardIndex > shardTotal) {
    throw new RangeError(`--shard-index ${shardIndex} exceeds --shard-total ${shardTotal}.`);
  }
  return { shardIndex, shardTotal, tarball };
}

/**
 * Returns every typed package export ATTW must resolve. Stylesheets are the only deliberate
 * omission: they have no declarations, so ATTW correctly classifies them as untyped.
 */
export function attwEntrypoints(manifest) {
  const exportsMap = manifest?.exports;
  if (
    typeof exportsMap !== 'object' ||
    exportsMap === null ||
    Array.isArray(exportsMap)
  ) {
    throw new TypeError('The package manifest must define an exports object.');
  }
  const entrypoints = Object.keys(exportsMap)
    .filter((entrypoint) => !entrypoint.endsWith('.css'))
    .sort();
  if (entrypoints.length === 0) {
    throw new TypeError('The package manifest exposes no typed ATTW entrypoints.');
  }
  for (const entrypoint of entrypoints) {
    if (entrypoint !== '.' && !entrypoint.startsWith('./')) {
      throw new TypeError(`Invalid package export entrypoint: ${entrypoint}`);
    }
  }
  return entrypoints;
}

/** Deterministic round-robin partitioning keeps adjacent component class/registration pairs apart. */
export function partitionAttwEntrypoints(entrypoints, shardIndex, shardTotal) {
  if (!Number.isSafeInteger(shardTotal) || shardTotal < 1) {
    throw new TypeError('ATTW shard total must be a positive integer.');
  }
  if (!Number.isSafeInteger(shardIndex) || shardIndex < 1 || shardIndex > shardTotal) {
    throw new RangeError('ATTW shard index must be within the shard total.');
  }
  if (!Array.isArray(entrypoints) || entrypoints.length < shardTotal) {
    throw new TypeError('ATTW entrypoints must be a non-empty array with at least one per shard.');
  }
  if (entrypoints.some((entrypoint) => typeof entrypoint !== 'string' || entrypoint.length === 0)) {
    throw new TypeError('Every ATTW entrypoint must be a non-empty string.');
  }

  const sorted = [...entrypoints].sort();
  if (new Set(sorted).size !== sorted.length) {
    throw new TypeError('ATTW entrypoints must be unique.');
  }
  return sorted.filter((_, index) => index % shardTotal === shardIndex - 1);
}

export function attwCommandArguments(entrypoints, tarball) {
  if (!Array.isArray(entrypoints) || entrypoints.length === 0) {
    throw new TypeError('ATTW requires at least one explicit entrypoint.');
  }
  if (typeof tarball !== 'string' || tarball.length === 0) {
    throw new TypeError('ATTW requires a package tarball path.');
  }
  return [
    'exec',
    'attw',
    '--profile',
    'esm-only',
    '--entrypoints',
    ...entrypoints,
    '--format',
    'table',
    '--summary',
    tarball,
  ];
}
