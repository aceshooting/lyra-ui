import type { MapSceneSessionState, SceneSessionStateSnapshot } from '../../../internal/map-scene-contract.js';
import { resolveOwnerFetchTarget } from '../../../internal/resource-loader.js';
import { stageMapSceneAdmission } from './map-scene-admission.js';
import type { AdmittedSceneObject, SceneAdmissionCandidate } from './map-scene-admission.js';
import { createMapSceneAdmissionError, mapSceneAdmissionErrorCode } from './map-scene-errors.js';
import { createMapScenePositionRegistry } from './map-scene-position-registry.js';
import { buildSceneRenderInput, emptySceneRenderInput, nextSceneRenderRevision,
  snapshotScenePresentation, snapshotSceneViewport } from './map-scene-render-input.js';
import type { SceneAcceptedSnapshot, SceneRenderPublication, SceneResolvedPresentation, SceneViewportInput } from './map-scene-render-contract.js';
import { createMapSceneSourceOwner, isStaleMapSceneSourceError } from './map-scene-source-snapshot.js';
import type { SceneRequest } from './map-scene-source-snapshot.js';

export type { SceneAcceptedSnapshot } from './map-scene-render-contract.js';
export interface SceneOwnerView {
  readonly active: boolean;
  readonly accepted: SceneAcceptedSnapshot;
  readonly status: Readonly<{ revision: number; state: 'empty' | 'unavailable' | 'error';
    code?: 'invalid' | 'limit' | 'engine' }> | undefined;
}
interface Observer<T> { readonly listener: () => void; baseline: T }

const MAX_ENCODED_BYTES = 64 * 1024 * 1024;
const MAX_NOTIFICATION_PASSES = 6144;

