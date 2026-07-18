export * from './csv-viewer.class.js';
import { html } from 'lit';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import { LyraCsvViewer } from './csv-viewer.class.js';

defineElement('csv-viewer', LyraCsvViewer);
registerDocumentRenderer('text/csv', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.csv'),
  capabilities: { anchors: ['cell-range'], search: true, textSelect: false },
  render: (file: DocumentFile) => html`<lr-csv-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-csv-viewer>`,
});
