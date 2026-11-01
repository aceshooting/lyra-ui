import type { XrOwnedSession } from './controller.js';

/** Native ownership facts retained independently of presentation callbacks. */
export interface NativeXrSessionRecord {
  readonly owned: XrOwnedSession;
  readonly native: XRSession | null;
  readonly ended: boolean;
  /** Requires observed native end; the owner must also await binding settlement. */
  release(): void;
}

/** Observe a granted session before exposing its controller-facing wrapper. */
export function observeNativeXrSession(session: XRSession): NativeXrSessionRecord {
  let native: XRSession | null = session;
  let ended = false, released = false;
  let ending: Promise<void> | undefined;
  let endNative: XRSession['end'] | undefined;
  const listeners = new Set<() => void>();
  const observeEnd = (): void => {
    if (ended) return;
    ended = true;
    const pending = [...listeners];
    listeners.clear();
    for (const listener of pending) listener();
  };
  session.addEventListener('end', observeEnd);
  endNative = session.end;

  const owned: XrOwnedSession = {
    end() {
      if (ending) return ending;
      let resolve!: () => void, reject!: (reason: unknown) => void;
      ending = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
      // Cache before invoking native code so reentrant calls cannot request end twice.
      if (ended) resolve();
      else {
        try { void endNative!.call(native!).then(resolve, reject); }
        catch (error) { reject(error); }
      }
      return ending;
    },
    observeEnd(listener) {
      if (ended) {
        listener();
        return () => {};
      }
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  return {
    owned,
    get native() { return native; },
    get ended() { return ended; },
    release() {
      if (!ended) throw new DOMException('The native XR session has not ended.', 'InvalidStateError');
      if (released) return;
      native!.removeEventListener('end', observeEnd);
      released = true;
      listeners.clear();
      native = null;
      endNative = undefined;
    },
  };
}
