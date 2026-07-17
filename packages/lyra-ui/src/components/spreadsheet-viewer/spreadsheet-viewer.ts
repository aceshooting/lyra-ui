export * from './spreadsheet-viewer.class.js';
export * from './spreadsheet-loader.js';
import { html } from 'lit';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile, type DocumentRendererDefinition } from '../document-viewer/registry.js';
import { LyraSpreadsheetViewer } from './spreadsheet-viewer.class.js';

defineElement('spreadsheet-viewer', LyraSpreadsheetViewer);
const matches = (file: DocumentFile): boolean => /\.xlsx?$/i.test(file.name);
const renderer: DocumentRendererDefinition = {
  matches,
  capabilities: { anchors: ['cell-range'], search: true, textSelect: false },
  render: (file: DocumentFile) => html`<lyra-spreadsheet-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lyra-spreadsheet-viewer>`,
};
registerDocumentRenderer('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', renderer);
registerDocumentRenderer('application/vnd.ms-excel', renderer);
