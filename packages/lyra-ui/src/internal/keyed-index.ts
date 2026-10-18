const keyed = new WeakMap<readonly unknown[], WeakMap<object, ReadonlyMap<unknown, unknown>>>();
const positions = new WeakMap<readonly unknown[], ReadonlyMap<unknown, number>>();

/** Index immutable arrays by a stable selector. Duplicate keys retain the first entry, like find(). */
export function indexByKey<T, K>(entries: readonly T[], key: (entry: T) => K): ReadonlyMap<K, T> {
  let selectors = keyed.get(entries);
  if (!selectors) {
    selectors = new WeakMap();
    keyed.set(entries, selectors);
  }
  const previous = selectors.get(key);
  if (previous) return previous as ReadonlyMap<K, T>;
  const index = new Map<K, T>();
  for (const entry of entries) {
    const value = key(entry);
    if (!index.has(value)) index.set(value, entry);
  }
  selectors.set(key, index);
  return index;
}

/** Index immutable array entries by their first position, like indexOf(). */
export function positionIndex<T>(entries: readonly T[]): ReadonlyMap<T, number> {
  const previous = positions.get(entries);
  if (previous) return previous as ReadonlyMap<T, number>;
  const index = new Map<T, number>();
  entries.forEach((entry, position) => {
    if (!index.has(entry)) index.set(entry, position);
  });
  positions.set(entries, index);
  return index;
}
