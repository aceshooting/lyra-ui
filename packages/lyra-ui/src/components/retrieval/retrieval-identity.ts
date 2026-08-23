import type { RetrievalChunk } from '../../ai/types.js';

/** Identity validation shared by retrieval views with keyed public data. Validation trims only
 * to decide whether an identity is blank; retained spelling remains byte-for-byte unchanged. */
export function isNonBlankIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Runtime boundary for retrieval rows before any renderer dereferences their nested source. */
export function isValidRetrievalChunk(value: unknown): value is RetrievalChunk {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  const source = row['source'];
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return false;
  }
  const document = source as Record<string, unknown>;
  return (
    isNonBlankIdentity(row['id']) &&
    typeof row['text'] === 'string' &&
    typeof row['score'] === 'number' &&
    Number.isFinite(row['score']) &&
    isNonBlankIdentity(document['id']) &&
    typeof document['name'] === 'string'
  );
}

/** Keeps the first row for every nonblank identity without mutating the input collection. */
export function firstByRetrievalIdentity<T>(
  values: readonly T[],
  identity: (value: T) => unknown
): T[] {
  const retained: T[] = [];
  const seen = new Set<string>();
  const source = Array.isArray(values) ? values : [];
  for (const value of source) {
    let id: unknown;
    try {
      id = identity(value);
    } catch {
      continue;
    }
    if (!isNonBlankIdentity(id) || seen.has(id)) continue;
    seen.add(id);
    retained.push(value);
  }
  return retained;
}

const canonicalIdentityLists = new WeakMap<
  readonly unknown[],
  readonly string[]
>();

/** Bounded public identifier arrays are stable frozen snapshots after assignment. Cache their
 * first-wins nonblank projection so render, lookup, and event paths share one exact sequence. */
export function canonicalIdentityList(
  values: readonly unknown[]
): readonly string[] {
  const source = Array.isArray(values) ? values : Object.freeze([]);
  const cached = canonicalIdentityLists.get(source);
  if (cached) return cached;
  const projected = Object.freeze(
    firstByRetrievalIdentity(source, (value) => value)
  );
  canonicalIdentityLists.set(source, projected);
  return projected;
}
