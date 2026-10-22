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
