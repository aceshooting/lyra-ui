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
