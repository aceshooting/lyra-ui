import { html } from 'lit';
import './model-viewer.js';
import { createDocumentRendererAdapter, type LyraAdaptedDocumentRendererDefinition } from '../../../internal/document-renderer-registry.js';

export const modelDocumentRenderer: LyraAdaptedDocumentRendererDefinition = {
  adapter: createDocumentRendererAdapter({
    kind: 'model',
    adapt: (file, supplied) => supplied?.kind === 'model' ? supplied : { kind: 'model', file },
    capabilities: () => ({ anchors: [], search: false, textSelect: false }),
    render: payload => html`<lr-model-viewer src=${payload.file.src} name=${payload.file.name} mime-type=${payload.file.mimeType} alt=${payload.file.alt ?? ''} format=${payload.format ?? 'auto'} .camera=${payload.camera}></lr-model-viewer>`,
  }),
};
