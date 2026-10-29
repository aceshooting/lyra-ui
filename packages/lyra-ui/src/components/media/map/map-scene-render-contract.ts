import type { CanonicalScenePosition, SceneCameraProfile, SceneCompletedFrame, SceneTargetProjection,
  SceneSessionStateSnapshot, SceneViewportNotice } from '../../../internal/map-scene-contract.js';
import type { AdmittedSceneObject } from './map-scene-admission.js';

export interface SceneAcceptedSnapshot {
  readonly acceptedSceneRevision: number;
  readonly objects: readonly AdmittedSceneObject[];
}

export type ScenePresentationPhase = 'pending' | 'resolved' | 'unavailable';
export type SceneViewportInput = Omit<SceneViewportNotice, 'allocationRevision'>;

/** Normalized CSS color before the accepted object's opacity is applied. */
export interface SceneResolvedPresentation {
  readonly markers: readonly {
    readonly id: string;
    readonly rgba: readonly [number, number, number, number];
  }[];
  readonly reducedMotion: boolean;
}

/** Marker input contains only owned geography and resolved scalar presentation. */
export interface SceneRenderMarker {
  readonly id: string;
  readonly position: CanonicalScenePosition;
  readonly acceptedPositionRevision: number;
  readonly radiusCss: number;
  readonly rgba: readonly [number, number, number, number];
}

export interface SceneRenderInput {
  readonly acceptedSceneRevision: number;
  readonly presentationRevision: number;
  readonly allocation: {
    readonly revision: number;
    readonly width: number;
    readonly height: number;
    readonly pixelRatio: number;
    readonly padding: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  } | undefined;
  readonly reducedMotion: boolean;
  readonly markers: readonly SceneRenderMarker[];
}

/** Zero prepared work in a pending publication does not mean accepted scene intent is empty. */
export interface SceneRenderPublication {
  readonly accepted: SceneAcceptedSnapshot;
  readonly state: SceneSessionStateSnapshot;
  readonly phase: ScenePresentationPhase;
  readonly input: SceneRenderInput;
}

export interface SceneCompletionTarget {
  readonly token: object;
  readonly acceptedPositionRevision: number;
  readonly position: CanonicalScenePosition;
}
export interface SceneCompletionMember {
  readonly id: string;
  readonly kind: 'marker' | 'path' | 'arc' | 'model';
  readonly rowToken: object;
  readonly target: SceneCompletionTarget | undefined;
}
export interface SceneCompletionInput {
  readonly publicationToken: object;
  readonly stateToken: object;
  readonly phase: ScenePresentationPhase;
  readonly acceptedSceneRevision: number;
  readonly renderInput: SceneRenderInput;
  readonly members: readonly SceneCompletionMember[];
}
export type SceneCompletionCameraFacts = Omit<SceneCameraProfile,
  'width' | 'height' | 'padding' | 'nativeControlTransition'>;
export interface SceneCompletionHost {
  captureInput(): SceneCompletionInput;
  subscribeInput(listener: () => void): () => void;
  claimPaintSerial(expected: SceneCompletionInput): number | undefined;
  captureCameraFacts(expected: SceneCompletionInput): SceneCompletionCameraFacts | undefined;
}
export interface SceneCompletionPort {
  watchTarget(id: string): () => void;
  subscribeCompletedFrames(listener: (frame: SceneCompletedFrame) => void): () => void;
  projectTarget(frame: SceneCompletedFrame, id: string): SceneTargetProjection | undefined;
  current(frame: SceneCompletedFrame, id: string, targetToken: object): boolean;
  requestFrame(): void;
}
