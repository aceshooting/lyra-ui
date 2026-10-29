import type {
  MapSceneSessionBacking, MapSceneSessionState, SceneCameraProfile, SceneCompletedFrame,
  SceneFrameStamp, SceneSessionStateSnapshot, SceneTargetEntry, SceneTargetFact,
  SceneTargetProjection, SceneViewportNotice,
} from '../src/internal/map-scene-contract.js';

export function sceneTarget(id = 'target', longitude = 0, revision = 1): SceneTargetFact {
  return Object.freeze({ id, kind: 'marker', acceptedPositionRevision: revision,
    position: Object.freeze({ lngLat: Object.freeze([longitude, 0] as const), altitude: 0, altitudeReference: 'sea-level' }) });
}

export function sceneViewport(revision = 1, width = 640): SceneViewportNotice {
  return Object.freeze({ allocationRevision: revision, width, height: 480, pixelRatio: 1,
    padding: Object.freeze({ top: 0, bottom: 0, left: 0, right: 0 }) });
}

/** Controlled owned state; capture deliberately executes no caller hook. */
export function sceneStateHarness() {
  const connection = Object.freeze({});
  const owner = Object.freeze({});
  const listeners = new Set<() => void>();
  let snapshot: SceneSessionStateSnapshot = Object.freeze({ acceptedSceneRevision: 0, registryRevision: 0,
    targets: Object.freeze([]), viewport: sceneViewport() });
  let subscriptions = 0, releases = 0, captures = 0;
  const hooks: { subscribe?: () => void; release?: () => void; captureError?: boolean } = {};
  const emit = () => { for (const listener of [...listeners]) listener(); };
  const state: MapSceneSessionState = Object.freeze({ connection,
    capture() { captures++; if (hooks.captureError) throw new Error('Capture unavailable'); return snapshot; },
    subscribe(listener: () => void) {
      listeners.add(listener); subscriptions++;
      let released = false;
      const release = () => {
        releases++;
        if (released) throw new Error('State handle released twice');
        released = true; listeners.delete(listener); hooks.release?.();
      };
      try { hooks.subscribe?.(); } catch (error) { release(); throw error; }
      return release;
    },
  });
  return { state, connection, owner, hooks, emit,
    set(targets: readonly SceneTargetEntry[], options: {
      acceptedSceneRevision?: number; registryRevision?: number; notify?: boolean;
    } = {}) {
      snapshot = Object.freeze({ ...snapshot, targets: Object.freeze([...targets]),
        acceptedSceneRevision: options.acceptedSceneRevision ?? snapshot.acceptedSceneRevision + 1,
        registryRevision: options.registryRevision ?? snapshot.registryRevision + 1 });
      if (options.notify !== false) emit();
    },
    viewport(viewport: SceneViewportNotice | undefined, notify = true) {
      snapshot = Object.freeze({ ...snapshot, viewport }); if (notify) emit();
    },
    get snapshot() { return snapshot; }, get subscriptions() { return subscriptions; },
    get releases() { return releases; }, get captures() { return captures; },
  };
}

