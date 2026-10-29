import { admitMapCameraFollowOptions, admitMapCameraFollowProfile, createMapCameraFollowAttempt,
  observeMapCameraFollowAttempt, type MapCameraFollowOptions } from './map-camera-follow-data.js';
import { admitMapViewpoint, type MapViewpoint } from './map-camera-session-data.js';

export type MapCameraFollowTarget =
  | { readonly kind: 'absent' }
  | { readonly kind: 'unsupported'; readonly objectKind: 'path' | 'arc' }
  | { readonly kind: 'eligible'; readonly objectKind: 'marker' | 'model'; readonly positionRevision: number;
    readonly center: readonly [number, number]; readonly altitude: number; readonly altitudeReference: 'sea-level' | 'terrain' };
export interface MapCameraFollowStamp {
  readonly owner: object;
  readonly context: number;
  readonly style: number;
  readonly view: number;
  readonly position: number;
  readonly placement: number;
}
export interface MapCameraFollowFrame {
  readonly serial: number;
  readonly stamp: MapCameraFollowStamp;
  readonly profile: unknown;
  readonly result: { readonly status: 'visible'; readonly point: readonly [number, number] } |
    { readonly status: 'pending' | 'occluded' | 'clipped' | 'behind-camera' | 'unavailable' };
  readonly width: number;
  readonly height: number;
}
export type MapCameraFollowNotice = { readonly kind: 'target'; readonly objectId: string } |
  { readonly kind: 'viewport'; readonly revision: number };
/** An injected completed-frame capability; acquiring it never acquires a camera. */
export interface MapCameraFollowScene {
  target(objectId: string): MapCameraFollowTarget;
  subscribeTargets(listener: (notice: MapCameraFollowNotice) => void): () => void;
  watchTarget(objectId: string): () => void;
  subscribeFrames(objectId: string, listener: (frame: MapCameraFollowFrame) => void): () => void;
  current(stamp: MapCameraFollowStamp): boolean;
  requestFrame(objectId: string): void;
}
export interface MapCameraFollowDependencies {
  current(): boolean;
  capture(): MapViewpoint;
  reducedMotion(): boolean;
  readonly scene?: MapCameraFollowScene;
}
export interface MapCameraFollowSnapshot {
  readonly status: 'ground' | 'missing' | 'pending' | 'centering' | 'centered' | 'limited' | 'unavailable';
  readonly reason?: 'scene' | 'kind' | 'placement' | 'camera-constraints' | 'camera-capability' | 'camera-domain' | 'terrain' | 'engine';
  readonly corrections: number;
}
/** Every method is bound by the caller to one already-started camera action. */
export interface MapCameraFollowOwner {
  current(): boolean;
  ready?(runner: MapCameraFollowRunner): void;
  prepareGround(view: MapViewpoint): object;
  commitGround(prepared: object): boolean;
  preparePan(offset: readonly [number, number], stamp: MapCameraFollowStamp): object;
  commitPan(prepared: object): boolean;
  publish(snapshot: MapCameraFollowSnapshot): void;
}
declare const followPlan: unique symbol;
export interface MapCameraFollowPlan { readonly [followPlan]: true; }
export interface MapCameraFollowRunner {
  readonly snapshot: MapCameraFollowSnapshot;
  refreshMotion(reduced: boolean): void;
  dispose(): void;
}
interface Plan {
  readonly options: MapCameraFollowOptions;
  readonly dependencies: MapCameraFollowDependencies;
  readonly view: MapViewpoint;
  readonly reduced: boolean;
}
const plans = new WeakMap<MapCameraFollowPlan, Plan>();
const unavailable = (): never => { throw new Error('Camera follow unavailable'); };

/** Performs inert admission before the caller retires its previous camera action. */
export function prepareMapCameraFollow(input: unknown, dependencies: MapCameraFollowDependencies): MapCameraFollowPlan {
  const options = admitMapCameraFollowOptions(input);
  // Screen following cannot seed an unqualified camera change before its frame is admitted.
  if (options.mode === 'geographic-visual' && (options.zoom !== undefined || options.bearing !== undefined || options.pitch !== undefined)) {
    throw new TypeError('Explicit camera axes are unavailable for screen following');
  }
  const check = (): void => { if (!dependencies.current()) unavailable(); };
  check();
  const target = dependencies.scene?.target(options.objectId); check();
  if (target?.kind === 'unsupported') throw new TypeError('Unsupported camera follow target');
  const view = admitMapViewpoint(dependencies.capture()); check();
  const reduced = dependencies.reducedMotion(); check();
  const plan = Object.freeze({}) as MapCameraFollowPlan;
  plans.set(plan, { options, dependencies, view, reduced });
  return plan;
}
function sameView(first: MapViewpoint | undefined, second: MapViewpoint): boolean {
  return first !== undefined && first.center[0] === second.center[0] && first.center[1] === second.center[1] &&
    first.zoom === second.zoom && first.bearing === second.bearing && first.pitch === second.pitch;
}

