export * from './pptx-viewer.class.js';
import { html } from 'lit';
import { defineElement } from '../../internal/prefix.js';
import { LyraPptxViewer } from './pptx-viewer.class.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

defineElement('pptx-viewer', LyraPptxViewer);
registerDocumentRenderer('application/vnd.openxmlformats-officedocument.presentationml.presentation', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.pptx'),
  render: (file: DocumentFile) => html`<lr-pptx-viewer src=${file.src} name=${file.name}></lr-pptx-viewer>`,
});
