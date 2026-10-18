/** The existing independent page-controller operation lanes. */
type SourcePageLane = 'page' | 'selection' | 'locate';
type Release = () => void;
interface Pending { cancel(): void; grant(): void; }
interface Slot { held?: object; waiting?: Pending; }
interface Scope {
  current?: object;
  readonly sources: WeakMap<object, Map<SourcePageLane, Slot>>;
  readonly waiting: Map<SourcePageLane, Pending>;
}
export interface SourcePageScope {
  isCurrent(): boolean;
  acquire(source: object, channel: SourcePageLane, signal: AbortSignal): Promise<Release | undefined>;
}
const owners = new WeakMap<object, Scope>();
interface Registration extends SourcePageScope { readonly scope: Scope; readonly ticket: object; }
const hosts = new WeakMap<HTMLElement, Registration>();

/** Assign the composition's single active page host before its first source request.
 * Repeated assignment is inert. Replacing a host revokes queued work, while callback permits
 * survive until actual settlement. Scope state retains tokens, never hosts or page records. */
export function setSourcePageScope(host: HTMLElement, owner: object): void {
  let scope = owners.get(owner);
  if (!scope) {
    scope = { sources: new WeakMap(), waiting: new Map() };
    owners.set(owner, scope);
  }
  const previous = hosts.get(host);
  if (previous?.scope === scope && scope.current === previous.ticket) return;
  if (previous && previous.scope.current === previous.ticket) {
    previous.scope.current = undefined;
    for (const pending of [...previous.scope.waiting.values()]) pending.cancel();
  }
  const owned = scope;
  const ticket = {};
  const registration: Registration = {
    scope: owned, ticket,
    isCurrent: () => owned.current === ticket,
    acquire(source, channel, signal) {
      if (!registration.isCurrent() || signal.aborted) return Promise.resolve(undefined);
      let lanes = owned.sources.get(source);
      if (!lanes) { lanes = new Map(); owned.sources.set(source, lanes); }
      let slot = lanes.get(channel);
      if (!slot) { slot = {}; lanes.set(channel, slot); }
      const physical = slot;
      // One active host has one latest logical operation per lane, regardless of provider.
      owned.waiting.get(channel)?.cancel();
      return new Promise(resolve => {
        let done = false;
        const clear = (): void => {
          if (physical.waiting === pending) physical.waiting = undefined;
          if (owned.waiting.get(channel) === pending) owned.waiting.delete(channel);
          signal.removeEventListener('abort', cancel);
        };
        const cancel = (): void => {
          if (done) return;
          done = true; clear(); resolve(undefined);
        };
        const pending: Pending = { cancel, grant: () => {
          if (done) return;
          if (!registration.isCurrent() || signal.aborted) { cancel(); return; }
          if (physical.held) return;
          done = true; clear();
          const token = physical.held = {};
          resolve(() => {
            if (physical.held !== token) return;
            physical.held = undefined;
            physical.waiting?.grant();
          });
        } };
        physical.waiting = pending;
        owned.waiting.set(channel, pending);
        signal.addEventListener('abort', cancel, { once: true });
        pending.grant();
      });
    },
  };
  const obsolete = [...owned.waiting.values()];
  owned.current = ticket;
  hosts.set(host, registration);
  for (const pending of obsolete) pending.cancel();
}

/** Unregistered standalone hosts retain their own controller's physical lanes. */
export function sourcePageScope(host: HTMLElement): SourcePageScope | undefined { return hosts.get(host); }
