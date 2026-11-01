import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR,
  readOwnArrayLength, UNSAFE_OWN_DATA_DESCRIPTOR } from './data-descriptors.js';
import type { MapSceneSessionAttachment, MapSceneSessionBacking, MapSceneSessionFacade, MapSceneSessionState,
  SceneCompletedFrame, ScenePadding, SceneRegistryNotice, SceneSessionStateSnapshot, SceneTargetEntry,
  SceneTargetFact, SceneTargetLookup, SceneTargetProjection, SceneViewportNotice } from './map-scene-contract.js';

type Release = () => void;
interface StateView {
  readonly snapshot: SceneSessionStateSnapshot;
  readonly targets: ReadonlyMap<string, SceneTargetEntry>;
}
interface StateBinding {
  readonly state: MapSceneSessionState;
  readonly capture: MapSceneSessionState['capture'];
  readonly subscribe: MapSceneSessionState['subscribe'];
  release?: Release;
}
interface FrameBinding {
  readonly backing: MapSceneSessionBacking;
  readonly generation: number;
  readonly subscribe: MapSceneSessionBacking['subscribeCompletedFrames'];
  readonly watch: MapSceneSessionBacking['watchTarget'];
  readonly request: MapSceneSessionBacking['requestFrame'];
  readonly project: MapSceneSessionBacking['projectTarget'];
  readonly current: MapSceneSessionBacking['current'];
  readonly watches: Map<string, Release>;
  release?: Release;
  ready: boolean;
}
interface TargetObserver { readonly listener: (notice: SceneRegistryNotice) => void; baseline: StateView; }
interface ViewportObserver { readonly listener: (notice: SceneViewportNotice) => void; baseline: SceneViewportNotice | undefined; }
interface FrameObserver { readonly listener: (frame: SceneCompletedFrame) => void; }
interface PendingFrame { readonly frame: SceneCompletedFrame; readonly binding: FrameBinding; }

const MAX_WATCHES = 2000;
const MAX_BACKEND_CALLS = 6144;
const MAX_NOTIFICATION_PASSES = 6144;
const MAX_CLEANUP_CALLS = 2048;
const budgetExceeded = Object.freeze({});
const absent: SceneTargetLookup = Object.freeze({ status: 'absent' });
const emptyView: StateView = { snapshot: Object.freeze({ acceptedSceneRevision: 0, registryRevision: 0,
  targets: Object.freeze([]), viewport: undefined }), targets: new Map() };
const attachments = new WeakMap<HTMLElement, MapSceneSessionAttachment>();

