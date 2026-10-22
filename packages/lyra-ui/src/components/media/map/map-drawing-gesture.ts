import { getInheritedPropertyDescriptor, isObjectValue } from '../../../internal/data-descriptors.js';

type MapDrawingGestureIssue = 'unavailable' | 'stale' | 'peer-error' | 'reentrant';
export interface MapDrawingGestureContext { readonly current: () => boolean; }
export interface MapDrawingGestureLease {
  readonly accepted: boolean;
  readonly code?: MapDrawingGestureIssue;
  /** Terminal and idempotent. False means restoration was unsafe or the native peer failed. */
  readonly release: () => boolean;
}
type NativeMethod = (...args: unknown[]) => unknown;
interface LeaseOwner { released: boolean; releasing: boolean; }
const owners = new WeakMap<object, LeaseOwner>();
class GestureFailure extends Error {
  constructor(readonly code: MapDrawingGestureIssue) { super('Map drawing gesture is unavailable.'); }
}
const rejected = (code: MapDrawingGestureIssue): MapDrawingGestureLease => Object.freeze({ accepted: false, code, release: () => false });

/**
 * Temporarily disables only native double-click zoom. Release before advancing the component's
 * connection/style/drawing-session generation; a stale lease never restores a native handler.
 * Unavailable capabilities reject admission. Native partial failures are restored only while the
 * exact lease is current; stale partial failures fail closed without retained restoration work.
 */
export function acquireMapDrawingGesture(peer: unknown, context: MapDrawingGestureContext): MapDrawingGestureLease {
  if (!isObjectValue(peer)) return rejected('unavailable');
  if (owners.has(peer)) return rejected('reentrant');
  const owner: LeaseOwner = { released: false, releasing: false };
  owners.set(peer, owner);
  let handler: object | undefined;
  let enabled: NativeMethod | undefined, enable: NativeMethod | undefined;
  let ownedDisable = false;
  let releaseResult: boolean | undefined;
  const current = (): boolean => {
    const owns = () => !owner.released && owners.get(peer) === owner;
    try { return owns() && context.current() === true && owns(); } catch { return false; }
  };
  const guard = (): void => { if (!current()) throw new GestureFailure('stale'); };
  const data = (value: object, key: string): unknown => {
    guard(); const descriptor = getInheritedPropertyDescriptor(value, key); guard();
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new GestureFailure('unavailable');
    return descriptor.value;
  };
  const method = (value: object, key: string): NativeMethod => {
    const candidate = data(value, key);
    if (typeof candidate !== 'function') throw new GestureFailure('unavailable');
    return candidate as NativeMethod;
  };
  const readEnabled = (): boolean => {
    guard(); const value: unknown = Reflect.apply(enabled!, handler, []); guard();
    if (typeof value !== 'boolean') throw new GestureFailure('peer-error');
    return value;
  };
  const retire = (): void => {
    owner.released = true;
    if (owners.get(peer) === owner) owners.delete(peer);
  };
  const release = (): boolean => {
    if (releaseResult !== undefined) return releaseResult;
    if (owner.releasing) return false;
    owner.releasing = true;
    try {
      guard();
      if (!ownedDisable) return releaseResult = true;
      // A replacement handler is a different native owner even on the same map object.
      if (data(peer, 'doubleClickZoom') !== handler) return releaseResult = false;
      if (readEnabled()) return releaseResult = true;
      guard(); Reflect.apply(enable!, handler, []); guard();
      return releaseResult = readEnabled();
    } catch { return releaseResult = false; }
    finally { retire(); owner.releasing = false; }
  };
  try {
    const capability = data(peer, 'doubleClickZoom');
    if (!isObjectValue(capability)) throw new GestureFailure('unavailable');
    handler = capability;
    enabled = method(handler, 'isEnabled');
    const disable = method(handler, 'disable'); enable = method(handler, 'enable');
    if (readEnabled()) {
      // Journal before disable: the native callback may change state and then throw.
      ownedDisable = true;
      guard(); Reflect.apply(disable, handler, []); guard();
      if (readEnabled()) { ownedDisable = false; throw new GestureFailure('peer-error'); }
    }
    guard();
    if (data(peer, 'doubleClickZoom') !== handler) throw new GestureFailure('stale');
    return Object.freeze({ accepted: true, release });
  } catch (error) {
    const code: MapDrawingGestureIssue = !current() ? 'stale' : error instanceof GestureFailure ? error.code : 'peer-error';
    release();
    return Object.freeze({ accepted: false, code, release });
  }
}
