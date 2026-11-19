import type { MapCameraFollowTarget, MapCameraFollowTargets } from './map-camera-follow-controller.js';
import type { MapSceneSessionState, SceneTargetEntry, SceneTargetLookup } from './map-scene-contract.js';

export function followTarget(lookup: SceneTargetLookup): MapCameraFollowTarget {
  if (lookup.status === 'absent') return Object.freeze({ kind: 'absent' });
  if (lookup.status === 'unsupported-kind') return Object.freeze({ kind: 'unsupported', objectKind: lookup.kind });
  const { target } = lookup;
  return Object.freeze({ kind: 'eligible', objectKind: target.kind, positionRevision: target.acceptedPositionRevision,
    center: Object.freeze([target.position.lngLat[0], target.position.lngLat[1]] as const),
    altitude: target.position.altitude, altitudeReference: target.position.altitudeReference });
}

/** A ground follow needs only its accepted target and changes to that target. */
export function createGroundFollowScene(source: MapSceneSessionState, objectId: string): MapCameraFollowTargets {
  let registryRevision = -1;
  let tracked: SceneTargetEntry | undefined;
  const read = (id: string) => {
    const snapshot = source.capture();
    if (id !== objectId) return snapshot.targets.find(target => target.id === id);
    if (snapshot.registryRevision !== registryRevision) {
      registryRevision = snapshot.registryRevision;
      tracked = snapshot.targets.find(target => target.id === id);
    }
    return tracked;
  };
  return {
    target(id) {
      const entry = read(id);
      if (!entry) return { kind: 'absent' };
      return 'position' in entry ? followTarget({ status: 'accepted', target: entry }) :
        { kind: 'unsupported', objectKind: entry.kind };
    },
    subscribeTargets(listener) {
      let previous = read(objectId);
      let allocation = source.capture().viewport?.allocationRevision;
      return source.subscribe(() => {
        const snapshot = source.capture();
        const next = read(objectId);
        if (previous !== next && !(previous && next && !('position' in previous) && previous.kind === next.kind)) {
          previous = next;
          listener({ kind: 'target', objectId });
        }
        if (snapshot !== source.capture() || !snapshot.viewport || snapshot.viewport.allocationRevision === allocation) return;
        allocation = snapshot.viewport.allocationRevision;
        listener({ kind: 'viewport', revision: allocation });
      });
    },
  };
}
