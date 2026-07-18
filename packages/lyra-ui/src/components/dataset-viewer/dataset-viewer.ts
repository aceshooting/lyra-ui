export * from './dataset-viewer.class.js';
import { html } from 'lit';
import { LyraDatasetViewer } from './dataset-viewer.class.js';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

defineElement('dataset-viewer', LyraDatasetViewer);
registerDocumentRenderer('lyra:dataset', {
  matches: (file: DocumentFile) => /\.(tsv|psv|dat)$/i.test(file.name),
  capabilities: { anchors: ['cell-range'], search: true, textSelect: false },
  render: (file: DocumentFile) => html`<lr-dataset-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-dataset-viewer>`,
});
