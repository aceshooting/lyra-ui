import type { SceneSessionStateSnapshot } from '../src/internal/map-scene-contract.js';
import type { SceneAcceptedSnapshot } from '../src/components/media/map/map-scene-owner.js';
import type { createMapSceneOwner } from '../src/components/media/map/map-scene-owner.js';

export interface TestScenePacket {
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
  readonly markers: readonly {
    readonly id: string;
    readonly position: { readonly lngLat: readonly [number, number]; readonly altitude: number; readonly altitudeReference: 'sea-level' | 'terrain' };
    readonly acceptedPositionRevision: number;
    readonly radiusCss: number;
    readonly rgba: readonly [number, number, number, number];
  }[];
}
export interface TestScenePublication {
  readonly accepted: SceneAcceptedSnapshot;
  readonly state: SceneSessionStateSnapshot;
  readonly phase: 'pending' | 'resolved' | 'unavailable';
  readonly input: TestScenePacket;
}
export interface TestScenePresentation {
  readonly markers: readonly { readonly id: string; readonly rgba: readonly [number, number, number, number] }[];
  readonly reducedMotion: boolean;
}
export interface TestSceneViewport {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly padding: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
}
export type TestSceneRenderOwner = ReturnType<typeof createMapSceneOwner> & {
  captureRenderPublication(): TestScenePublication;
  subscribeRenderPublication(listener: () => void): () => void;
  invalidatePresentation(): boolean;
  commitPresentation(expected: TestScenePublication, value: TestScenePresentation): boolean;
  failPresentation(expected: TestScenePublication): boolean;
  setViewport(value: TestSceneViewport | undefined): boolean;
};

// This structural test view adds no runtime shim: missing owner methods fail in the test body.
export function renderOwner(owner: ReturnType<typeof createMapSceneOwner>): TestSceneRenderOwner {
  return owner as TestSceneRenderOwner;
}
export function sceneViewport(width = 640, height = 480, pixelRatio = 1.25): TestSceneViewport {
  return { width, height, pixelRatio, padding: { top: 3, right: 5, bottom: 7, left: 11 } };
}
export function scenePresentation(accepted: SceneAcceptedSnapshot, alpha = 0.8): TestScenePresentation {
  return { reducedMotion: false,
    markers: accepted.objects.filter(object => object.kind === 'marker').map(object => ({ id: object.id, rgba: [0.2, 0.4, 0.6, alpha] as const })) };
}
export function publicationCoherent(value: TestScenePublication): boolean {
  const viewport = value.state.viewport, allocation = value.input.allocation;
  return value.accepted.acceptedSceneRevision === value.state.acceptedSceneRevision &&
    value.accepted.acceptedSceneRevision === value.input.acceptedSceneRevision &&
    (viewport === undefined ? allocation === undefined : allocation !== undefined &&
      allocation.revision === viewport.allocationRevision && allocation.width === viewport.width &&
      allocation.height === viewport.height && allocation.pixelRatio === viewport.pixelRatio &&
      allocation.padding.top === viewport.padding.top && allocation.padding.right === viewport.padding.right &&
      allocation.padding.bottom === viewport.padding.bottom && allocation.padding.left === viewport.padding.left);
}
