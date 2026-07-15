export * from './pdf-viewer.class.js';
import { html } from 'lit';
import { LyraPdfViewer } from './pdf-viewer.class.js';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

defineElement('pdf-viewer', LyraPdfViewer);

registerDocumentRenderer('application/pdf', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.pdf'),
  load: async () => ({
    render: (file: DocumentFile) => html`<lyra-pdf-viewer src=${file.src} name=${file.name}></lyra-pdf-viewer>`,
  }),
});
