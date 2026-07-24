export * from './pdf-viewer.class.js';
import { html } from 'lit';
import { LyraPdfViewer } from './pdf-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../highlight-layer/highlight-layer.js';
import '../../layout/virtual-list/virtual-list.js';
import '../../overlays/skeleton/skeleton.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

defineElement('pdf-viewer', LyraPdfViewer);

registerDocumentRenderer('application/pdf', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.pdf'),
  capabilities: { anchors: ['page', 'text-quote', 'region'], textSelect: true, search: true },
  load: async () => ({
    render: (file: DocumentFile) => html`<lr-pdf-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-pdf-viewer>`,
  }),
});
