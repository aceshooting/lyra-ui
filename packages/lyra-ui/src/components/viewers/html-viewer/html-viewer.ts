/** @deprecated Import @aceshooting/lyra-ui/components/lr-html-viewer.js to register this component. */
export * from './html-viewer.class.js';
import { html } from 'lit';
import { LyraHtmlViewer } from './html-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

defineElement('html-viewer', LyraHtmlViewer);
registerDocumentRenderer('text/html', {
  matches: (file: LyraDocumentFile) => /\.html?$/i.test(file.name),
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
  render: (file: LyraDocumentFile) => html`<lr-html-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-html-viewer>`,
});
