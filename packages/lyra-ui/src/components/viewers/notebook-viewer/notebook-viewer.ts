export * from './notebook-viewer.class.js';
import { html } from 'lit';
import { LyraNotebookViewer } from './notebook-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import '../../layout/virtual-list/virtual-list.js';
import '../../conversation/markdown/markdown.js';
import '../../conversation/code-block/code-block.js';
import '../../utility/json-viewer/json-viewer.js';

defineElement('notebook-viewer', LyraNotebookViewer);

registerDocumentRenderer('application/x-ipynb+json', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.ipynb'),
  capabilities: { anchors: ['node-path', 'fragment'], search: true },
  render: (file: DocumentFile) => html`<lr-notebook-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-notebook-viewer>`,
});
