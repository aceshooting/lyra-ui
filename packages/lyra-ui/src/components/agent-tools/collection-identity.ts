/**
 * Returns the first item for each string identity, preserving source order. Agent/provider data is
 * often assembled across retries or streamed pages, so duplicate identities are normalized before
 * they reach keyed DOM, selection lookups, counts, or action events. The caller's array and items
 * remain untouched.
 *
 * @internal
 */
export function firstByIdentity<T>(items: readonly T[], identity: (item: T) => string): T[] {
  const projected: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = identity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    projected.push(item);
  }
  return projected;
}
