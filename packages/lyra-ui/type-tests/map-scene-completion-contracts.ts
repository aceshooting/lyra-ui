import type {
  createSceneBridge, SceneBridgeWithCompletion, SceneBridgeHostWithCompletion, SceneBridgeNativeMap,
  SceneCompletionHost as NativeHost, SceneCompletionInput as NativeInput, SceneCompletionPort as NativePort,
  SceneBridgeCompletedFrame, SceneBridgeCameraProfile, SceneBridgeTargetProjection
} from '@aceshooting/lyra-map/scene';
import type { SceneCompletionHost, SceneCompletionInput, SceneCompletionPort, SceneRenderInput } from '../src/components/media/map/map-scene-render-contract.js';
import type { createMapSceneCompletionHost, createMapSceneCompletionAdapter } from '../src/components/media/map/map-scene-completion-adapter.js';
import type { MapSceneSessionBacking, SceneCompletedFrame, SceneCameraProfile, SceneTargetProjection } from '../src/internal/map-scene-contract.js';

type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
type Equal<A, B> = Extends<A, B> extends true ? Extends<B, A> : false;

export type CompletedFrameCompatibility = Assert<Equal<SceneCompletedFrame, SceneBridgeCompletedFrame>>;
export type CameraProfileCompatibility = Assert<Equal<SceneCameraProfile, SceneBridgeCameraProfile>>;
export type TargetProjectionCompatibility = Assert<Equal<SceneTargetProjection, SceneBridgeTargetProjection>>;
export type CompletionPortCompatibility = Assert<Equal<SceneCompletionPort, NativePort>>;
export type CanonicalInputCompatibility = Assert<Extends<SceneCompletionInput, NativeInput>>;
export type MarkerInputCompatibility = Assert<Extends<SceneRenderInput, NativeInput['renderInput']>>;
export type CompletionHostCompatibility = Assert<Extends<SceneCompletionHost, NativeHost>>;
export type PreparedHostCompatibility = Assert<Extends<ReturnType<typeof createMapSceneCompletionHost>, NativeHost>>;
export type ExistingBackingCompatibility = Assert<Equal<ReturnType<typeof createMapSceneCompletionAdapter>['backing'], MapSceneSessionBacking>>;
export type AdapterPortCompatibility = Assert<Extends<NativePort, Parameters<typeof createMapSceneCompletionAdapter>[0]['port']>>;
export type ClosedPortSurface = Assert<Equal<keyof NativePort,
  'watchTarget' | 'subscribeCompletedFrames' | 'projectTarget' | 'current' | 'requestFrame'>>;
export type ClosedHostSurface = Assert<Equal<keyof NativeHost,
  'captureInput' | 'subscribeInput' | 'claimPaintSerial' | 'captureCameraFacts'>>;

declare const factory: typeof createSceneBridge;
declare const map: SceneBridgeNativeMap;
declare const host: SceneBridgeHostWithCompletion;
const completed: SceneBridgeWithCompletion = factory(map, host);
const port: SceneCompletionPort = completed.completion;
void port;

// Required canonical UI geography can flow out; optional native geography cannot flow back in.
declare const nativePacket: NativeInput['renderInput'];
// @ts-expect-error Native marker positions permit omitted altitude and altitudeReference.
const canonicalPacket: SceneRenderInput = nativePacket;
void canonicalPacket;

const invalidated = () => {};
map.on('data', invalidated);
map.off('data', invalidated);
map.on('dataloading', invalidated);
map.off('dataloading', invalidated);
map.on('styledata', invalidated);
map.off('styledata', invalidated);