function invalid(): never { throw new TypeError('Invalid map scene capability'); }
function own(value: object, key: string): unknown {
  const descriptor = getOwnDataDescriptor(value, key);
  if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return invalid();
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}
function data(value: unknown, keys: readonly string[], frozen = true): Record<string, unknown> {
  if (!isPlainDataRecord(value) || (frozen && !Object.isFrozen(value))) return invalid();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) return invalid();
    own(value, key);
  }
  return value;
}
function finite(value: unknown, minimum = -Infinity, maximum = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) return invalid();
  return value;
}
function counter(value: unknown, minimum = 0): number {
  const result = finite(value, minimum);
  if (!Number.isSafeInteger(result)) return invalid();
  return result;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 1024 || value.trim().length === 0) return invalid();
  return value;
}
function array(value: unknown, maximum: number, frozen = true): readonly unknown[] {
  if (!Array.isArray(value) || (frozen && !Object.isFrozen(value))) return invalid();
  const length = readOwnArrayLength(value);
  if (length === undefined || length > maximum || Reflect.ownKeys(value).length !== length + 1) return invalid();
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = getOwnDataDescriptor(value, String(index));
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return invalid();
    result.push(descriptor.value);
  }
  return result;
}
function padding(value: unknown, frozen = true): ScenePadding {
  const record = data(value, ['top', 'bottom', 'left', 'right'], frozen);
  for (const side of ['top', 'bottom', 'left', 'right']) finite(own(record, side), 0);
  return value as ScenePadding;
}
function samePadding(a: ScenePadding, b: ScenePadding): boolean {
  return a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right;
}
function sameViewport(a: SceneViewportNotice | undefined, b: SceneViewportNotice | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && a.width === b.width && a.height === b.height &&
    a.pixelRatio === b.pixelRatio && samePadding(a.padding, b.padding));
}
function viewport(value: unknown): SceneViewportNotice | undefined {
  if (value === undefined) return undefined;
  const record = data(value, ['allocationRevision', 'width', 'height', 'pixelRatio', 'padding']);
  counter(own(record, 'allocationRevision')); finite(own(record, 'width'), 0); finite(own(record, 'height'), 0);
  if (finite(own(record, 'pixelRatio'), 0) === 0) return invalid();
  padding(own(record, 'padding'));
  return value as SceneViewportNotice;
}
function eligible(value: SceneTargetEntry | undefined): value is SceneTargetFact {
  return value !== undefined && (value.kind === 'marker' || value.kind === 'model');
}
function sameTarget(a: SceneTargetEntry | undefined, b: SceneTargetEntry | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if (!eligible(a) || !eligible(b)) return true;
  return a.acceptedPositionRevision === b.acceptedPositionRevision &&
    a.position.lngLat[0] === b.position.lngLat[0] && a.position.lngLat[1] === b.position.lngLat[1] &&
    a.position.altitude === b.position.altitude && a.position.altitudeReference === b.position.altitudeReference;
}
function targetEntry(value: unknown): SceneTargetEntry {
  const record = data(value, ['id', 'kind', 'position', 'acceptedPositionRevision']);
  identifier(own(record, 'id'));
  const kind = own(record, 'kind');
  if (kind === 'path' || kind === 'arc') {
    data(value, ['id', 'kind']);
    return value as SceneTargetEntry;
  }
  if (kind !== 'marker' && kind !== 'model') return invalid();
  counter(own(record, 'acceptedPositionRevision'), 1);
  const position = data(own(record, 'position'), ['lngLat', 'altitude', 'altitudeReference']);
  const point = array(own(position, 'lngLat'), 2);
  if (point.length !== 2 || finite(point[0], -180, 180) === 180) return invalid();
  finite(point[1], -85.0511287798066, 85.0511287798066); finite(own(position, 'altitude'), -12000, 100000000);
  const reference = own(position, 'altitudeReference');
  if (reference !== 'sea-level' && reference !== 'terrain') return invalid();
  return value as SceneTargetFact;
}
function captureView(value: unknown): StateView {
  const record = data(value, ['acceptedSceneRevision', 'registryRevision', 'targets', 'viewport']);
  counter(own(record, 'acceptedSceneRevision')); counter(own(record, 'registryRevision'));
  viewport(own(record, 'viewport'));
  const targets = new Map<string, SceneTargetEntry>();
  for (const raw of array(own(record, 'targets'), MAX_WATCHES)) {
    const entry = targetEntry(raw);
    if (targets.has(entry.id)) return invalid();
    targets.set(entry.id, entry);
  }
  if (targets.size > 0 && (own(record, 'acceptedSceneRevision') === 0 || own(record, 'registryRevision') === 0)) return invalid();
  return { snapshot: value as SceneSessionStateSnapshot, targets };
}
function changedIds(first: StateView, second: StateView): string[] {
  const result: string[] = [];
  for (const [id, value] of second.targets) if (!sameTarget(first.targets.get(id), value)) result.push(id);
  for (const id of first.targets.keys()) if (!second.targets.has(id)) result.push(id);
  return result;
}
function validateFrame(frame: unknown): asserts frame is SceneCompletedFrame {
  const record = data(frame, ['stamp', 'width', 'height', 'pixelRatio', 'padding', 'projectionTransition', 'cameraProfile']);
  finite(own(record, 'width'), 0); finite(own(record, 'height'), 0);
  if (finite(own(record, 'pixelRatio'), 0) === 0) return invalid();
  const framePadding = padding(own(record, 'padding'));
  const transition = finite(own(record, 'projectionTransition'), 0, 1);
  if (Math.fround(transition) !== transition) return invalid();
  const stampKeys = ['ownerToken', 'contextEpoch', 'styleRevision', 'samplingViewRevision', 'layoutRevision',
    'allocationRevision', 'acceptedSceneRevision', 'installedSceneRevision', 'placementRevision', 'paintRevision', 'paintFrameSerial'];
  const stamp = data(own(record, 'stamp'), stampKeys);
  const owner = own(stamp, 'ownerToken');
  if (owner === null || typeof owner !== 'object') return invalid();
  for (const key of stampKeys) if (key !== 'ownerToken') counter(own(stamp, key));
  const rawProfile = own(record, 'cameraProfile');
  if (rawProfile === undefined) return;
  const flags = ['explicitBounds', 'explicitZoomLimits', 'nativeBounds', 'terrain', 'canPan',
    'canObserveMotion', 'canStop', 'moving', 'hasProjection'];
  const profile = data(rawProfile, ['latitude', 'zoom', 'pitch', 'width', 'height', 'padding',
    'nativeControlTransition', 'nativeMinZoom', 'nativeMaxZoom', ...flags]);
  for (const flag of flags) if (typeof own(profile, flag) !== 'boolean') return invalid();
  finite(own(profile, 'latitude'), -90, 90);
  for (const key of ['zoom', 'pitch', 'nativeMinZoom', 'nativeMaxZoom']) finite(own(profile, key));
  finite(own(profile, 'nativeControlTransition'), 0, 1);
  if (own(profile, 'width') !== own(record, 'width') || own(profile, 'height') !== own(record, 'height') ||
      !samePadding(padding(own(profile, 'padding')), framePadding)) return invalid();
}
function matchesState(frame: SceneCompletedFrame, view: StateView): boolean {
  const allocation = view.snapshot.viewport;
  return allocation !== undefined && frame.stamp.acceptedSceneRevision === view.snapshot.acceptedSceneRevision &&
    frame.stamp.installedSceneRevision === view.snapshot.acceptedSceneRevision &&
    frame.stamp.allocationRevision === allocation.allocationRevision && frame.width === allocation.width &&
    frame.height === allocation.height && frame.pixelRatio === allocation.pixelRatio && samePadding(frame.padding, allocation.padding);
}
function copyProjection(value: unknown, revision: number): SceneTargetProjection {
  const record = data(value, ['acceptedPositionRevision', 'status', 'point', 'visible'], false);
  if (own(record, 'acceptedPositionRevision') !== revision || typeof own(record, 'visible') !== 'boolean') return invalid();
  const status = own(record, 'status');
  if (status !== 'resolved' && status !== 'terrain-pending' && status !== 'terrain-unavailable' &&
      status !== 'model-pending' && status !== 'visibility-pending' && status !== 'clipped' &&
      status !== 'occluded' && status !== 'unavailable') return invalid();
  const rawPoint = own(record, 'point');
  let point: readonly [number, number] | undefined;
  if (rawPoint !== undefined) {
    const values = array(rawPoint, 2, false);
    if (values.length !== 2) return invalid();
    point = Object.freeze([finite(values[0]), finite(values[1])]);
  }
  const visible = own(record, 'visible') as boolean;
  if (visible && (status !== 'resolved' || point === undefined)) return invalid();
  return Object.freeze({ acceptedPositionRevision: revision, status, visible, ...(point ? { point } : {}) });
}

