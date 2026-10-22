import { getInheritedPropertyDescriptor, isObjectValue } from '../../../internal/data-descriptors.js';

type MapDrawingPanIssue = 'unavailable' | 'stale' | 'peer-error' | 'reentrant';
export interface MapDrawingPanContext { readonly current: () => boolean; }
export interface MapDrawingPanLease {
  readonly accepted: boolean;
  readonly code?: MapDrawingPanIssue;
  /** Terminal and idempotent. False means restoration was unsafe or the native peer failed. */
  readonly release: () => boolean;
}
type NativeMethod = (...args: unknown[]) => unknown;
interface LeaseOwner { released: boolean; releasing: boolean; }
const owners = new WeakMap<object, LeaseOwner>();
class PanFailure extends Error {
  constructor(readonly code: MapDrawingPanIssue) { super('Map drawing pan is unavailable.'); }
}
const rejected = (code: MapDrawingPanIssue): MapDrawingPanLease => Object.freeze({ accepted: false, code, release: () => false });

/**
 * Temporarily disables only native drag pan. Its ownership is independent of the drawing
 * session double-click zoom lease. Release before advancing the component's
 * connection/style/drawing-session generation; a stale lease never restores a native handler.
 * Unavailable capabilities reject admission. Native partial failures are restored only while the
 * exact lease is current; stale partial failures fail closed without retained restoration work.
 */
export function acquireMapDrawingPan(peer: unknown, context: MapDrawingPanContext): MapDrawingPanLease {
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
  const guard = (): void => { if (!current()) throw new PanFailure('stale'); };
  const data = (value: object, key: string): unknown => {
    guard(); const descriptor = getInheritedPropertyDescriptor(value, key); guard();
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new PanFailure('unavailable');
    return descriptor.value;
  };
  const method = (value: object, key: string): NativeMethod => {
    const candidate = data(value, key);
    if (typeof candidate !== 'function') throw new PanFailure('unavailable');
    return candidate as NativeMethod;
  };
  const guardHandler = (): void => {
    if (data(peer, 'dragPan') !== handler) throw new PanFailure('stale');
  };
  const readEnabled = (): boolean => {
    guardHandler(); const value: unknown = Reflect.apply(enabled!, handler, []); guardHandler();
    if (typeof value !== 'boolean') throw new PanFailure('peer-error');
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
      if (data(peer, 'dragPan') !== handler) return releaseResult = false;
      if (readEnabled()) return releaseResult = true;
      guardHandler(); Reflect.apply(enable!, handler, []); guardHandler();
      return releaseResult = readEnabled();
    } catch { return releaseResult = false; }
    finally { retire(); owner.releasing = false; }
  };
  try {
    const capability = data(peer, 'dragPan');
    if (!isObjectValue(capability)) throw new PanFailure('unavailable');
    handler = capability;
    enabled = method(handler, 'isEnabled');
    const disable = method(handler, 'disable'); enable = method(handler, 'enable');
    if (readEnabled()) {
      // Journal before disable: the native callback may change state and then throw.
      ownedDisable = true;
      guardHandler(); Reflect.apply(disable, handler, []); guardHandler();
      if (readEnabled()) { ownedDisable = false; throw new PanFailure('peer-error'); }
    }
    guard();
    if (data(peer, 'dragPan') !== handler) throw new PanFailure('stale');
    return Object.freeze({ accepted: true, release });
  } catch (error) {
    const code: MapDrawingPanIssue = !current() ? 'stale' : error instanceof PanFailure ? error.code : 'peer-error';
    release();
    return Object.freeze({ accepted: false, code, release });
  }
}
