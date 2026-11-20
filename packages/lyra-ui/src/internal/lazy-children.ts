import { tag } from './prefix.js';

/** Registration imports keyed by unprefixed child tag name (`'select'`, `'date-input'`). */
export type LazyChildLoaders = Readonly<Record<string, () => Promise<unknown>>>;

interface LazyChildren {
  readonly remaining: Map<string, () => Promise<unknown>>;
  readonly pending: Map<string, Promise<unknown>>;
}

const owners = new Map<string, LazyChildren>();

/**
 * Installs the optional child registrations a composite's default entry defers until first use.
 * The class module only names its `owner`; a lean entry that installs nothing leaves every child
 * to the consumer's own imports.
 */
export function defineLazyChildren(owner: string, loaders: LazyChildLoaders): void {
  owners.set(owner, { remaining: new Map(Object.entries(loaders)), pending: new Map() });
}

/**
 * Starts the registration of every deferred child that `root` currently contains undefined and
 * returns a promise for those registrations and the upgraded children's first render, or
 * `undefined` when none is outstanding. Each child
 * loads once per page; a failed import is forgotten so a later render retries it, and the returned
 * promise never rejects, so a host's `updateComplete` stays settleable.
 */
export function loadLazyChildren(owner: string, root: ParentNode): Promise<unknown> | undefined {
  const children = owners.get(owner);
  if (!children) return undefined;
  const loads: Promise<unknown>[] = [...children.pending.values()];
  for (const [name, load] of children.remaining) {
    if (!root.querySelector(`${tag(name)}:not(:defined)`)) continue;
    children.remaining.delete(name);
    const attempt = Promise.resolve()
      .then(load)
      .then(() => Promise.all(Array.from(root.querySelectorAll(tag(name)),
        (child) => Promise.resolve((child as Element & { updateComplete?: Promise<unknown> }).updateComplete))))
      .catch(() => {
        children.remaining.set(name, load);
      })
      .finally(() => {
        children.pending.delete(name);
      });
    children.pending.set(name, attempt);
    loads.push(attempt);
  }
  return loads.length > 0 ? Promise.all(loads) : undefined;
}
