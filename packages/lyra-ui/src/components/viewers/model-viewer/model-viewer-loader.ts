import { createEngine3dLoader, type Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { webgl2Available } from '../../../internal/engine-3d.js';
import { tag } from '../../../internal/prefix.js';

export const modelEngineLoader = createEngine3dLoader({ entry: 'model', tag: tag('model-viewer'), load: () => import('@aceshooting/lyra-3d/model') });
/** Platform capability seam; loaded engines are still validated by the shared contract. */
export const modelEngineEnvironment = { available: (document: Document): boolean => webgl2Available(() => document.createElement('canvas')) };

interface AsyncModelEngine extends Engine3dInstance {
  setDataAsync(data: unknown, revision: number, options: { readonly signal: AbortSignal }): Promise<void>;
}

export function supportsAsyncModelData(engine: Engine3dInstance): engine is AsyncModelEngine {
  return 'setDataAsync' in engine && typeof engine.setDataAsync === 'function';
}
