import { simulationClockLifetime, type ClockSnapshot, type SimulationClock } from '../simulation-clock.js';
import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from './data-descriptors.js';
import { admitMapCameraTour, admitMapViewpoint, sampleMapCameraTour, type AdmittedMapCameraTour, type MapViewpoint } from './map-camera-session-data.js';
import { mapCameraSessionAttachment, type MapCameraPreparedCommand, type MapCameraSessionLease } from './map-camera-session.js';

export type MapCameraSessionErrorCode = 'invalid-options' | 'invalid-viewpoint' | 'invalid-tour' | 'invalid-clock' | 'unsupported-map' | 'inactive-map' | 'already-bound' | 'unavailable' | 'disposed';
export class MapCameraSessionError extends Error {
  constructor(readonly code: MapCameraSessionErrorCode) { super(code); this.name = 'MapCameraSessionError'; }
}
type Reason = 'initial' | 'start' | 'complete' | 'stop' | 'user' | 'external' | 'style' | 'disconnect' | 'engine' | 'motion' | 'disposed';
export interface MapCameraSessionSnapshot {
  readonly mode: 'idle' | 'viewpoint' | 'tour';
  readonly active: boolean;
  readonly reason: Reason;
}
interface Transition { readonly kind: 'jump' | 'ease' | 'fly'; readonly duration?: number; }
interface Subscription { active: boolean; readonly listener: (snapshot: MapCameraSessionSnapshot) => void; release(): void; }
interface Action {
  readonly token: object;
  readonly mode: 'viewpoint' | 'tour';
  readonly view?: MapViewpoint;
  readonly tour?: AdmittedMapCameraTour;
  readonly cleanups: Set<() => void>;
  animating: boolean;
  delivered?: ClockSnapshot;
  applied?: MapViewpoint;
}
const fail = (code: MapCameraSessionErrorCode): never => { throw new MapCameraSessionError(code); };
function report(error: unknown): void {
  try { if (typeof globalThis.reportError === 'function') globalThis.reportError(error); } catch { /* Reporting cannot interrupt ownership cleanup. */ }
}
function data(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!isPlainDataRecord(input)) return fail('invalid-options');
  let keys: readonly PropertyKey[];
  try { keys = Reflect.ownKeys(input); } catch { return fail('invalid-options'); }
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.includes(key)) return fail('invalid-options');
    const descriptor = getOwnDataDescriptor(input, key);
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return fail('invalid-options');
    result[key] = descriptor.value;
  }
  return result;
}
function signalOption(input: unknown): AbortSignal | undefined {
  const signal = data(input === undefined ? {} : input, ['signal'])['signal'] as AbortSignal | undefined;
  try {
    if (signal !== undefined && (!signal || typeof signal.aborted !== 'boolean' ||
      typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) return fail('invalid-options');
  } catch { return fail('invalid-options'); }
  return signal;
}
function transitionOption(input: unknown): Transition {
  const record = data(input === undefined ? {} : input, ['kind', 'duration']);
  const kind = record['kind'] === undefined ? 'jump' : record['kind'];
  const duration = record['duration'];
  if (kind !== 'jump' && kind !== 'ease' && kind !== 'fly') return fail('invalid-options');
  if (duration !== undefined && (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0)) return fail('invalid-options');
  return Object.freeze({ kind, ...(duration === undefined ? {} : { duration }) });
}
function sameView(first: MapViewpoint | undefined, second: MapViewpoint): boolean {
  return first !== undefined && first.zoom === second.zoom && first.bearing === second.bearing && first.pitch === second.pitch &&
    first.center[0] === second.center[0] && first.center[1] === second.center[1];
}

/** Internal saved-view and shared-clock owner. Native attachment and clock instances remain opaque. */
export function createMapCameraSessionController(host: HTMLElement, options?: { readonly signal?: AbortSignal }) {
  const signal = signalOption(options);
  let disposed = false, generation = 0;
  let lease: MapCameraSessionLease | undefined;
  let action: Action | undefined;
  let snapshot: MapCameraSessionSnapshot = Object.freeze({ mode: 'idle', active: false, reason: 'initial' });
  const subscriptions = new Set<Subscription>();
  const active = (): void => { if (disposed) fail('disposed'); };
  const current = (candidate: Action): boolean => !disposed && action === candidate && lease?.current() === true;
  const publish = (next: MapCameraSessionSnapshot): void => {
    if (snapshot.mode === next.mode && snapshot.active === next.active && snapshot.reason === next.reason) return;
    snapshot = Object.freeze(next);
    const delivered = snapshot;
    for (const subscription of [...subscriptions]) {
      if (snapshot !== delivered) break;
      if (subscription.active) { try { subscription.listener(delivered); } catch (error) { report(error); } }
    }
  };
  const cleanup = (candidate: Action, stopAnimation: boolean): void => {
    for (const release of [...candidate.cleanups]) { candidate.cleanups.delete(release); try { release(); } catch (error) { report(error); } }
    try { lease?.retire(candidate.token, stopAnimation && candidate.animating); } catch (error) { report(error); }
    candidate.animating = false;
  };
  const prepare = (token: object, target: MapViewpoint, transition: Transition): MapCameraPreparedCommand => {
    if (!lease?.current()) return fail('unavailable');
    try { return lease.prepare(token, target, transition); } catch { return fail('unavailable'); }
  };
  const replace = (next: Action): boolean => {
    const intent = ++generation, previous = action;
    action = undefined;
    if (previous) cleanup(previous, true);
    if (disposed || generation !== intent) return false;
    let started = false;
    try { started = lease?.current() === true && lease.start(next.token); } catch { /* A stale attachment cannot acquire an action. */ }
    if (disposed || generation !== intent) { if (started) lease?.retire(next.token, false); return false; }
    if (!started) {
      publish({ mode: next.mode, active: false, reason: 'engine' });
      return fail('unavailable');
    }
    action = next;
    publish({ mode: next.mode, active: true, reason: 'start' });
    return current(next);
  };
  const unavailable = (candidate: Action): void => {
    if (action !== candidate || disposed) return;
    const intent = ++generation; action = undefined;
    cleanup(candidate, true);
    if (!disposed && generation === intent) publish({ mode: candidate.mode, active: false, reason: 'engine' });
  };
  const commit = (candidate: Action, command: MapCameraPreparedCommand): boolean => {
    if (!current(candidate)) return false;
    let accepted = false;
    try { accepted = lease!.commit(command); } catch { /* A failed native command is unavailable. */ }
    if (!accepted) { unavailable(candidate); return false; }
    if (current(candidate)) candidate.applied = command.view;
    return true;
  };
  const retire = (reason: Reason, stopAnimation: boolean): void => {
    const intent = ++generation, previous = action; action = undefined;
    if (previous) cleanup(previous, stopAnimation);
    if (!disposed && generation === intent) publish({ mode: 'idle', active: false, reason });
  };
  const dispose = (reason: 'disposed' | 'disconnect' = 'disposed'): void => {
    if (disposed) return;
    disposed = true; generation++;
    const previous = action; action = undefined;
    if (previous) cleanup(previous, true);
    signal?.removeEventListener('abort', abort);
    lease?.release();
    publish({ mode: 'idle', active: false, reason });
    for (const subscription of [...subscriptions]) subscription.release();
  };
  const abort = (): void => { dispose(); };
  const sample = (candidate: Action, delivered: ClockSnapshot, resample = false): void => {
    if (!current(candidate) || !candidate.tour) return;
    if (!resample && candidate.delivered && delivered.revision <= candidate.delivered.revision) return;
    candidate.delivered = delivered;
    try {
      const target = sampleMapCameraTour(candidate.tour, delivered.instant, { reducedMotion: lease!.reducedMotion() });
      if (!current(candidate)) return;
      const command = prepare(candidate.token, target, { kind: 'jump' });
      if (!current(candidate) || sameView(candidate.applied, command.view)) return;
      commit(candidate, command);
    } catch { unavailable(candidate); }
  };
  const restore = (input: unknown, transition?: { readonly kind?: 'jump' | 'ease' | 'fly'; readonly duration?: number }): void => {
    active(); const intent = generation;
    let target: MapViewpoint;
    try { target = admitMapViewpoint(input); } catch { return fail('invalid-viewpoint'); }
    const accepted = transitionOption(transition), token = Object.freeze({});
    const command = prepare(token, target, accepted);
    if (disposed || generation !== intent) return;
    const next: Action = { token, mode: 'viewpoint', view: command.view, cleanups: new Set(), animating: command.kind !== 'jump' };
    if (!replace(next)) return;
    if (!commit(next, command) && !disposed && action === undefined && snapshot.reason === 'engine') fail('unavailable');
  };
  if (signal?.aborted) { disposed = true; snapshot = Object.freeze({ mode: 'idle', active: false, reason: 'disposed' }); }
  else {
    const attachment = mapCameraSessionAttachment(host);
    if (!attachment) return fail('unsupported-map');
    lease = attachment.acquire({
      complete(token) {
        const completed = action;
        if (!completed || completed.token !== token || !current(completed) || completed.mode !== 'viewpoint') return;
        completed.animating = false;
        publish({ mode: 'viewpoint', active: false, reason: 'complete' });
      },
      interrupt(reason) { if (disposed) return; if (reason === 'disconnect') dispose('disconnect'); else retire(reason, false); },
      motion(reduced) {
        const previous = action;
        if (!previous || !current(previous)) return;
        if (previous.mode === 'tour') { if (previous.delivered) sample(previous, previous.delivered, true); }
        else if (reduced && previous.animating && previous.view) {
          try { restore(previous.view, { kind: 'jump' }); } catch { if (current(previous)) unavailable(previous); }
        }
      },
    });
    if (disposed) lease.release();
    else {
      try { signal?.addEventListener('abort', abort, { once: true }); } catch { lease.release(); return fail('invalid-options'); }
      if (signal?.aborted) dispose();
    }
  }
  return {
    get snapshot(): MapCameraSessionSnapshot { return snapshot; },
    capture(): MapViewpoint {
      active();
      if (!lease?.current()) return fail('unavailable');
      try { return admitMapViewpoint(lease.capture()); } catch { return fail('unavailable'); }
    },
    restore,
    tour(clock: SimulationClock, input: unknown): void {
      active(); const intent = generation;
      let admitted: AdmittedMapCameraTour;
      try { admitted = admitMapCameraTour(input); } catch { return fail('invalid-tour'); }
      const lifetime = simulationClockLifetime(clock);
      if (!lifetime || lifetime.disposed()) return fail('invalid-clock');
      const token = Object.freeze({});
      prepare(token, sampleMapCameraTour(admitted, clock.snapshot.instant), { kind: 'jump' });
      if (lifetime.disposed()) return fail('invalid-clock');
      if (disposed || generation !== intent) return;
      const next: Action = { token, mode: 'tour', tour: admitted, cleanups: new Set(), animating: false };
      if (!replace(next)) return;
      const addCleanup = (release: () => void): void => { if (current(next)) next.cleanups.add(release); else release(); };
      try {
        addCleanup(lifetime.onDispose(() => { if (current(next)) retire('engine', false); }));
        if (!current(next)) return;
        // subscribe delivers accepted snapshots, and defers initial delivery during dispatch.
        // Never substitute sampled currentInstant or a pending desired clock command.
        const release = clock.subscribe(delivered => { sample(next, delivered); });
        addCleanup(release);
        if (!disposed && action === undefined && snapshot.reason === 'engine') fail('unavailable');
      } catch {
        unavailable(next);
        return fail('unavailable');
      }
    },
    stop(): void { active(); retire('stop', true); },
    subscribe(listener: (state: MapCameraSessionSnapshot) => void, options?: { readonly signal?: AbortSignal }): () => void {
      active();
      if (typeof listener !== 'function') return fail('invalid-options');
      const signal = signalOption(options);
      if (signal?.aborted) return () => undefined;
      const subscription: Subscription = { active: true, listener, release() {
        if (!subscription.active) return;
        subscription.active = false; subscriptions.delete(subscription); signal?.removeEventListener('abort', subscription.release);
      } };
      try { signal?.addEventListener('abort', subscription.release, { once: true }); }
      catch { return fail('invalid-options'); }
      if (disposed || signal?.aborted) { subscription.release(); return subscription.release; }
      subscriptions.add(subscription);
      try { listener(snapshot); } catch (error) { report(error); }
      return subscription.release;
    },
    dispose(): void { dispose(); },
  };
}