/** Consumes accepted target facts for one existing action; it owns no native camera or clock. */
export function startMapCameraFollow(plan: MapCameraFollowPlan, owner: MapCameraFollowOwner): MapCameraFollowRunner {
  const admitted = plans.get(plan);
  if (!admitted) throw new TypeError('Invalid camera follow plan');
  const { options, dependencies, view } = admitted;
  const scene = dependencies.scene;
  let disposed = false, failed = false, starting = true, draining = false;
  let revision = 0, pendingTarget = false, queuedFrame: MapCameraFollowFrame | undefined;
  let target: MapCameraFollowTarget = { kind: 'absent' }, positionRevision: number | undefined;
  let viewportRevision = -1, lastSerial = -1, lastObservedSerial = -1, writes = 0;
  let highestPositionRevision = -1;
  let restricted = admitted.reduced, profileRefused = false, limitedByMotion = false;
  let attempt = createMapCameraFollowAttempt({ reducedMotion: restricted });
  let applied: MapViewpoint | undefined;
  let snapshot: MapCameraFollowSnapshot = Object.freeze({ status: 'pending', corrections: 0 });
  const releases = new Set<() => void>();
  const live = (): boolean => !disposed && owner.current();
  const releaseAll = (): void => {
    for (const release of [...releases]) {
      releases.delete(release);
      try { release(); } catch { /* A faulty observer cannot retain the other subscriptions. */ }
    }
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true; revision++; pendingTarget = false; queuedFrame = undefined; releaseAll();
  };
  const publish = (next: MapCameraFollowSnapshot): void => {
    if (!live()) { dispose(); return; }
    if (snapshot.status === next.status && snapshot.reason === next.reason && snapshot.corrections === next.corrections) return;
    snapshot = Object.freeze(next);
    owner.publish(snapshot);
    if (!live()) dispose();
  };
  const fail = (): void => {
    if (disposed) return;
    failed = true; revision++; pendingTarget = false; queuedFrame = undefined;
    releaseAll();
    if (live()) publish({ status: 'unavailable', reason: 'engine', corrections: attempt.corrections });
    else dispose();
  };
  const guard = (delivery: number): boolean => {
    if (!live()) { dispose(); return false; }
    return !failed && revision === delivery;
  };
  const add = (release: () => void): void => {
    if (live() && !failed) releases.add(release);
    else { try { release(); } finally { dispose(); } }
  };
  const reset = (): void => {
    attempt = createMapCameraFollowAttempt({ reducedMotion: restricted }); profileRefused = false; limitedByMotion = false;
  };
  const request = (): void => {
    if (!live() || failed || !scene || options.mode !== 'geographic-visual') return;
    scene.requestFrame(options.objectId);
    if (!live()) dispose();
  };
  const targetCurrent = (expected: number, delivery: number): boolean => {
    if (!guard(delivery) || !scene) return false;
    const latest = scene.target(options.objectId);
    if (!guard(delivery)) return false;
    return latest.kind === 'eligible' && latest.positionRevision === expected;
  };
  const deliverTarget = (): void => {
    const delivery = revision;
    if (!guard(delivery) || !scene) return;
    const next = scene.target(options.objectId);
    if (!guard(delivery)) return;
    if (next.kind === 'eligible' && (next.positionRevision < highestPositionRevision ||
      (target.kind !== 'eligible' && next.positionRevision <= highestPositionRevision))) return;
    target = next;
    if (next.kind !== 'eligible') {
      positionRevision = undefined;
      publish(next.kind === 'absent' ? { status: 'missing', corrections: attempt.corrections } :
        { status: 'unavailable', reason: 'kind', corrections: attempt.corrections });
      return;
    }
    const changed = positionRevision !== next.positionRevision;
    positionRevision = next.positionRevision;
    highestPositionRevision = Math.max(highestPositionRevision, next.positionRevision);
    if (options.mode === 'geographic-visual') {
      if (changed) {
        reset(); publish({ status: 'pending', corrections: 0 });
        if (guard(delivery)) request();
      }
      return;
    }
    const destination = admitMapViewpoint({ center: next.center, zoom: options.zoom ?? view.zoom,
      bearing: options.bearing ?? view.bearing, pitch: options.pitch ?? view.pitch });
    if (sameView(applied, destination) || (restricted && writes > 0)) {
      publish({ status: 'ground', corrections: 0 }); return;
    }
    const prepared = owner.prepareGround(destination);
    if (!targetCurrent(next.positionRevision, delivery)) return;
    const accepted = owner.commitGround(prepared);
    if (accepted) { writes++; applied = destination; }
    if (!guard(delivery)) return;
    if (!accepted) { fail(); return; }
    publish({ status: 'ground', corrections: 0 });
  };
  const deliverFrame = (frame: MapCameraFollowFrame): void => {
    const delivery = revision;
    if (!guard(delivery) || !scene || options.mode !== 'geographic-visual' || target.kind !== 'eligible' ||
      profileRefused || limitedByMotion || attempt.status !== 'centering' || frame.serial <= lastSerial || frame.serial <= lastObservedSerial || frame.stamp.position !== target.positionRevision) return;
    if (!scene.current(frame.stamp) || !guard(delivery) || !targetCurrent(target.positionRevision, delivery)) return;
    if (!Number.isSafeInteger(frame.serial) || frame.serial < 0) return;
    lastObservedSerial = frame.serial;
    const profile = admitMapCameraFollowProfile(frame.profile);
    if (profile.status === 'unavailable') {
      profileRefused = true; publish({ status: 'unavailable', reason: profile.reason, corrections: attempt.corrections }); return;
    }
    if (frame.result.status !== 'visible') {
      publish(frame.result.status === 'pending' ? { status: 'pending', corrections: attempt.corrections } :
        { status: 'unavailable', reason: 'placement', corrections: attempt.corrections });
      return;
    }
    const observedAttempt = attempt;
    const step = observeMapCameraFollowAttempt(observedAttempt, { frame: frame.serial, point: frame.result.point, width: frame.width, height: frame.height });
    if (!step.correction) {
      attempt = step.attempt;
      publish({ status: step.status, corrections: attempt.corrections }); return;
    }
    if (restricted && writes > 0) {
      limitedByMotion = true;
      publish({ status: 'limited', corrections: attempt.corrections }); return;
    }
    const prepared = owner.preparePan(step.correction, frame.stamp);
    if (!guard(delivery) || !targetCurrent(frame.stamp.position, delivery) || !scene.current(frame.stamp) || !guard(delivery)) return;
    const accepted = owner.commitPan(prepared);
    if (accepted) {
      writes++; lastSerial = Math.max(lastSerial, frame.serial);
      // An equal-target notification may invalidate delivery without resetting its attempt.
      if (attempt === observedAttempt) attempt = step.attempt;
    }
    if (!guard(delivery)) return;
    if (!accepted) { fail(); return; }
    publish({ status: step.status, corrections: attempt.corrections });
  };
  const drain = (): void => {
    if (starting || draining || disposed || failed) return;
    draining = true;
    try {
      while (!disposed && !failed && (pendingTarget || queuedFrame)) {
        if (pendingTarget) { pendingTarget = false; deliverTarget(); }
        else {
          const frame = queuedFrame; queuedFrame = undefined;
          if (frame) deliverFrame(frame);
        }
      }
    } catch { fail(); }
    finally { draining = false; }
  };
  const applyNotice = (value: MapCameraFollowNotice): void => {
    if (!live() || failed) { if (!live()) dispose(); return; }
    if (value.kind === 'target') {
      if (value.objectId !== options.objectId) return;
      revision++; pendingTarget = true;
    } else {
      if (!Number.isSafeInteger(value.revision) || value.revision <= viewportRevision) return;
      viewportRevision = value.revision; revision++;
      if (options.mode === 'geographic-visual') { reset(); request(); }
    }
    drain();
  };
  const applyFrame = (frame: MapCameraFollowFrame): void => {
    if (!live() || failed) { if (!live()) dispose(); return; }
    if (!queuedFrame || frame.serial > queuedFrame.serial) queuedFrame = frame;
    drain();
  };
  const notice = (value: MapCameraFollowNotice): void => {
    try { applyNotice(value); } catch { fail(); }
  };
  const receiveFrame = (frame: MapCameraFollowFrame): void => {
    try { applyFrame(frame); } catch { fail(); }
  };
  const refreshMotion = (reduced: boolean): void => {
    if (disposed || failed || !reduced || restricted) return;
    restricted = true; revision++;
    // Keep terminal/nonimprovement state; the lifetime write latch supplies the tighter limit.
  };
  const runner: MapCameraFollowRunner = { get snapshot() { return snapshot; }, refreshMotion, dispose };
  try {
    if (!live()) { dispose(); return runner; }
    restricted = dependencies.reducedMotion();
    if (!live()) { dispose(); return runner; }
    attempt = createMapCameraFollowAttempt({ reducedMotion: restricted });
    owner.ready?.(runner);
    if (!live()) { dispose(); return runner; }
    if (!scene) { publish({ status: 'unavailable', reason: 'scene', corrections: 0 }); return runner; }
    add(scene.subscribeTargets(notice));
    if (!live()) return runner;
    if (options.mode === 'geographic-visual') {
      add(scene.watchTarget(options.objectId));
      if (!live()) return runner;
      add(scene.subscribeFrames(options.objectId, receiveFrame));
      if (!live()) return runner;
    }
    pendingTarget = true; starting = false; drain();
  } catch { fail(); }
  finally { starting = false; }
  return runner;
}
