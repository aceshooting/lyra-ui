/** @deprecated Import @aceshooting/lyra-ui/components/lr-svg-viewer.js to register this component. */
export * from './svg-viewer.class.js';
import { html } from 'lit';
import { LyraSvgViewer } from './svg-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../media/pan-zoom/pan-zoom.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

defineElement('svg-viewer', LyraSvgViewer);

registerDocumentRenderer('image/svg+xml', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.svg'),
  render: (file: LyraDocumentFile) => html`<lr-svg-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-svg-viewer>`,
  capabilities: { anchors: ['region'], search: false, textSelect: false },
});
