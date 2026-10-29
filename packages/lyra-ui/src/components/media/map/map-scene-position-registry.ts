import type {
  CanonicalScenePosition,
  SceneRegistryNotice,
  SceneTargetEntry,
  SceneTargetLookup as ScenePositionLookup,
  SceneTargetSnapshot,
} from '../../../internal/map-scene-contract.js';
import { consumeMapSceneAdmission, snapshotMapSceneRequest } from './map-scene-admission.js';
import type { AdmittedSceneObject, SceneAdmissionCandidate } from './map-scene-admission.js';
import { isStaleMapSceneSourceError } from './map-scene-source-snapshot.js';
import type { SceneRequest, SceneSourceLease, SceneSourceOwner } from './map-scene-source-snapshot.js';

export type {
  SceneTargetFact as ScenePositionFact,
  SceneTargetLookup as ScenePositionLookup,
  SceneRegistryNotice,
} from '../../../internal/map-scene-contract.js';

export interface ScenePositionRegistry {
  readonly acceptedSceneRevision: number;
  target(id: string): ScenePositionLookup;
  capture(): SceneTargetSnapshot;
  commit(candidate: SceneAdmissionCandidate): boolean;
  clear(request: SceneRequest): boolean;
  subscribe(listener: (notice: SceneRegistryNotice) => void): () => void;
  dispose(): void;
}

const absent: ScenePositionLookup = Object.freeze({ status: 'absent' });

function targetSnapshot(
  facts: ReadonlyMap<string, ScenePositionLookup>,
  acceptedSceneRevision: number,
  registryRevision: number,
): SceneTargetSnapshot {
  const targets: SceneTargetEntry[] = [];
  for (const [id, lookup] of facts) {
    if (lookup.status === 'accepted') targets.push(lookup.target);
    else if (lookup.status === 'unsupported-kind') targets.push(Object.freeze({ id, kind: lookup.kind }));
  }
  return Object.freeze({ acceptedSceneRevision, registryRevision, targets: Object.freeze(targets) });
}

function samePosition(first: CanonicalScenePosition, second: CanonicalScenePosition): boolean {
  return first.lngLat[0] === second.lngLat[0] && first.lngLat[1] === second.lngLat[1] &&
    first.altitude === second.altitude && first.altitudeReference === second.altitudeReference;
}

function sameFact(previous: ScenePositionLookup | undefined, object: AdmittedSceneObject): boolean {
  if (!previous || previous.status === 'absent') return false;
  if (object.kind === 'path' || object.kind === 'arc') {
    return previous.status === 'unsupported-kind' && previous.kind === object.kind;
  }
  return previous.status === 'accepted' && previous.target.kind === object.kind &&
    samePosition(previous.target.position, object.position);
}

function release(leases: readonly SceneSourceLease[]): void {
  for (const lease of leases) {
    try { lease.release(); } catch { /* Continue retiring independently owned references. */ }
  }
}

