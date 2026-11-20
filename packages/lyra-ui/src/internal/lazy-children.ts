import { tag } from './prefix.js';
import { DEV_DIAGNOSTICS, devWarn } from './dev-warning.js';

/** Registration imports keyed by unprefixed child tag name (`'select'`, `'date-input'`). */
export type LazyChildLoaders = Readonly<Record<string, () => Promise<unknown>>>;

interface LazyChildren {
  readonly remaining: Map<string, () => Promise<unknown>>;
  readonly pending: Map<string, Promise<boolean>>;
}

const owners = new Map<string, LazyChildren>();
const classOwned = new WeakMap<LazyChildLoaders, LazyChildren>();

const stateFor = (loaders: LazyChildLoaders): LazyChildren => ({
  remaining: new Map(Object.entries(loaders)),
  pending: new Map(),
});

/**
 * Installs the optional child registrations a composite's default entry defers until first use.
 * The class module only names its `owner`; a lean entry that installs nothing leaves every child
 * to the consumer's own imports.
 */
export function defineLazyChildren(owner: string, loaders: LazyChildLoaders): void {
  owners.set(owner, stateFor(loaders));
}

/**
 * Starts the registration of every deferred child that `root` currently contains undefined and
 * returns a promise for those registrations and the upgraded children's first render, or
 * `undefined` when none is outstanding. `owner` is either a name installed by
 * `defineLazyChildren()` or a module-level loader record a class module owns itself (children it
 * must reach whichever entry registered it). Each child loads once per page; a failed import is
 * forgotten so a later call retries it, and the returned promise never rejects, so a host's
 * `updateComplete` stays settleable. It resolves `false` when any of the awaited imports failed.
 */
export function loadLazyChildren(owner: string | LazyChildLoaders, root: ParentNode): Promise<boolean> | undefined {
  let children: LazyChildren | undefined;
  if (typeof owner === 'string') {
    children = owners.get(owner);
  } else {
    children = classOwned.get(owner);
    if (!children) classOwned.set(owner, children = stateFor(owner));
  }
  if (!children) return undefined;
  const state = children;
  const loads: Promise<boolean>[] = [...state.pending.values()];
  for (const [name, load] of state.remaining) {
    if (!root.querySelector(`${tag(name)}:not(:defined)`)) continue;
    state.remaining.delete(name);
    const attempt = Promise.resolve()
      .then(load)
      .then(() => Promise.all(Array.from(root.querySelectorAll(tag(name)),
        (child) => Promise.resolve((child as Element & { updateComplete?: Promise<unknown> }).updateComplete))))
      .then(() => true, (error: unknown) => {
        state.remaining.set(name, load);
        if (DEV_DIAGNOSTICS) devWarn(`Lyra: <${tag(name)}> could not be registered; it is retried on the next render. ${String(error)}`);
        return false;
      })
      .finally(() => {
        state.pending.delete(name);
      });
    state.pending.set(name, attempt);
    loads.push(attempt);
  }
  return loads.length > 0 ? Promise.all(loads).then((results) => results.every(Boolean)) : undefined;
}
