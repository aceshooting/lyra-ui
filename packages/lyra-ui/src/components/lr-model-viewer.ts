export type { Engine3dFallbackDetail } from '../internal/engine-3d.js';
export * from './viewers/model-viewer/model-viewer.class.js';
import { LyraModelViewer } from './viewers/model-viewer/model-viewer.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('model-viewer', LyraModelViewer);
