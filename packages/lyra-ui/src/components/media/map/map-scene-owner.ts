import type { MapSceneSessionState, SceneSessionStateSnapshot } from '../../../internal/map-scene-contract.js';
import { resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { stageMapSceneAdmission } from './map-scene-admission.js';
import type { AdmittedSceneObject, SceneAdmissionCandidate } from './map-scene-admission.js';
import { createMapSceneAdmissionError, mapSceneAdmissionErrorCode } from './map-scene-errors.js';
import { createMapScenePositionRegistry } from './map-scene-position-registry.js';
import { createMapSceneSourceOwner, isStaleMapSceneSourceError } from './map-scene-source-snapshot.js';
import type { SceneRequest } from './map-scene-source-snapshot.js';

export interface SceneAcceptedSnapshot {
  readonly acceptedSceneRevision: number;
  readonly objects: readonly AdmittedSceneObject[];
}
export interface SceneOwnerView {
  readonly active: boolean;
  readonly accepted: SceneAcceptedSnapshot;
  readonly status: Readonly<{ revision: number; state: 'empty' | 'unavailable' | 'error';
    code?: 'invalid' | 'limit' | 'engine' }> | undefined;
}
interface Observer<T> { readonly listener: () => void; baseline: T }

const MAX_ENCODED_BYTES = 64 * 1024 * 1024;
const MAX_NOTIFICATION_PASSES = 6144;

/** Owns accepted descriptors and geographic state independently from native rendering. */
export function createMapSceneOwner(options: {
  readonly element: Element;
  readonly connection: object;
  readonly isCurrentConnection: () => boolean;
  readonly changed: () => void;
}): {
  readonly state: MapSceneSessionState;
  assign(value: unknown): void;
  captureAccepted(): SceneAcceptedSnapshot;
  captureView(): SceneOwnerView;
  subscribeAccepted(listener: () => void): () => void;
  close(): void;
} {
  const { element, connection } = options;
  let closed = false, notifying = false;
  let requestRevision = 0, liveBytes = 0;
  let accepted: SceneAcceptedSnapshot = Object.freeze({ acceptedSceneRevision: 0, objects: Object.freeze([]) });
  let view: SceneOwnerView = Object.freeze({ active: false, accepted, status: undefined });
  let changedBaseline = view;
  const acceptedObservers = new Set<Observer<SceneAcceptedSnapshot>>();
  const stateObservers = new Set<Observer<SceneSessionStateSnapshot>>();

  function current(request: SceneRequest): boolean {
    if (closed || request.connection !== connection || request.revision !== requestRevision) return false;
    const result = options.isCurrentConnection();
    return result && !closed && request.connection === connection && request.revision === requestRevision;
  }

  let resources: ReturnType<typeof createResources> | undefined;
  let stateSnapshot: SceneSessionStateSnapshot = Object.freeze({ acceptedSceneRevision: 0,
    registryRevision: 0, targets: Object.freeze([]), viewport: undefined });

  function createResources() {
    const sources = createMapSceneSourceOwner({ connection, maxEncodedBytes: MAX_ENCODED_BYTES,
      isCurrent: current,
      reserveBytes(byteLength) {
        if (!Number.isSafeInteger(byteLength) || byteLength < 0) throw createMapSceneAdmissionError('invalid');
        if (byteLength > MAX_ENCODED_BYTES - liveBytes) throw createMapSceneAdmissionError('limit');
        liveBytes += byteLength;
        let released = false;
        return Object.freeze({ release() {
          if (released) return;
          released = true;
          liveBytes -= byteLength;
        } });
      },
      resolveUrl(source) {
        const target = resolveOwnerFetchTarget(element, source);
        return target ? Object.freeze({ url: target.url, owner: target.view }) : null;
      },
    });
    const registry = createMapScenePositionRegistry({ connection, sources, isCurrent: current });
    return { sources, registry };
  }

  function subscribe<T>(observers: Set<Observer<T>>, listener: () => void, baseline: T): () => void {
    if (typeof listener !== 'function') throw new TypeError('Invalid map scene listener');
    if (closed) return () => {};
    const observer = { listener, baseline };
    observers.add(observer);
    return () => { observers.delete(observer); };
  }
  const state: MapSceneSessionState = Object.freeze({ connection,
    capture: () => stateSnapshot,
    subscribe: (listener: () => void) => subscribe(stateObservers, listener, stateSnapshot),
  });

  function invoke(callback: () => void): void {
    try { callback(); } catch { /* Observer failures cannot roll back accepted intent. */ }
  }

  function notify(): void {
    if (closed || notifying) return;
    notifying = true;
    try {
      for (let pass = 0; pass < MAX_NOTIFICATION_PASSES && !closed; pass++) {
        let delivered = false;
        for (const observer of [...stateObservers]) {
          if (closed) return;
          if (!stateObservers.has(observer) || observer.baseline === stateSnapshot) continue;
          observer.baseline = stateSnapshot; delivered = true;
          invoke(observer.listener);
        }
        for (const observer of [...acceptedObservers]) {
          if (closed) return;
          if (!acceptedObservers.has(observer) || observer.baseline === accepted) continue;
          observer.baseline = accepted; delivered = true;
          invoke(observer.listener);
        }
        if (closed) return;
        if (changedBaseline !== view) {
          changedBaseline = view; delivered = true;
          invoke(options.changed);
        }
        if (!delivered) return;
      }
    } finally { notifying = false; }
  }

  function publish(active: boolean, status: SceneOwnerView['status']): void {
    view = Object.freeze({ active, accepted, status });
    notify();
  }

  return Object.freeze({ state,
    captureAccepted: () => accepted,
    captureView: () => view,
    subscribeAccepted: (listener: () => void) => subscribe(acceptedObservers, listener, accepted),
    assign(value: unknown): void {
      if (closed) return;
      const before = requestRevision;
      if (!options.isCurrentConnection() || closed || before !== requestRevision) return;
      if (value === undefined && !view.active && accepted.acceptedSceneRevision === 0) return;
      if (!Number.isSafeInteger(requestRevision + 1)) return;
      const request = Object.freeze({ connection, revision: ++requestRevision });
      let candidate: SceneAdmissionCandidate | undefined;
      try {
        const { sources, registry } = resources ??= createResources();
        if (value === undefined) {
          if (!registry.clear(request)) return;
          accepted = Object.freeze({ acceptedSceneRevision: registry.acceptedSceneRevision, objects: Object.freeze([]) });
          stateSnapshot = Object.freeze({ ...registry.capture(), viewport: undefined });
          publish(false, Object.freeze({ revision: accepted.acceptedSceneRevision, state: 'empty' }));
          return;
        }
        candidate = stageMapSceneAdmission(value, { request, sources });
        if (!registry.commit(candidate)) return;
        accepted = Object.freeze({ acceptedSceneRevision: registry.acceptedSceneRevision, objects: candidate.objects });
        stateSnapshot = Object.freeze({ ...registry.capture(), viewport: undefined });
        publish(true, accepted.objects.length === 0 ?
          Object.freeze({ revision: accepted.acceptedSceneRevision, state: 'empty' }) :
          Object.freeze({ revision: accepted.acceptedSceneRevision, state: 'unavailable', code: 'engine' }));
      } catch (error) {
        candidate?.dispose();
        if (!current(request) || isStaleMapSceneSourceError(error)) return;
        publish(true, Object.freeze({ revision: accepted.acceptedSceneRevision, state: 'error',
          code: mapSceneAdmissionErrorCode(error) ?? 'invalid' }));
      }
    },
    close(): void {
      if (closed) return;
      closed = true;
      acceptedObservers.clear(); stateObservers.clear();
      resources?.registry.dispose(); resources?.sources.dispose();
      resources = undefined;
    },
  });
}
