import type { MapCameraFollowFrame, MapCameraFollowNotice, MapCameraFollowScene, MapCameraFollowStamp,
  MapCameraFollowTarget } from './map-camera-follow-controller.js';
import type { MapSceneSessionAttachment, SceneCameraProfile, SceneCompletedFrame,
  SceneTargetFact, SceneTargetProjection } from './map-scene-contract.js';

interface ObservationReceipt {
  readonly frame: SceneCompletedFrame;
  readonly target: SceneTargetFact;
}

function once(release: () => void): () => void {
  let active = true;
  return () => { if (active) { active = false; release(); } };
}

function cameraProfile(profile: SceneCameraProfile | undefined): unknown {
  if (!profile) return undefined;
  return Object.freeze({ latitude: profile.latitude, zoom: profile.zoom, pitch: profile.pitch,
    width: profile.width, height: profile.height, projectionTransition: profile.nativeControlTransition,
    padding: Object.freeze({ top: profile.padding.top, bottom: profile.padding.bottom,
      left: profile.padding.left, right: profile.padding.right }),
    explicitBounds: profile.explicitBounds, explicitZoomLimits: profile.explicitZoomLimits,
    nativeBounds: profile.nativeBounds, nativeMinZoom: profile.nativeMinZoom, nativeMaxZoom: profile.nativeMaxZoom,
    terrain: profile.terrain, canPan: profile.canPan, canObserveMotion: profile.canObserveMotion,
    canStop: profile.canStop, moving: profile.moving, hasProjection: profile.hasProjection });
}

function projectionResult(projection: SceneTargetProjection | undefined, revision: number): MapCameraFollowFrame['result'] {
  if (!projection || projection.acceptedPositionRevision !== revision) return Object.freeze({ status: 'unavailable' });
  switch (projection.status) {
    case 'resolved': {
      const point = projection.point;
      if (projection.visible !== true || !Array.isArray(point) || point.length !== 2 ||
          !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return Object.freeze({ status: 'unavailable' });
      return Object.freeze({ status: 'visible', point: Object.freeze([point[0], point[1]] as const) });
    }
    case 'terrain-pending':
    case 'model-pending':
    case 'visibility-pending': return Object.freeze({ status: 'pending' });
    case 'clipped': return Object.freeze({ status: 'clipped' });
    case 'occluded': return Object.freeze({ status: 'occluded' });
    default: return Object.freeze({ status: 'unavailable' });
  }
}

/** Adapts one existing scene attachment without acquiring its connection, renderer or camera. */
export function createMapCameraFollowScene(attachment: MapSceneSessionAttachment): MapCameraFollowScene {
  const receipts = new WeakMap<MapCameraFollowStamp, ObservationReceipt>();
  return Object.freeze({
    target(objectId: string): MapCameraFollowTarget {
      const lookup = attachment.target(objectId);
      if (lookup.status === 'absent') return Object.freeze({ kind: 'absent' });
      if (lookup.status === 'unsupported-kind') return Object.freeze({ kind: 'unsupported', objectKind: lookup.kind });
      const { target } = lookup;
      return Object.freeze({ kind: 'eligible', objectKind: target.kind, positionRevision: target.acceptedPositionRevision,
        center: Object.freeze([target.position.lngLat[0], target.position.lngLat[1]] as const),
        altitude: target.position.altitude, altitudeReference: target.position.altitudeReference });
    },
    subscribeTargets(listener: (notice: MapCameraFollowNotice) => void): () => void {
      let active = true;
      const releases: (() => void)[] = [];
      const release = (): void => {
        if (!active) return;
        active = false;
        for (const stop of releases.splice(0)) {
          try { stop(); } catch { /* Retire each independently acquired observer. */ }
        }
      };
      try {
        releases.push(attachment.subscribeTargets(notice => {
          for (const objectId of notice.changedIds) {
            if (!active) return;
            // Each notice prompts a current target read; it carries no cached position.
            listener(Object.freeze({ kind: 'target', objectId }));
          }
        }));
        releases.push(attachment.subscribeViewport(notice => {
          if (active) listener(Object.freeze({ kind: 'viewport', revision: notice.allocationRevision }));
        }));
      } catch (error) { release(); throw error; }
      return release;
    },
    watchTarget(objectId: string): () => void { return once(attachment.watchTarget(objectId)); },
    subscribeFrames(objectId: string, listener: (frame: MapCameraFollowFrame) => void): () => void {
      let active = true;
      const stop = attachment.subscribeCompletedFrames(frame => {
        if (!active) return;
        const lookup = attachment.target(objectId);
        if (!active || lookup.status !== 'accepted') return;
        const target = lookup.target;
        if (!attachment.current(frame, target) || !active) return;
        const projected = attachment.projectTarget(frame, objectId);
        if (!active || !attachment.current(frame, target) || !active) return;
        const stamp: MapCameraFollowStamp = Object.freeze({ owner: frame.stamp.ownerToken,
          context: frame.stamp.contextEpoch, style: frame.stamp.styleRevision,
          view: frame.stamp.samplingViewRevision, position: target.acceptedPositionRevision,
          placement: frame.stamp.placementRevision });
        receipts.set(stamp, { frame, target });
        listener(Object.freeze({ serial: frame.stamp.paintFrameSerial, stamp,
          profile: cameraProfile(frame.cameraProfile), width: frame.width, height: frame.height,
          result: projectionResult(projected, target.acceptedPositionRevision) }));
      });
      return () => { if (active) { active = false; stop(); } };
    },
    current(stamp: MapCameraFollowStamp): boolean {
      const receipt = receipts.get(stamp);
      return receipt !== undefined && attachment.current(receipt.frame, receipt.target);
    },
    requestFrame(): void { attachment.requestFrame(); },
  });
}
