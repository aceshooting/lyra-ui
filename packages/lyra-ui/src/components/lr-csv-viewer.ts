export type { LyraAnchorKind } from '../internal/document-anchors.js';
export type { TableViewerScrollMode } from './viewers/table-viewer-shared.js';
export type { LyraAnchorTargetEventMap } from '../internal/anchor-target-base.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
export * from './viewers/csv-viewer/csv-viewer.class.js';
import { html } from 'lit';
import { defineElement } from '../internal/prefix.js';
import './lr-virtual-list.js';
import { registerDocumentRenderer, type LyraDocumentFile } from './viewers/document-viewer/registry.js';
import { LyraCsvViewer } from './viewers/csv-viewer/csv-viewer.class.js';

defineElement('csv-viewer', LyraCsvViewer);
registerDocumentRenderer('text/csv', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.csv'),
  capabilities: { anchors: ['cell-range'], search: true, textSelect: false },
  render: (file: LyraDocumentFile) => html`<lr-csv-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-csv-viewer>`,
});
