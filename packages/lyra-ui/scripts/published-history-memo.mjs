import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import { walk } from './lib/fs-walk.mjs';
import { readSourceSnapshot } from './source-fixture-io.mjs';

// Per-process reuse of an immutable-history verification, keyed on every file's bytes; failures are never stored.
const verified = new Map();

function historyKey(kind, directory) {
  const root = resolve(directory);
  const files = walk(root);
  const digest = createHash('sha256');
  for (const file of files.sort()) {
    const name = relative(root, file);
    digest.update(name).update('\0').update(createHash('sha256').update(readSourceSnapshot(root, name, { binary: true }).original).digest());
  }
  return `${kind}\0${root}\0${digest.digest('hex')}`;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value) || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

/** `compute()` once per process per history content (and per frozen `inputs`, when given); the result is frozen. */
export function memoizedHistoryVerification(kind, directory, compute, inputs) {
  if (inputs !== undefined && !Object.isFrozen(inputs)) return compute();
  let key;
  try {
    key = historyKey(kind, directory);
  } catch {
    return compute();
  }
  if (!verified.has(key)) verified.set(key, new Map());
  const results = verified.get(key);
  if (!results.has(inputs)) results.set(inputs, deepFreeze(compute()));
  return results.get(inputs);
}
