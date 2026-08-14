/** Resource ceilings for recursively owned provider data. */
export interface ProviderSnapshotLimits {
  /** Maximum collection nesting, with the root at depth zero. */
  maxDepth: number;
  /** Maximum primitive and collection values visited. */
  maxNodes: number;
  /** Maximum UTF-8 bytes copied, including object keys. */
  maxBytes: number;
  /** Maximum UTF-16 code units in one string before UTF-8 encoding. */
  maxStringCharacters: number;
}

export const DEFAULT_PROVIDER_SNAPSHOT_LIMITS: Readonly<ProviderSnapshotLimits> = Object.freeze({
  maxDepth: 32,
  maxNodes: 10_000,
  maxBytes: 1_048_576,
  maxStringCharacters: 262_144,
});

export type ProviderSnapshotFailure = 'invalid' | 'limit';

export type ProviderSnapshotResult<T = unknown> =
  | { ok: true; value: T; bytes: number; nodes: number }
  | { ok: false; failure: ProviderSnapshotFailure; reason: string };

export interface ProviderSnapshotBudget {
  readonly limits: Readonly<ProviderSnapshotLimits>;
  bytes: number;
  nodes: number;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

export function resolveProviderSnapshotLimits(
  limits: Partial<ProviderSnapshotLimits> = {},
): Readonly<ProviderSnapshotLimits> {
  return Object.freeze({
    maxDepth: positiveInteger(limits.maxDepth, DEFAULT_PROVIDER_SNAPSHOT_LIMITS.maxDepth),
    maxNodes: positiveInteger(limits.maxNodes, DEFAULT_PROVIDER_SNAPSHOT_LIMITS.maxNodes),
    maxBytes: positiveInteger(limits.maxBytes, DEFAULT_PROVIDER_SNAPSHOT_LIMITS.maxBytes),
    maxStringCharacters: positiveInteger(
      limits.maxStringCharacters,
      DEFAULT_PROVIDER_SNAPSHOT_LIMITS.maxStringCharacters,
    ),
  });
}

export function createProviderSnapshotBudget(
  limits: Partial<ProviderSnapshotLimits> | Readonly<ProviderSnapshotLimits> = {},
): ProviderSnapshotBudget {
  return { limits: resolveProviderSnapshotLimits(limits), bytes: 0, nodes: 0 };
}

const encoder = new TextEncoder();

function fail(failure: ProviderSnapshotFailure, reason: string): ProviderSnapshotResult<never> {
  return { ok: false, failure, reason };
}

function consumeNode(budget: ProviderSnapshotBudget): ProviderSnapshotResult<undefined> {
  if (budget.nodes >= budget.limits.maxNodes) return fail('limit', 'provider snapshot node limit exceeded');
  if (budget.bytes > budget.limits.maxBytes - 8) return fail('limit', 'provider snapshot byte limit exceeded');
  budget.nodes += 1;
  budget.bytes += 8;
  return { ok: true, value: undefined, bytes: budget.bytes, nodes: budget.nodes };
}

function consumeString(value: string, budget: ProviderSnapshotBudget): ProviderSnapshotResult<undefined> {
  if (value.length > budget.limits.maxStringCharacters) {
    return fail('limit', 'provider snapshot string limit exceeded');
  }
  const bytes = encoder.encode(value).byteLength;
  if (bytes > budget.limits.maxBytes - budget.bytes) {
    return fail('limit', 'provider snapshot byte limit exceeded');
  }
  budget.bytes += bytes;
  return { ok: true, value: undefined, bytes: budget.bytes, nodes: budget.nodes };
}

function isPlainRecord(value: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  } catch {
    return false;
  }
}

function copyValue(
  value: unknown,
  budget: ProviderSnapshotBudget,
  depth: number,
  ancestors: WeakSet<object>,
): ProviderSnapshotResult {
  const node = consumeNode(budget);
  if (!node.ok) return node;
  if (depth > budget.limits.maxDepth) return fail('limit', 'provider snapshot depth limit exceeded');

  if (value === null || typeof value === 'boolean') {
    return { ok: true, value, bytes: budget.bytes, nodes: budget.nodes };
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { ok: true, value, bytes: budget.bytes, nodes: budget.nodes }
      : fail('invalid', 'provider snapshot contains a non-finite number');
  }
  if (typeof value === 'string') {
    const copied = consumeString(value, budget);
    return copied.ok
      ? { ok: true, value, bytes: budget.bytes, nodes: budget.nodes }
      : copied;
  }
  if (typeof value !== 'object') {
    return fail('invalid', `provider snapshot contains unsupported ${typeof value} data`);
  }
  if (ancestors.has(value)) return fail('invalid', 'provider snapshot contains a cycle');

  if (value instanceof Date) {
    const timestamp = value.getTime();
    if (!Number.isFinite(timestamp)) return fail('invalid', 'provider snapshot contains an invalid date');
    const iso = value.toISOString();
    const copied = consumeString(iso, budget);
    return copied.ok
      ? { ok: true, value: iso, bytes: budget.bytes, nodes: budget.nodes }
      : copied;
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > budget.limits.maxNodes - budget.nodes) {
        return fail('limit', 'provider snapshot array limit exceeded');
      }
      const keys = Reflect.ownKeys(value);
      for (const key of keys) {
        if (key === 'length') continue;
        if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (descriptor?.enumerable) return fail('invalid', 'provider snapshot array has non-index properties');
        }
      }
      const output: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor) return fail('invalid', 'provider snapshot contains a sparse array');
        if (!('value' in descriptor)) return fail('invalid', 'provider snapshot contains an accessor');
        const child = copyValue(descriptor.value, budget, depth + 1, ancestors);
        if (!child.ok) return child;
        output.push(child.value);
      }
      return { ok: true, value: output, bytes: budget.bytes, nodes: budget.nodes };
    }

    if (!isPlainRecord(value)) return fail('invalid', 'provider snapshot contains a non-plain object');
    const keys = Reflect.ownKeys(value);
    if (keys.length > budget.limits.maxNodes - budget.nodes) {
      return fail('limit', 'provider snapshot object-property limit exceeded');
    }
    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable) continue;
      if (typeof key !== 'string') return fail('invalid', 'provider snapshot contains a symbol key');
      if (!('value' in descriptor)) return fail('invalid', 'provider snapshot contains an accessor');
      const copiedKey = consumeString(key, budget);
      if (!copiedKey.ok) return copiedKey;
      const child = copyValue(descriptor.value, budget, depth + 1, ancestors);
      if (!child.ok) return child;
      output[key] = child.value;
    }
    return { ok: true, value: output, bytes: budget.bytes, nodes: budget.nodes };
  } catch {
    return fail('invalid', 'provider snapshot could not be inspected safely');
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Recursively copies provider-owned data into arrays and null-prototype records. Unsupported,
 * cyclic, accessor-backed, or over-budget input rejects as one unit; no source reference is ever
 * returned as a fallback.
 */
export function snapshotProviderValue<T = unknown>(
  value: unknown,
  budget: ProviderSnapshotBudget = createProviderSnapshotBudget(),
): ProviderSnapshotResult<T> {
  const startingBytes = budget.bytes;
  const startingNodes = budget.nodes;
  const result = copyValue(value, budget, 0, new WeakSet<object>());
  if (!result.ok) return result;
  return {
    ok: true,
    value: result.value as T,
    bytes: budget.bytes - startingBytes,
    nodes: budget.nodes - startingNodes,
  };
}
