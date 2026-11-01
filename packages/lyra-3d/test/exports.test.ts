import {
  LYRA_3D_CONTRACT,
  createLyra3dViewport,
  fitOrbitCamera,
  resolveLyra3dStyle,
  startLyra3dTask,
  type Lyra3dEngine,
  type Lyra3dEngineModule,
  type Lyra3dHost,
  type Lyra3dOrbitCamera,
  type Lyra3dStyle,
} from '@aceshooting/lyra-3d/core';

declare const container: HTMLElement;
declare const host: Lyra3dHost;
declare const style: Lyra3dStyle;

const contract: 1 = LYRA_3D_CONTRACT;
const viewport = createLyra3dViewport(container, host, { wheelZoom: (event) => event.ctrlKey });
const camera: Lyra3dOrbitCamera = fitOrbitCamera(null, { width: viewport.width, height: viewport.height });
viewport.transitionTo(camera);
const pointSize: number = resolveLyra3dStyle(style).pointSize;
const task = startLyra3dTask({
  input: { steps: 1 },
  kernel: () => ({ step: () => ({ done: true, output: new Float32Array(1) }) }),
  onOutput: (output: Float32Array, done: boolean) => void [output, done],
});
task.stop();

const engineModule: Lyra3dEngineModule<{ readonly count: number }, Lyra3dOrbitCamera> = {
  createEngine(): Lyra3dEngine<{ readonly count: number }, Lyra3dOrbitCamera> {
    return {
      contract: LYRA_3D_CONTRACT,
      mount: async () => undefined,
      setData: () => undefined,
      setStyle: () => undefined,
      setCamera: () => undefined,
      resize: () => undefined,
      dispose: () => undefined,
    };
  },
};
void [contract, pointSize, engineModule];

import { createEngine as createGraphEngine, type GraphEngineData } from '@aceshooting/lyra-3d/graph';
const graphModule: Lyra3dEngineModule<GraphEngineData, Lyra3dOrbitCamera> = { createEngine: createGraphEngine };
void graphModule;

import { createEngine as createPointsEngine, type PointsEngineData } from '@aceshooting/lyra-3d/points';
const pointsModule: Lyra3dEngineModule<PointsEngineData, Lyra3dOrbitCamera> = { createEngine: createPointsEngine };
void pointsModule;

import { createEngine as createPanoramaEngine, type PanoramaData, type PanoramaCamera } from '@aceshooting/lyra-3d/panorama';
const panoramaModule: Lyra3dEngineModule<PanoramaData, PanoramaCamera> = { createEngine: createPanoramaEngine };
void panoramaModule;

import { createEngine as createModelEngine, type ModelEngineData } from '@aceshooting/lyra-3d/model';
const modelModule: Lyra3dEngineModule<ModelEngineData, Lyra3dOrbitCamera> = { createEngine: createModelEngine };
void modelModule;

import {
  Lyra3dXrError,
  isLyra3dXrSupported,
  type Lyra3dXrErrorCode,
  type Lyra3dXrOptions,
  type Lyra3dXrPresentation,
  type Lyra3dXrState,
} from '@aceshooting/lyra-3d/xr';

const xrSupport: Promise<boolean> = isLyra3dXrSupported();
const xrStates: readonly Lyra3dXrState[] = ['ready', 'requesting', 'presenting', 'ending', 'disposed'];
const xrCodes: readonly Lyra3dXrErrorCode[] = ['unavailable', 'not-allowed', 'busy', 'unsupported-scene', 'context-lost', 'failed', 'aborted'];
const xrOptions: Lyra3dXrOptions = { onStateChange: (state: Lyra3dXrState) => { void state; } };
const xrErrorCode: Lyra3dXrErrorCode = new Lyra3dXrError('aborted').code;
const xrPresentation: Lyra3dXrPresentation = {
  state: 'ready', enter: async () => undefined, exit: async () => undefined, dispose: () => undefined,
};
const xrEntry: Promise<void> = xrPresentation.enter();
const xrExit: Promise<void> = xrPresentation.exit();
const xrDispose: void = xrPresentation.dispose();
const xrEngine = createPointsEngine();
if (xrEngine.prepareXrPresentation) {
  const preparation: Promise<Lyra3dXrPresentation> = xrEngine.prepareXrPresentation(xrOptions);
  void preparation;
}

// @ts-expect-error Native request features are not presentation options.
const xrNativeOptions: Lyra3dXrOptions = { requiredFeatures: ['local-floor'] };
// @ts-expect-error The lifecycle is a closed platform-independent vocabulary.
const xrInvalidState: Lyra3dXrState = 'active';
// @ts-expect-error Native sessions are not exposed by a prepared presentation.
const xrSession = xrPresentation.session;
// @ts-expect-error Native renderers are not exposed by a prepared presentation.
const xrRenderer = xrPresentation.renderer;
// @ts-expect-error Failure codes are closed rather than arbitrary platform messages.
const xrInvalidCode: Lyra3dXrErrorCode = 'NotAllowedError';
void [xrSupport, xrStates, xrCodes, xrErrorCode, xrEntry, xrExit, xrDispose,
  xrNativeOptions, xrInvalidState, xrSession, xrRenderer, xrInvalidCode];
