import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

export const SVG_VIEWER_TAG = tag('svg-viewer');

registerDocumentRenderer('image/svg+xml', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.svg'),
  capabilities: { anchors: ['region'], search: false, textSelect: false },
  load: () => import('./svg-viewer.js').then(() => ({
    render: (file: LyraDocumentFile) => html`<lr-svg-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-svg-viewer>`,
  })),
});