/** Register only once per connection; an old unregister cannot erase a newer attachment. */
export function registerMapSceneSession(host: HTMLElement, attachment: MapSceneSessionAttachment): Release {
  attachments.set(host, attachment);
  return () => { if (attachments.get(host) === attachment) attachments.delete(host); };
}
export function mapSceneSessionAttachment(host: HTMLElement): MapSceneSessionAttachment | undefined {
  return attachments.get(host);
}

/** Stable accepted-state authority with independently replaceable completed-frame demand. */
export function createMapSceneSessionFacade(options: { readonly connection: object }): MapSceneSessionFacade {
  const { connection } = options;
  if (connection === null || typeof connection !== 'object') return invalid();
  let closed = false, running = false, querying = false, containing = false, unavailable = false;
  let backendCalls = 0, cleanupCalls = 0, notificationPasses = 0;
  let generation = 0, highestSerial = -1, greatestPositionRevision = 0;
  let state: StateBinding | undefined, wantedState: StateBinding | undefined;
  let installingState: StateBinding | undefined;
  let frameBinding: FrameBinding | undefined, wantedFrame: FrameBinding | undefined;
  let view = emptyView;
  let knownViewport: SceneViewportNotice | undefined;
  let statePending = false, watchesPending = false, requestPending = false;
  let notificationsBlocked = false;
  let pendingFrame: PendingFrame | undefined;
  const demands = new Map<string, number>();
  const targetObservers = new Set<TargetObserver>();
  const viewportObservers = new Set<ViewportObserver>();
  const frameObservers = new Set<FrameObserver>();
  const receipts = new WeakMap<SceneCompletedFrame, FrameBinding>();

  function backendCall<T>(callback: () => T): T {
    if (containing || backendCalls >= MAX_BACKEND_CALLS) throw budgetExceeded;
    backendCalls++;
    return callback();
  }
  function retire(release: Release): void {
    if (backendCalls < MAX_BACKEND_CALLS && !containing) backendCalls++;
    else {
      containing = true;
      cleanupCalls++;
      // Live handle cardinality is bounded independently of callback behavior.
      if (cleanupCalls > MAX_CLEANUP_CALLS) return invalid();
    }
    try { release(); } catch { /* Retire every independently owned handle. */ }
  }
  function live(binding: FrameBinding): boolean {
    return !closed && frameBinding === binding && binding.generation === generation && !containing;
  }
  function detachFrame(): void {
    const old = frameBinding;
    frameBinding = undefined;
    pendingFrame = undefined;
    if (!old) return;
    const releases = [...old.watches.values()]; old.watches.clear();
    if (old.release) { releases.push(old.release); old.release = undefined; }
    for (const release of releases) retire(release);
  }
  function containFrame(): void {
    containing = true; generation++;
    wantedFrame = undefined; pendingFrame = undefined;
    detachFrame();
  }
  function failFrame(binding: FrameBinding, error: unknown): void {
    if (error === budgetExceeded || containing || live(binding)) containFrame();
    else if (frameBinding === binding) detachFrame();
  }
  function readState(throwOnFailure = false): StateView | undefined {
    if (closed || !state) return emptyView;
    try {
      const captured = state.capture.call(state.state);
      if (captured === view.snapshot) { unavailable = false; return view; }
      const next = captureView(captured);
      if (next.snapshot.acceptedSceneRevision < view.snapshot.acceptedSceneRevision ||
          next.snapshot.registryRevision < view.snapshot.registryRevision) return invalid();
      const changed = changedIds(view, next);
      if (changed.length && (next.snapshot.acceptedSceneRevision === view.snapshot.acceptedSceneRevision ||
          next.snapshot.registryRevision === view.snapshot.registryRevision)) return invalid();
      let greatest = greatestPositionRevision;
      for (const [id, entry] of next.targets) {
        if (!eligible(entry)) continue;
        const previous = view.targets.get(id);
        if (sameTarget(previous, entry)) {
          if (previous !== entry) return invalid();
        } else if (entry.acceptedPositionRevision <= greatestPositionRevision) return invalid();
        greatest = Math.max(greatest, entry.acceptedPositionRevision);
      }
      const allocation = next.snapshot.viewport;
      if (allocation && knownViewport && (allocation.allocationRevision < knownViewport.allocationRevision ||
          (allocation.allocationRevision === knownViewport.allocationRevision && !sameViewport(allocation, knownViewport)))) return invalid();
      greatestPositionRevision = greatest;
      if (allocation) knownViewport = allocation;
      view = next; unavailable = false;
      return next;
    } catch {
      unavailable = true;
      if (throwOnFailure) return invalid();
      return undefined;
    }
  }
  function owned(frame: SceneCompletedFrame, target: SceneTargetFact): FrameBinding | undefined {
    const binding = receipts.get(frame);
    if (!binding || !binding.ready || !live(binding)) return undefined;
    const current = readState();
    if (!current || current.targets.get(target.id) !== target || !matchesState(frame, current)) return undefined;
    return binding;
  }
  function checkCurrent(frame: SceneCompletedFrame, target: SceneTargetFact): boolean {
    const binding = owned(frame, target);
    if (!binding) return false;
    const result = backendCall(() => binding.current.call(binding.backing, frame, target));
    return result === true && owned(frame, target) === binding;
  }
  function query<T>(fallback: T, callback: () => T): T {
    // A backend query cannot recursively acquire another native query on this connection.
    if (querying || containing) return fallback;
    if (!running) { backendCalls = 0; cleanupCalls = 0; notificationPasses = 0; }
    querying = true;
    try { return callback(); }
    catch (error) {
      if (error === budgetExceeded) run(containFrame);
      return fallback;
    } finally { querying = false; if (!running) containing = false; }
  }
  function queueFrame(binding: FrameBinding, frame: SceneCompletedFrame): void {
    if (!live(binding)) return;
    try {
      validateFrame(frame);
      const current = readState();
      if (!current || !matchesState(frame, current) || frame.stamp.paintFrameSerial <= highestSerial) return;
      const previousOwner = receipts.get(frame);
      if (previousOwner && previousOwner !== binding) return;
      if (pendingFrame && (!live(pendingFrame.binding) || !matchesState(pendingFrame.frame, current))) pendingFrame = undefined;
      if (!pendingFrame || frame.stamp.paintFrameSerial > pendingFrame.frame.stamp.paintFrameSerial) pendingFrame = { binding, frame };
      run();
    } catch { /* An invalid completion cannot gain receipt authority or advance its serial. */ }
  }
  function bindPendingState(): void {
    const next = wantedState; wantedState = undefined;
    if (!next || closed) return;
    if (state) { if (state.state === next.state) statePending = true; return; }
    let acquired: Release | undefined;
    installingState = next;
    try {
      acquired = backendCall(() => next.subscribe.call(next.state, () => {
        if (closed || (state !== next && installingState !== next)) return;
        if (!containing) notificationsBlocked = false;
        statePending = true; run();
      }));
      if (typeof acquired !== 'function') return invalid();
      if (closed || state || wantedState) { retire(acquired); return; }
      const initial = captureView(next.capture.call(next.state));
      state = next; next.release = acquired;
      // Validation is complete before binding gains authority. Notification baselines stay separate.
      view = initial;
      greatestPositionRevision = Math.max(0, ...[...initial.targets.values()].filter(eligible).map(entry => entry.acceptedPositionRevision));
      knownViewport = initial.snapshot.viewport; unavailable = false; statePending = true;
    } catch {
      if (typeof acquired === 'function') retire(acquired);
      if (state === next) state = undefined;
    } finally { if (installingState === next) installingState = undefined; }
  }
  function installFrame(): void {
    const next = wantedFrame; wantedFrame = undefined;
    if (!next || closed) return;
    detachFrame();
    if (closed || containing || wantedFrame || next.generation !== generation) return;
    frameBinding = next;
    let acquired: Release | undefined;
    try {
      acquired = backendCall(() => next.subscribe.call(next.backing, frame => queueFrame(next, frame)));
      if (typeof acquired !== 'function') return invalid();
      if (!live(next)) { retire(acquired); return; }
      next.release = acquired; watchesPending = true;
    } catch (error) {
      if (typeof acquired === 'function' && next.release !== acquired) retire(acquired);
      failFrame(next, error);
    }
  }
  function reconcileWatches(): void {
    const binding = frameBinding;
    if (!binding || !live(binding)) return;
    try {
      while (live(binding)) {
        const removed = [...binding.watches.keys()].find(id => !demands.has(id));
        if (removed !== undefined) {
          const release = binding.watches.get(removed)!; binding.watches.delete(removed); retire(release); continue;
        }
        const missing = [...demands.keys()].find(id => !binding.watches.has(id));
        if (missing === undefined) { binding.ready = true; watchesPending = false; return; }
        const release = backendCall(() => binding.watch.call(binding.backing, missing));
        if (typeof release !== 'function') return invalid();
        if (!live(binding) || !demands.has(missing)) retire(release);
        else binding.watches.set(missing, release);
      }
    } catch (error) { failFrame(binding, error); }
  }
  function deliverState(): void {
    statePending = false;
    const next = readState();
    if (!next || closed) return;
    const stillCurrent = (): boolean => {
      if (closed) return false;
      const actual = readState();
      if (actual !== next) { if (actual) statePending = true; return false; }
      return true;
    };
    for (const observer of [...targetObservers]) {
      if (!stillCurrent()) return;
      if (!targetObservers.has(observer)) continue;
      const changed = changedIds(observer.baseline, next); observer.baseline = next;
      if (!changed.length) continue;
      const notice = Object.freeze({ acceptedSceneRevision: next.snapshot.acceptedSceneRevision,
        registryRevision: next.snapshot.registryRevision, changedIds: Object.freeze(changed) });
      try { observer.listener(notice); } catch { /* An observer cannot revoke accepted state. */ }
    }
    for (const observer of [...viewportObservers]) {
      if (!stillCurrent()) return;
      if (!viewportObservers.has(observer)) continue;
      const allocation = next.snapshot.viewport;
      if (!allocation) continue;
      const changed = !sameViewport(observer.baseline, allocation); observer.baseline = allocation;
      if (changed) { try { observer.listener(allocation); } catch { /* Continue current independent observers. */ } }
    }
  }
  function deliverFrame(): void {
    const candidate = pendingFrame; pendingFrame = undefined;
    if (!candidate || !live(candidate.binding) || !candidate.binding.ready) return;
    const current = readState();
    if (!current || !matchesState(candidate.frame, current) || candidate.frame.stamp.paintFrameSerial <= highestSerial) return;
    highestSerial = candidate.frame.stamp.paintFrameSerial;
    receipts.set(candidate.frame, candidate.binding);
    for (const observer of [...frameObservers]) {
      const latest = readState();
      if (!live(candidate.binding) || !latest || !matchesState(candidate.frame, latest)) return;
      if (!frameObservers.has(observer)) continue;
      try { observer.listener(candidate.frame); } catch { /* Frame observers own no backend resources. */ }
    }
  }
  function run(action?: () => void): void {
    if (running) { action?.(); return; }
    running = true;
    if (!querying) { containing = false; backendCalls = 0; cleanupCalls = 0; notificationPasses = 0; }
    try {
      action?.();
      while (!closed) {
        if (containing && (frameBinding || wantedFrame)) containFrame();
        if (wantedState) { bindPendingState(); continue; }
        if (wantedFrame && !containing) { installFrame(); continue; }
        if (watchesPending && frameBinding && live(frameBinding)) { reconcileWatches(); continue; }
        if ((!notificationsBlocked && statePending) || (pendingFrame && frameBinding?.ready)) {
          if (notificationPasses >= MAX_NOTIFICATION_PASSES) {
            notificationsBlocked = true; containFrame(); break;
          }
          notificationPasses++;
          if (statePending && !notificationsBlocked) deliverState(); else deliverFrame();
          continue;
        }
        if (requestPending && frameBinding?.ready && live(frameBinding)) {
          const binding = frameBinding; requestPending = false;
          try { backendCall(() => binding.request.call(binding.backing)); }
          catch (error) { if (!closed) requestPending = true; failFrame(binding, error); }
          continue;
        }
        break;
      }
    } finally { running = false; if (!querying) containing = false; }
  }
  function close(): void {
    if (closed) return;
    run(() => {
      closed = true; generation++; wantedState = undefined; wantedFrame = undefined;
      statePending = false; requestPending = false; pendingFrame = undefined; demands.clear();
      targetObservers.clear(); viewportObservers.clear(); frameObservers.clear();
      const previous = state; state = undefined; view = emptyView;
      detachFrame();
      if (previous?.release) { const release = previous.release; previous.release = undefined; retire(release); }
    });
  }

  const attachment: MapSceneSessionAttachment = Object.freeze({
    target(id: string): SceneTargetLookup {
      const entry = readState(true)?.targets.get(id);
      if (!entry) return absent;
      return eligible(entry) ? Object.freeze({ status: 'accepted', target: entry }) :
        Object.freeze({ status: 'unsupported-kind', kind: entry.kind });
    },
    subscribeTargets(listener: (notice: SceneRegistryNotice) => void): Release {
      if (typeof listener !== 'function') return invalid();
      if (closed) return () => {};
      const observer = { listener, baseline: readState() ?? view };
      targetObservers.add(observer); return () => { targetObservers.delete(observer); };
    },
    subscribeViewport(listener: (notice: SceneViewportNotice) => void): Release {
      if (typeof listener !== 'function') return invalid();
      if (closed) return () => {};
      const observer = { listener, baseline: (readState() ?? view).snapshot.viewport };
      viewportObservers.add(observer); return () => { viewportObservers.delete(observer); };
    },
    subscribeCompletedFrames(listener: (frame: SceneCompletedFrame) => void): Release {
      if (typeof listener !== 'function') return invalid();
      if (closed) return () => {};
      const observer = { listener }; frameObservers.add(observer);
      return () => { frameObservers.delete(observer); };
    },
    watchTarget(value: string): Release {
      if (closed) return () => {};
      const id = identifier(value), count = demands.get(id) ?? 0;
      if ((!count && demands.size >= MAX_WATCHES) || !Number.isSafeInteger(count + 1)) return invalid();
      run(() => { demands.set(id, count + 1); watchesPending = true; });
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (closed) return;
        run(() => {
          const remaining = (demands.get(id) ?? 1) - 1;
          if (remaining === 0) demands.delete(id); else demands.set(id, remaining);
          watchesPending = true;
        });
      };
    },
    current(frame: SceneCompletedFrame, target: SceneTargetFact): boolean {
      return query(false, () => checkCurrent(frame, target));
    },
    projectTarget(frame: SceneCompletedFrame, id: string): SceneTargetProjection | undefined {
      return query<SceneTargetProjection | undefined>(undefined, () => {
        const target = readState()?.targets.get(id);
        if (!eligible(target) || !checkCurrent(frame, target)) return undefined;
        const binding = owned(frame, target);
        if (!binding) return undefined;
        const raw = backendCall(() => binding.project.call(binding.backing, frame, id));
        const result = copyProjection(raw, target.acceptedPositionRevision);
        return checkCurrent(frame, target) && owned(frame, target) === binding ? result : undefined;
      });
    },
    requestFrame(): void { if (!closed) run(() => { requestPending = true; }); },
  });
  return Object.freeze({ attachment, close,
    bindState(value: MapSceneSessionState): boolean {
      if (closed || (state && state.state !== value)) return false;
      try {
        if (own(value, 'connection') !== connection) return false;
        const capture = own(value, 'capture'), subscribe = own(value, 'subscribe');
        if (typeof capture !== 'function' || typeof subscribe !== 'function') return false;
        const nested = running;
        run(() => {
          if (state?.state === value) {
            if (!containing) notificationsBlocked = false;
            statePending = true;
          }
          else wantedState = { state: value, capture: capture as MapSceneSessionState['capture'],
            subscribe: subscribe as MapSceneSessionState['subscribe'] };
        });
        return nested || (!closed && state?.state === value && !unavailable);
      } catch { return false; }
    },
    promote(backing: MapSceneSessionBacking): boolean {
      if (closed || containing || !state) return false;
      try {
        if (own(backing, 'connection') !== connection || own(backing, 'state') !== state.state) return false;
        const subscribe = own(backing, 'subscribeCompletedFrames'), watch = own(backing, 'watchTarget');
        const request = own(backing, 'requestFrame'), project = own(backing, 'projectTarget'), current = own(backing, 'current');
        if ([subscribe, watch, request, project, current].some(method => typeof method !== 'function')) return false;
        const next: FrameBinding = { backing, generation: ++generation, ready: false, watches: new Map(),
          subscribe: subscribe as MapSceneSessionBacking['subscribeCompletedFrames'], watch: watch as MapSceneSessionBacking['watchTarget'],
          request: request as MapSceneSessionBacking['requestFrame'], project: project as MapSceneSessionBacking['projectTarget'],
          current: current as MapSceneSessionBacking['current'] };
        const nested = running;
        run(() => { wantedFrame = next; });
        return nested || (!closed && frameBinding === next && next.ready);
      } catch { return false; }
    },
  });
}
