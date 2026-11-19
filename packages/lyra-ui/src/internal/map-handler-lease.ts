import { getInheritedPropertyDescriptor, isObjectValue } from './data-descriptors.js';

type MapHandlerLeaseIssue = 'unavailable' | 'stale' | 'peer-error' | 'reentrant';
export interface MapHandlerLeaseContext { readonly current: () => boolean; }
export interface MapHandlerLease {
  readonly accepted: boolean;
  readonly code?: MapHandlerLeaseIssue;
  /** Terminal and idempotent. False means restoration was unsafe or the native peer failed. */
  readonly release: () => boolean;
}
type NativeMethod = (...args: unknown[]) => unknown;
interface LeaseOwner { released: boolean; releasing: boolean; }
/** Ownership is per native handler key, so independent handlers of one peer lease independently. */
const ownersByKey = new Map<string, WeakMap<object, LeaseOwner>>();
class LeaseFailure extends Error {
  constructor(readonly code: MapHandlerLeaseIssue) { super('Map native handler is unavailable.'); }
}
const rejected = (code: MapHandlerLeaseIssue): MapHandlerLease => Object.freeze({ accepted: false, code, release: () => false });

/**
 * Temporarily disables one native interaction handler (`peer[key]`, for example `dragPan` or
 * `doubleClickZoom`). Release before advancing the component's connection/style/drawing-session
 * generation; a stale lease never restores a native handler. Unavailable capabilities reject
 * admission. Native partial failures are restored only while the exact lease is current; stale
 * partial failures fail closed without retained restoration work. Every read re-validates that the
 * peer still exposes the handler the lease captured, so a replacement handler is never mutated.
 */
export function acquireMapHandlerLease(peer: unknown, key: string, context: MapHandlerLeaseContext): MapHandlerLease {
  if (!isObjectValue(peer)) return rejected('unavailable');
  let owners = ownersByKey.get(key);
  if (!owners) { owners = new WeakMap(); ownersByKey.set(key, owners); }
  const registry = owners;
  if (registry.has(peer)) return rejected('reentrant');
  const owner: LeaseOwner = { released: false, releasing: false };
  registry.set(peer, owner);
  let handler: object | undefined;
  let enabled: NativeMethod | undefined, enable: NativeMethod | undefined;
  let ownedDisable = false;
  let releaseResult: boolean | undefined;
  const current = (): boolean => {
    const owns = () => !owner.released && registry.get(peer) === owner;
    try { return owns() && context.current() === true && owns(); } catch { return false; }
  };
  const guard = (): void => { if (!current()) throw new LeaseFailure('stale'); };
  const data = (value: object, name: string): unknown => {
    guard(); const descriptor = getInheritedPropertyDescriptor(value, name); guard();
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new LeaseFailure('unavailable');
    return descriptor.value;
  };
  const method = (value: object, name: string): NativeMethod => {
    const candidate = data(value, name);
    if (typeof candidate !== 'function') throw new LeaseFailure('unavailable');
    return candidate as NativeMethod;
  };
  const guardHandler = (): void => {
    if (data(peer, key) !== handler) throw new LeaseFailure('stale');
  };
  const readEnabled = (): boolean => {
    guardHandler(); const value: unknown = Reflect.apply(enabled!, handler, []); guardHandler();
    if (typeof value !== 'boolean') throw new LeaseFailure('peer-error');
    return value;
  };
  const retire = (): void => {
    owner.released = true;
    if (registry.get(peer) === owner) registry.delete(peer);
  };
  const release = (): boolean => {
    if (releaseResult !== undefined) return releaseResult;
    if (owner.releasing) return false;
    owner.releasing = true;
    try {
      guard();
      if (!ownedDisable) return releaseResult = true;
      // A replacement handler is a different native owner even on the same map object.
      if (data(peer, key) !== handler) return releaseResult = false;
      if (readEnabled()) return releaseResult = true;
      guardHandler(); Reflect.apply(enable!, handler, []); guardHandler();
      return releaseResult = readEnabled();
    } catch { return releaseResult = false; }
    finally { retire(); owner.releasing = false; }
  };
  try {
    const capability = data(peer, key);
    if (!isObjectValue(capability)) throw new LeaseFailure('unavailable');
    handler = capability;
    enabled = method(handler, 'isEnabled');
    const disable = method(handler, 'disable'); enable = method(handler, 'enable');
    if (readEnabled()) {
      // Journal before disable: the native callback may change state and then throw.
      ownedDisable = true;
      guardHandler(); Reflect.apply(disable, handler, []); guardHandler();
      if (readEnabled()) { ownedDisable = false; throw new LeaseFailure('peer-error'); }
    }
    guard();
    if (data(peer, key) !== handler) throw new LeaseFailure('stale');
    return Object.freeze({ accepted: true, release });
  } catch (error) {
    const code: MapHandlerLeaseIssue = !current() ? 'stale' : error instanceof LeaseFailure ? error.code : 'peer-error';
    release();
    return Object.freeze({ accepted: false, code, release });
  }
}
