export * from './viewers/docx-viewer/docx-loader.js';
export * from './viewers/docx-viewer/docx-viewer.class.js';

import { html } from 'lit';
import { defineElement } from '../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from './viewers/document-viewer/registry.js';
import { LyraDocxViewer } from './viewers/docx-viewer/docx-viewer.class.js';

defineElement('docx-viewer', LyraDocxViewer);

registerDocumentRenderer('application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.docx'),
  render: (file: LyraDocumentFile) => html`<lr-docx-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-docx-viewer>`,
  capabilities: { anchors: ['fragment', 'text-quote'], search: true, textSelect: true },
});