/** Accepted geographic intent, independent from model preparation and installed rendering. */
export function createMapScenePositionRegistry(options: {
  readonly connection: object;
  readonly sources: SceneSourceOwner;
  /** Trusted authoritative result, reflecting any synchronous reentry before returning. */
  readonly isCurrent: (request: SceneRequest) => boolean;
}): ScenePositionRegistry {
  const { connection, sources, isCurrent } = options;
  let closed = false;
  let generation = 0;
  let acceptedSceneRevision = 0;
  let registryRevision = 0;
  let positionRevision = 0;
  let requestRevision = 0;
  let facts = new Map<string, ScenePositionLookup>();
  let snapshot = targetSnapshot(facts, acceptedSceneRevision, registryRevision);
  let acceptedSources: readonly SceneSourceLease[] = [];
  const listeners = new Set<(notice: SceneRegistryNotice) => void>();

  function current(request: SceneRequest, expectedGeneration: number): boolean {
    if (closed || request.connection !== connection || request.revision <= requestRevision) return false;
    const result = isCurrent(request);
    return result && !closed && expectedGeneration === generation && request.revision > requestRevision;
  }

  function notify(changedIds: readonly string[], expectedGeneration: number): void {
    if (changedIds.length === 0 || closed || generation !== expectedGeneration) return;
    const notice: SceneRegistryNotice = Object.freeze({ acceptedSceneRevision, registryRevision,
      changedIds: Object.freeze([...changedIds]) });
    for (const listener of [...listeners]) {
      if (closed || generation !== expectedGeneration) return;
      if (!listeners.has(listener)) continue;
      try { listener(notice); } catch { /* An observer cannot roll back accepted intent. */ }
    }
  }

  function nextCounter(value: number): number {
    if (!Number.isSafeInteger(value + 1)) throw new TypeError('Map scene revision exhausted');
    return value + 1;
  }

  return Object.freeze({
    get acceptedSceneRevision() { return acceptedSceneRevision; },
    target(id: string): ScenePositionLookup { return facts.get(id) ?? absent; },
    capture(): SceneTargetSnapshot { return snapshot; },
    commit(candidate: SceneAdmissionCandidate): boolean {
      consumeMapSceneAdmission(candidate, sources, connection);
      const before = generation;
      try {
        if (!current(candidate.request, before)) { candidate.dispose(); return false; }

        const next = new Map<string, ScenePositionLookup>();
        const changed: string[] = [];
        let nextPositionRevision = positionRevision;
        for (const object of candidate.objects) {
          const previous = facts.get(object.id);
          if (sameFact(previous, object)) {
            next.set(object.id, previous!);
            continue;
          }
          changed.push(object.id);
          nextPositionRevision = nextCounter(nextPositionRevision);
          if (object.kind === 'path' || object.kind === 'arc') {
            next.set(object.id, Object.freeze({ status: 'unsupported-kind', kind: object.kind }));
          } else {
            next.set(object.id, Object.freeze({ status: 'accepted', target: Object.freeze({ id: object.id,
              kind: object.kind, position: object.position, acceptedPositionRevision: nextPositionRevision }) }));
          }
        }
        for (const id of facts.keys()) {
          if (next.has(id)) continue;
          changed.push(id);
          nextPositionRevision = nextCounter(nextPositionRevision);
        }
        const nextSceneRevision = nextCounter(acceptedSceneRevision);
        const nextRegistryRevision = changed.length > 0 ? nextCounter(registryRevision) : registryRevision;
        const nextSnapshot = targetSnapshot(next, nextSceneRevision, nextRegistryRevision);

        // Publication may validate currency through the trusted source owner. Its ownership
        // transfer and the following fact swap contain no application callback.
        const published = sources.publish(candidate.sourceStage);
        if (closed || generation !== before) { release(published); candidate.dispose(); return false; }
        const retired = acceptedSources;
        acceptedSources = published;
        facts = next;
        snapshot = nextSnapshot;
        acceptedSceneRevision = nextSceneRevision;
        registryRevision = nextRegistryRevision;
        positionRevision = nextPositionRevision;
        requestRevision = candidate.request.revision;
        const committedGeneration = ++generation;
        release(retired);
        notify(changed, committedGeneration);
        return true;
      } catch (error) {
        candidate.dispose();
        if (closed || generation !== before || isStaleMapSceneSourceError(error)) return false;
        throw new TypeError('Invalid map scene commit');
      }
    },
    clear(value: SceneRequest): boolean {
      const request = snapshotMapSceneRequest(value);
      const before = generation;
      if (!current(request, before)) return false;
      const changed = [...facts.keys()];
      const nextSceneRevision = nextCounter(acceptedSceneRevision);
      const nextRegistryRevision = changed.length > 0 ? nextCounter(registryRevision) : registryRevision;
      let nextPositionRevision = positionRevision;
      for (let index = 0; index < changed.length; index++) nextPositionRevision = nextCounter(nextPositionRevision);
      const next = new Map<string, ScenePositionLookup>();
      const nextSnapshot = targetSnapshot(next, nextSceneRevision, nextRegistryRevision);

      sources.sealCurrent();
      const retired = acceptedSources;
      acceptedSources = [];
      facts = next;
      snapshot = nextSnapshot;
      acceptedSceneRevision = nextSceneRevision;
      registryRevision = nextRegistryRevision;
      positionRevision = nextPositionRevision;
      requestRevision = request.revision;
      const committedGeneration = ++generation;
      release(retired);
      notify(changed, committedGeneration);
      return true;
    },
    subscribe(listener: (notice: SceneRegistryNotice) => void): () => void {
      if (typeof listener !== 'function') throw new TypeError('Invalid map scene listener');
      if (closed) return () => {};
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose(): void {
      if (closed) return;
      const next = new Map<string, ScenePositionLookup>();
      const nextSnapshot = targetSnapshot(next, acceptedSceneRevision, registryRevision);
      closed = true;
      generation++;
      facts = next;
      snapshot = nextSnapshot;
      listeners.clear();
      sources.sealCurrent();
      const retired = acceptedSources;
      acceptedSources = [];
      release(retired);
    },
  });
}
