export * from './docx-loader.js';
export * from './docx-viewer.class.js';

import { html } from 'lit';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import { LyraDocxViewer } from './docx-viewer.class.js';

defineElement('docx-viewer', LyraDocxViewer);

registerDocumentRenderer('application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.docx'),
  render: (file: DocumentFile) => html`<lr-docx-viewer src=${file.src} name=${file.name}></lr-docx-viewer>`,
  capabilities: { anchors: ['fragment', 'text-quote'], search: true, textSelect: true },
});
