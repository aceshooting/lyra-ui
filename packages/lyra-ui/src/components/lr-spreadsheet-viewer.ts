export type { LyraAnchorKind } from './viewers/document-viewer/anchors.js';
export type { TableViewerScrollMode } from './viewers/table-viewer-shared.js';
export type { LyraAnchorTargetEventMap } from '../internal/anchor-target-base.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
export * from './viewers/spreadsheet-viewer/spreadsheet-viewer.class.js';
export * from './viewers/spreadsheet-viewer/spreadsheet-loader.js';
import { html } from 'lit';
import { defineElement } from '../internal/prefix.js';
import './lr-tab-group.js';
import './lr-tab-panel.js';
import './lr-tab.js';
import './lr-virtual-list.js';
import { registerDocumentRenderer, type LyraDocumentFile, type LyraDocumentRendererDefinition } from './viewers/document-viewer/registry.js';
import { LyraSpreadsheetViewer } from './viewers/spreadsheet-viewer/spreadsheet-viewer.class.js';

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
