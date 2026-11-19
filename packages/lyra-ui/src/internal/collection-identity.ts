/** Keep the first row for each nonblank string identity without rewriting its spelling. A bad
 * identity reader or non-array runtime input cannot hide valid neighboring rows. */
export function firstByIdentity<T>(items: readonly T[], identity: (item: T) => unknown): T[] {
  const projected: T[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(items) ? items : []) {
    let key: unknown;
    try {
      key = identity(item);
    } catch {
      continue;
    }
    if (typeof key !== 'string' || key.trim().length === 0 || seen.has(key)) continue;
    seen.add(key);
    projected.push(item);
  }
  return projected;
}

const memoized = new WeakMap<readonly unknown[], WeakMap<object, unknown[]>>();

/** {@link firstByIdentity} memoized per source array identity and (hoisted) `identity` function,
 * so a projection is recomputed only when the assigned array or the reader changes. The cache
 * assumes the array is replaced, not mutated in place. */
export function firstByIdentityMemo<T>(items: readonly T[], identity: (item: T) => unknown): T[] {
  if (!Array.isArray(items)) return firstByIdentity(items, identity);
  let byIdentity = memoized.get(items);
  if (!byIdentity) memoized.set(items, (byIdentity = new WeakMap()));
  let projected = byIdentity.get(identity) as T[] | undefined;
  if (!projected) byIdentity.set(identity, (projected = firstByIdentity(items, identity)));
  return projected;
}
