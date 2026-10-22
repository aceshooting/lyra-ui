import { createEngine3dLoader } from '../../../internal/engine-3d-loader.js';
import { webgl2Available } from '../../../internal/engine-3d.js';
import { tag } from '../../../internal/prefix.js';

export const modelEngineLoader = createEngine3dLoader({ entry: 'model', tag: tag('model-viewer'), load: () => import('@aceshooting/lyra-3d/model') });
/** Platform capability seam; loaded engines are still validated by the shared contract. */
export const modelEngineEnvironment = { available: (document: Document): boolean => webgl2Available(() => document.createElement('canvas')) };
