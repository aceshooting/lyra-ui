/** Owned authored geography, independent from terrain or asset preparation. */
export interface CanonicalScenePosition {
  readonly lngLat: readonly [number, number];
  readonly altitude: number;
  readonly altitudeReference: 'sea-level' | 'terrain';
}
export interface SceneTargetFact {
  readonly id: string;
  readonly kind: 'marker' | 'model';
  readonly position: CanonicalScenePosition;
  readonly acceptedPositionRevision: number;
}
export type SceneTargetLookup =
  | { readonly status: 'absent' }
  | { readonly status: 'unsupported-kind'; readonly kind: 'path' | 'arc' }
  | { readonly status: 'accepted'; readonly target: SceneTargetFact };
export type SceneTargetEntry = SceneTargetFact | { readonly id: string; readonly kind: 'path' | 'arc' };
export interface SceneTargetSnapshot {
  readonly acceptedSceneRevision: number;
  readonly registryRevision: number;
  readonly targets: readonly SceneTargetEntry[];
}
export interface SceneRegistryNotice {
  readonly acceptedSceneRevision: number;
  readonly registryRevision: number;
  readonly changedIds: readonly string[];
}
export interface ScenePadding {
  readonly top: number; readonly bottom: number; readonly left: number; readonly right: number;
}
export interface SceneViewportNotice {
  readonly allocationRevision: number;
  readonly width: number; readonly height: number; readonly pixelRatio: number;
  readonly padding: ScenePadding;
}
export interface SceneFrameStamp {
  readonly ownerToken: object;
  readonly contextEpoch: number; readonly styleRevision: number;
  readonly samplingViewRevision: number; readonly layoutRevision: number;
  readonly allocationRevision: number;
  readonly acceptedSceneRevision: number; readonly installedSceneRevision: number;
  readonly placementRevision: number; readonly paintRevision: number; readonly paintFrameSerial: number;
}
export interface SceneCameraProfile {
  readonly latitude: number; readonly zoom: number; readonly pitch: number;
  readonly width: number; readonly height: number;
  /** Same-issue native control value before shader Float32 conversion. */
  readonly nativeControlTransition: number;
  readonly padding: ScenePadding;
  readonly explicitBounds: boolean; readonly explicitZoomLimits: boolean; readonly nativeBounds: boolean;
  readonly nativeMinZoom: number; readonly nativeMaxZoom: number; readonly terrain: boolean;
  readonly canPan: boolean; readonly canObserveMotion: boolean; readonly canStop: boolean;
  readonly moving: boolean; readonly hasProjection: boolean;
}
export interface SceneCompletedFrame {
  readonly stamp: SceneFrameStamp;
  readonly width: number; readonly height: number; readonly pixelRatio: number;
  readonly padding: ScenePadding;
  /** Actual uploaded Float32 rendering helper, not the native control classifier. */
  readonly projectionTransition: number;
  readonly cameraProfile: SceneCameraProfile | undefined;
}
export interface SceneTargetProjection {
  readonly acceptedPositionRevision: number;
  readonly status: 'resolved' | 'terrain-pending' | 'terrain-unavailable' | 'model-pending' |
    'visibility-pending' | 'clipped' | 'occluded' | 'unavailable';
  readonly point?: readonly [number, number];
  readonly visible: boolean;
}
export interface MapSceneSessionAttachment {
  target(id: string): SceneTargetLookup;
  subscribeTargets(listener: (notice: SceneRegistryNotice) => void): () => void;
  subscribeViewport(listener: (notice: SceneViewportNotice) => void): () => void;
  watchTarget(id: string): () => void;
  subscribeCompletedFrames(listener: (frame: SceneCompletedFrame) => void): () => void;
  projectTarget(frame: SceneCompletedFrame, id: string): SceneTargetProjection | undefined;
  current(frame: SceneCompletedFrame, target: SceneTargetFact): boolean;
  requestFrame(): void;
}
export interface SceneSessionStateSnapshot extends SceneTargetSnapshot {
  readonly viewport: SceneViewportNotice | undefined;
}
/** One persistent state owner, bound before accepted work starts in this connection. */
export interface MapSceneSessionState {
  readonly connection: object;
  /** Callback-free atomic read of owned immutable data; never reads native getters or dispatches. */
  capture(): SceneSessionStateSnapshot;
  /** Invalidates accepted metadata, target facts or allocation; capture supplies current authority. */
  subscribe(invalidated: () => void): () => void;
}
/** Replaceable frame capability; it never owns or replaces accepted geographic intent. */
export interface MapSceneSessionBacking {
  readonly connection: object;
  readonly state: MapSceneSessionState;
  watchTarget(id: string): () => void;
  subscribeCompletedFrames(listener: (frame: SceneCompletedFrame) => void): () => void;
  projectTarget(frame: SceneCompletedFrame, id: string): SceneTargetProjection | undefined;
  current(frame: SceneCompletedFrame, target: SceneTargetFact): boolean;
  requestFrame(): void;
}
export interface MapSceneSessionFacade {
  readonly attachment: MapSceneSessionAttachment;
  bindState(state: MapSceneSessionState): boolean;
  promote(backing: MapSceneSessionBacking): boolean;
  close(): void;
}
