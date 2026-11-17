/** The existing independent page-controller operation lanes. */
type SourcePageLane = 'page' | 'selection' | 'locate';
type Release = () => void;
interface Pending { cancel(): void; grant(): void; }
interface Slot { held?: object; waiting?: Pending; }
interface Scope {
  current?: object;
  retireCurrent?: () => void;
  sharedPage?: Slot;
  pageRequested?: boolean;
  readonly sources: WeakMap<object, Map<SourcePageLane, Slot>>;
  readonly waiting: Map<SourcePageLane, Pending>;
}
export interface SourcePageScope {
  isCurrent(): boolean;
  /** Subscribe for this registration's lifetime; retired registrations notify immediately. */
  onInvalidate(listener: () => void): Release;
  acquire(source: object, channel: SourcePageLane, signal: AbortSignal): Promise<Release | undefined>;
}
const owners = new WeakMap<object, Scope>();
interface Registration extends SourcePageScope { readonly scope: Scope; readonly ticket: object; }
const hosts = new WeakMap<HTMLElement, Registration>();

/** Assign the composition's single active page host before its first source request.
 * Repeated assignment is inert. Replacing a host revokes queued work, while callback permits
 * survive until actual settlement. Only current subscribers are retained; retired registrations
 * release their callbacks, while physical permits retain no hosts or page records. */
export function setSourcePageScope(host: HTMLElement, owner: object): void {
  let scope = owners.get(owner);
  if (!scope) {
    scope = { sources: new WeakMap(), waiting: new Map() };
    owners.set(owner, scope);
  }
  const previous = hosts.get(host);
  if (previous?.scope === scope && scope.current === previous.ticket) return;
  const retirements = new Set<() => void>();
  const obsolete = new Set<Pending>();
  if (previous && previous.scope.current === previous.ticket) {
    previous.scope.current = undefined;
    if (previous.scope.retireCurrent) retirements.add(previous.scope.retireCurrent);
    previous.scope.retireCurrent = undefined;
    for (const pending of previous.scope.waiting.values()) obsolete.add(pending);
  }
  const owned = scope;
  const ticket = {};
  const listeners = new Set<() => void>();
  const retire = (): void => {
    const callbacks = [...listeners];
    listeners.clear();
    for (const callback of callbacks) {
      try { callback(); } catch { /* One retired subscriber cannot retain another's authority. */ }
    }
  };
  const registration: Registration = {
    scope: owned, ticket,
    isCurrent: () => owned.current === ticket,
    onInvalidate(listener) {
      if (!registration.isCurrent()) { listener(); return () => {}; }
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    acquire(source, channel, signal) {
      if (!registration.isCurrent() || signal.aborted) return Promise.resolve(undefined);
      if (channel === 'page') owned.pageRequested = true;
      let lanes = owned.sources.get(source);
      if (!lanes) { lanes = new Map(); owned.sources.set(source, lanes); }
      let slot = lanes.get(channel);
      if (!slot) { slot = {}; lanes.set(channel, slot); }
      const physical = channel === 'page' && owned.sharedPage ? owned.sharedPage : slot;
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
  if (owned.retireCurrent) retirements.add(owned.retireCurrent);
  for (const pending of owned.waiting.values()) obsolete.add(pending);
  owned.current = ticket;
  owned.retireCurrent = retire;
  hosts.set(host, registration);
  for (const pending of obsolete) pending.cancel();
  // Publish both registrations before callbacks: a nested handoff must remain the newest owner.
  for (const retirePrevious of retirements) retirePrevious();
}

/** Unregistered standalone hosts retain their own controller's physical lanes. */
export function sourcePageScope(host: HTMLElement): SourcePageScope | undefined { return hosts.get(host); }

/** Opt a composition into one physical page query across provider identities and source modes.
 * Call after registration and before its first page request; late activation cannot safely move
 * already-held permits. Selection and locate keep their independent per-provider lanes. */
export function shareSourcePageQueries(host: HTMLElement): void {
  const registration = hosts.get(host);
  if (!registration?.isCurrent()) throw new TypeError('A current source page scope is required');
  if (registration.scope.sharedPage) return;
  if (registration.scope.pageRequested) throw new RangeError('Shared page queries require early registration');
  registration.scope.sharedPage = {};
}
