import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile, type LazyAdaptedDocumentRendererDefinition } from '../../../internal/document-renderer-registry.js';
import { MODEL_MIME_FORMATS, resolveModelFormat } from './model-viewer-source.js';

export const MODEL_VIEWER_TAG = tag('model-viewer');
const definition: LazyAdaptedDocumentRendererDefinition = {
  rendererKind: 'adapted',
  matches: (file: LyraDocumentFile) => resolveModelFormat('auto', file.name, file.mimeType, file.src) !== null,
  load: () => import('./model-viewer-document.js').then(module => module.modelDocumentRenderer),
};
for (const mime of Object.keys(MODEL_MIME_FORMATS)) registerDocumentRenderer(mime, definition);
registerDocumentRenderer('lyra:model', definition);
