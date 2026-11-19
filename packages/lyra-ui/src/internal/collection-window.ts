/** A rendered window over a collection and how many leading entries it leaves out. */
export interface CollectionWindow<T> {
  readonly items: readonly T[];
  readonly omitted: number;
}

/**
 * The newest `max` entries of `items` (its tail) and the count left out. A `max` that is not a
 * positive finite number means unlimited and returns `items` itself, so an unbounded render keeps
 * the caller's array identity.
 */
export function newestCollectionWindow<T>(items: readonly T[], max: number): CollectionWindow<T> {
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;
  if (limit === 0 || items.length <= limit) return { items, omitted: 0 };
  return { items: items.slice(-limit), omitted: items.length - limit };
}
