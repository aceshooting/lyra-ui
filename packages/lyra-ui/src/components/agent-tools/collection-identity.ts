/**
 * Returns the first item for each nonempty string identity, preserving source order.
 * Agent/provider data is often assembled across retries or streamed pages, so blank and duplicate
 * identities are normalized before they reach keyed DOM, selection lookups, counts, or action
 * events. Validation trims only to decide whether a key is blank; retained identities are not
 * rewritten. The caller's array and items remain untouched.
 *
 * @internal
 */
export function firstByIdentity<T>(items: readonly T[], identity: (item: T) => unknown): T[] {
  const projected: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    let key: unknown;
    try {
      key = identity(item);
    } catch {
      continue;
    }
    if (typeof key !== 'string' || key.trim().length === 0) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    projected.push(item);
  }
  return projected;
}
