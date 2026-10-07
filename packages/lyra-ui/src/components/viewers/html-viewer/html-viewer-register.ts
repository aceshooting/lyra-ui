import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

export const HTML_VIEWER_TAG = tag('html-viewer');

registerDocumentRenderer('text/html', {
  matches: (file: LyraDocumentFile) => /\.html?$/i.test(file.name),
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
  load: () => import('./html-viewer.js').then(() => ({
    render: (file: LyraDocumentFile) => html`<lr-html-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-html-viewer>`,
  })),
});
