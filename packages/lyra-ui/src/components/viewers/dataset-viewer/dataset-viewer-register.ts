import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

export const DATASET_VIEWER_TAG = tag('dataset-viewer');

registerDocumentRenderer('lyra:dataset', {
  matches: (file: LyraDocumentFile) => /\.(tsv|psv|dat)$/i.test(file.name),
  capabilities: { anchors: ['cell-range'], search: true, textSelect: false },
  load: () => import('./dataset-viewer.js').then(() => ({
    render: (file: LyraDocumentFile) => html`<lr-dataset-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-dataset-viewer>`,
  })),
});
