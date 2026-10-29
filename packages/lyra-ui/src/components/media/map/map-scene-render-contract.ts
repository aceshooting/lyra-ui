import type { CanonicalScenePosition, SceneSessionStateSnapshot, SceneViewportNotice } from '../../../internal/map-scene-contract.js';
import type { SceneAcceptedSnapshot } from './map-scene-owner.js';

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