/** Immutable synthetic completed facts test ownership only, not a renderer or depth algorithm. */
export function sceneBackingHarness(h: ReturnType<typeof sceneStateHarness>) {
  const listeners = new Set<(frame: SceneCompletedFrame) => void>();
  const listenerHistory: ((frame: SceneCompletedFrame) => void)[] = [];
  const activeWatches = new Map<string, number>();
  const acquired: string[] = [], retired: string[] = [];
  const currentArguments: { frame: SceneCompletedFrame; target: SceneTargetFact }[] = [];
  const projectArguments: { frame: SceneCompletedFrame; id: string }[] = [];
  let subscriptions = 0, releases = 0, requests = 0, projects = 0, currentCalls = 0;
  const hooks: {
    subscribe?: () => void; watch?: (id: string) => void; request?: () => void;
    release?: () => void; project?: () => void; current?: () => void;
  } = {};
  let isCurrent = true;
  let projection: SceneTargetProjection | undefined;
  const backing: MapSceneSessionBacking = Object.freeze({ connection: h.connection, state: h.state,
    subscribeCompletedFrames(listener: (frame: SceneCompletedFrame) => void) {
      listeners.add(listener); listenerHistory.push(listener); subscriptions++;
      let released = false;
      const release = () => {
        releases++;
        if (released) throw new Error('Frame handle released twice');
        released = true; listeners.delete(listener); hooks.release?.();
      };
      try { hooks.subscribe?.(); } catch (error) { release(); throw error; }
      return release;
    },
    watchTarget(id: string) {
      acquired.push(id); activeWatches.set(id, (activeWatches.get(id) ?? 0) + 1);
      let released = false;
      const release = () => {
        retired.push(id);
        if (released) throw new Error('Watch handle released twice');
        released = true;
        const remaining = (activeWatches.get(id) ?? 1) - 1;
        if (remaining === 0) activeWatches.delete(id); else activeWatches.set(id, remaining);
        hooks.release?.();
      };
      try { hooks.watch?.(id); } catch (error) { release(); throw error; }
      return release;
    },
    requestFrame() { requests++; hooks.request?.(); },
    projectTarget(frame: SceneCompletedFrame, id: string): SceneTargetProjection | undefined {
      projects++; projectArguments.push({ frame, id }); hooks.project?.();
      if (projection) return projection;
      const target = h.snapshot.targets.find(entry => entry.id === id);
      if (!target || (target.kind !== 'marker' && target.kind !== 'model')) return undefined;
      return Object.freeze({ acceptedPositionRevision: target.acceptedPositionRevision, status: 'resolved',
        point: Object.freeze([20, 30] as const), visible: true });
    },
    current(frame: SceneCompletedFrame, target: SceneTargetFact) {
      currentCalls++; currentArguments.push({ frame, target }); hooks.current?.(); return isCurrent;
    },
  });
  return { backing, hooks, activeWatches, acquired, retired, listenerHistory, currentArguments, projectArguments,
    emit(frame: SceneCompletedFrame) { for (const listener of [...listeners]) listener(frame); },
    frame(serial: number, changes: Partial<SceneCompletedFrame> = {}, stampChanges: Partial<SceneFrameStamp> = {}): SceneCompletedFrame {
      const viewport = h.snapshot.viewport ?? sceneViewport();
      const profile: SceneCameraProfile = Object.freeze({ latitude: 0, zoom: 8, pitch: 0,
        width: viewport.width, height: viewport.height, padding: viewport.padding, nativeControlTransition: 0,
        explicitBounds: false, explicitZoomLimits: false, nativeBounds: false,
        nativeMinZoom: -2, nativeMaxZoom: 22, terrain: false, canPan: true, canObserveMotion: true,
        canStop: true, moving: false, hasProjection: true });
      return Object.freeze({ width: viewport.width, height: viewport.height, pixelRatio: viewport.pixelRatio,
        padding: viewport.padding, projectionTransition: 0, cameraProfile: profile, ...changes,
        stamp: Object.freeze({ ownerToken: h.owner, contextEpoch: 1, styleRevision: 1, samplingViewRevision: 1,
          layoutRevision: 1, allocationRevision: viewport.allocationRevision,
          acceptedSceneRevision: h.snapshot.acceptedSceneRevision, installedSceneRevision: h.snapshot.acceptedSceneRevision,
          placementRevision: 1, paintRevision: 1, paintFrameSerial: serial, ...stampChanges }) });
    },
    setCurrent(value: boolean) { isCurrent = value; },
    setProjection(value: SceneTargetProjection | undefined) { projection = value; },
    get subscriptions() { return subscriptions; }, get releases() { return releases; },
    get requests() { return requests; }, get projects() { return projects; }, get currentCalls() { return currentCalls; },
  };
}