/** Advances the connection's issue serial without wrapping or coercing invalid counters. */
export function nextPaintFrameSerial(previous: number): number | undefined {
  return Number.isSafeInteger(previous) && previous >= 0 && previous < Number.MAX_SAFE_INTEGER ? previous + 1 : undefined;
}

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
  captureRenderPublication(): SceneRenderPublication;
  claimPaintFrameSerial(expected: SceneRenderPublication): number | undefined;
  subscribeRenderPublication(listener: () => void): () => void;
  invalidatePresentation(): boolean;
  commitPresentation(expected: SceneRenderPublication, value: SceneResolvedPresentation): boolean;
  failPresentation(expected: SceneRenderPublication): boolean;
  setViewport(value: SceneViewportInput | undefined): boolean;
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
  const renderObservers = new Set<Observer<SceneRenderPublication>>();

  function current(request: SceneRequest): boolean {
    if (closed || request.connection !== connection || request.revision !== requestRevision) return false;
    const result = options.isCurrentConnection();
    return result && !closed && request.connection === connection && request.revision === requestRevision &&
      nextSceneRenderRevision(renderPublication.input.presentationRevision) !== undefined;
  }

  let resources: ReturnType<typeof createResources> | undefined;
  let stateSnapshot: SceneSessionStateSnapshot = Object.freeze({ acceptedSceneRevision: 0,
    registryRevision: 0, targets: Object.freeze([]), viewport: undefined });
  let allocationRevision = 0;
  let paintFrameSerial = 0;
  let resolvedPresentation: SceneResolvedPresentation | undefined;
  let renderPublication: SceneRenderPublication = Object.freeze({ accepted, state: stateSnapshot, phase: 'resolved',
    input: emptySceneRenderInput(0, 1, undefined) });

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
        for (const observer of [...renderObservers]) {
          if (closed) return;
          if (!renderObservers.has(observer) || observer.baseline === renderPublication) continue;
          observer.baseline = renderPublication; delivered = true;
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

  function currentPublication(expected: SceneRenderPublication): boolean {
    if (closed || renderPublication !== expected) return false;
    try {
      const result = options.isCurrentConnection();
      return result && !closed && renderPublication === expected;
    } catch { return false; }
  }

  function commitRender(expected: SceneRenderPublication, next: SceneRenderPublication,
    presentation: SceneResolvedPresentation | undefined, nextAllocation: number): boolean {
    // Reflection and composition finished before this final callback and identity check.
    if (!currentPublication(expected)) return false;
    stateSnapshot = next.state;
    renderPublication = next;
    resolvedPresentation = presentation;
    allocationRevision = nextAllocation;
    notify();
    return true;
  }

  function publishAccepted(objects: readonly AdmittedSceneObject[], active: boolean): void {
    const snapshot = resources!.registry.capture();
    const nextAccepted = Object.freeze({ acceptedSceneRevision: snapshot.acceptedSceneRevision, objects });
    const nextState = Object.freeze({ ...snapshot, viewport: stateSnapshot.viewport });
    // The registry's final current check reserved counter space; its private transfer invokes no observers.
    const revision = nextSceneRenderRevision(renderPublication.input.presentationRevision)!;
    const next: SceneRenderPublication = Object.freeze({ accepted: nextAccepted, state: nextState,
      phase: objects.some(object => object.kind === 'marker') ? 'pending' : 'resolved',
      input: emptySceneRenderInput(nextAccepted.acceptedSceneRevision, revision, nextState.viewport) });
    accepted = nextAccepted;
    stateSnapshot = nextState;
    renderPublication = next;
    resolvedPresentation = undefined;
    publish(active, objects.length === 0 ?
      Object.freeze({ revision: accepted.acceptedSceneRevision, state: 'empty' }) :
      Object.freeze({ revision: accepted.acceptedSceneRevision, state: 'unavailable', code: 'engine' }));
  }

  function sameViewport(first: SceneViewportInput | undefined, second: SceneViewportInput | undefined): boolean {
    return first === undefined ? second === undefined : second !== undefined && first.width === second.width &&
      first.height === second.height && first.pixelRatio === second.pixelRatio &&
      first.padding.top === second.padding.top && first.padding.right === second.padding.right &&
      first.padding.bottom === second.padding.bottom && first.padding.left === second.padding.left;
  }

  return Object.freeze({ state,
    captureAccepted: () => accepted,
    captureView: () => view,
    subscribeAccepted: (listener: () => void) => subscribe(acceptedObservers, listener, accepted),
    captureRenderPublication: () => renderPublication,
    claimPaintFrameSerial(expected: SceneRenderPublication): number | undefined {
      if (expected !== renderPublication || expected.phase !== 'resolved' || !currentPublication(expected)) return undefined;
      const next = nextPaintFrameSerial(paintFrameSerial);
      if (next !== undefined) paintFrameSerial = next;
      return next;
    },
    subscribeRenderPublication: (listener: () => void) => subscribe(renderObservers, listener, renderPublication),
    invalidatePresentation(): boolean {
      const expected = renderPublication;
      if (closed || !accepted.objects.some(object => object.kind === 'marker')) return false;
      const revision = nextSceneRenderRevision(expected.input.presentationRevision);
      if (revision === undefined) return false;
      const next: SceneRenderPublication = Object.freeze({ ...expected, phase: 'pending',
        input: emptySceneRenderInput(accepted.acceptedSceneRevision, revision, expected.state.viewport) });
      return commitRender(expected, next, undefined, allocationRevision);
    },
    commitPresentation(expected: SceneRenderPublication, value: SceneResolvedPresentation): boolean {
      if (closed || renderPublication !== expected || expected.phase !== 'pending') return false;
      const presentation = snapshotScenePresentation(value);
      if (!presentation) return false;
      const revision = nextSceneRenderRevision(expected.input.presentationRevision);
      if (revision === undefined) return false;
      const input = buildSceneRenderInput({ accepted: expected.accepted, state: expected.state,
        phase: 'resolved', presentationRevision: revision, presentation });
      if (!input) return false;
      const next: SceneRenderPublication = Object.freeze({ ...expected, phase: 'resolved', input });
      return commitRender(expected, next, presentation, allocationRevision);
    },
    failPresentation(expected: SceneRenderPublication): boolean {
      if (closed || renderPublication !== expected || expected.phase !== 'pending') return false;
      const revision = nextSceneRenderRevision(expected.input.presentationRevision);
      if (revision === undefined) return false;
      const next: SceneRenderPublication = Object.freeze({ ...expected, phase: 'unavailable',
        input: emptySceneRenderInput(accepted.acceptedSceneRevision, revision, expected.state.viewport) });
      return commitRender(expected, next, undefined, allocationRevision);
    },
    setViewport(value: SceneViewportInput | undefined): boolean {
      const expected = renderPublication;
      if (closed) return false;
      const copied = value === undefined ? undefined : snapshotSceneViewport(value);
      if (value !== undefined && !copied) return false;
      if (sameViewport(expected.state.viewport, copied)) return false;
      const revision = nextSceneRenderRevision(expected.input.presentationRevision);
      const nextAllocation = copied === undefined ? allocationRevision : nextSceneRenderRevision(allocationRevision);
      if (revision === undefined || nextAllocation === undefined) return false;
      const viewport = copied === undefined ? undefined : Object.freeze({ ...copied, allocationRevision: nextAllocation });
      const nextState = Object.freeze({ ...expected.state, viewport });
      const input = expected.phase === 'resolved' && resolvedPresentation !== undefined ?
        buildSceneRenderInput({ accepted: expected.accepted, state: nextState, phase: 'resolved',
          presentationRevision: revision, presentation: resolvedPresentation }) :
        emptySceneRenderInput(expected.accepted.acceptedSceneRevision, revision, viewport);
      if (!input) return false;
      const next = Object.freeze({ ...expected, state: nextState, input });
      return commitRender(expected, next, resolvedPresentation, nextAllocation);
    },
    assign(value: unknown): void {
      if (closed) return;
      const before = requestRevision;
      if (!options.isCurrentConnection() || closed || before !== requestRevision) return;
      if (value === undefined && !view.active && accepted.acceptedSceneRevision === 0) return;
      if (nextSceneRenderRevision(renderPublication.input.presentationRevision) === undefined) return;
      if (!Number.isSafeInteger(requestRevision + 1)) return;
      const request = Object.freeze({ connection, revision: ++requestRevision });
      let candidate: SceneAdmissionCandidate | undefined;
      try {
        const { sources, registry } = resources ??= createResources();
        if (value === undefined) {
          if (!registry.clear(request)) return;
          publishAccepted(Object.freeze([]), false);
          return;
        }
        candidate = stageMapSceneAdmission(value, { request, sources });
        if (!registry.commit(candidate)) return;
        publishAccepted(candidate.objects, true);
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
      acceptedObservers.clear(); stateObservers.clear(); renderObservers.clear();
      resolvedPresentation = undefined;
      resources?.registry.dispose(); resources?.sources.dispose();
      resources = undefined;
    },
  });
}
