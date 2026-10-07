import { firstByIdentity } from '../../internal/collection-identity.js';
export { firstByIdentity } from '../../internal/collection-identity.js';

const projections = new WeakMap<readonly unknown[], WeakMap<object, unknown[]>>();

/** {@link firstByIdentity} memoized per frozen source array and (hoisted) `identity` function. @internal */
export function firstByIdentityMemo<T>(items: readonly T[], identity: (item: T) => unknown): T[] {
  let byIdentity = projections.get(items);
  if (!byIdentity) projections.set(items, (byIdentity = new WeakMap()));
  let projected = byIdentity.get(identity) as T[] | undefined;
  if (!projected) byIdentity.set(identity, (projected = firstByIdentity(items, identity)));
  return projected;
}
