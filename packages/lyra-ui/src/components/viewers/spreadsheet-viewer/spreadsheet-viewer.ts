/** @deprecated Import @aceshooting/lyra-ui/components/lr-spreadsheet-viewer.js to register this component. */
export * from './spreadsheet-viewer.class.js';
export * from './spreadsheet-loader.js';
import { html } from 'lit';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/tab-group/tab-group.js';
import '../../layout/tab-group/tab-panel.js';
import '../../layout/tab-group/tab.js';
import '../../layout/virtual-list/virtual-list.js';
import { registerDocumentRenderer, type LyraDocumentFile, type LyraDocumentRendererDefinition } from '../document-viewer/registry.js';
import { LyraSpreadsheetViewer } from './spreadsheet-viewer.class.js';

defineElement('spreadsheet-viewer', LyraSpreadsheetViewer);
const matches = (file: LyraDocumentFile): boolean => /\.xlsx?$/i.test(file.name);
const renderer: LyraDocumentRendererDefinition = {
  matches,
  capabilities: { anchors: ['cell-range'], search: true, textSelect: false },
  render: (file: LyraDocumentFile) => html`<lr-spreadsheet-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-spreadsheet-viewer>`,
};
registerDocumentRenderer('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', renderer);
registerDocumentRenderer('application/vnd.ms-excel', renderer);
