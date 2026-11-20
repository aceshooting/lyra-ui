export type { LyraAnchor } from '../internal/document-anchors.js';
export type { LyraPageViewerStateChangeDetail } from './viewers/page-rail/page-rail.class.js';
export type { LyraPageViewerSnapshot } from './viewers/page-rail/page-viewer-snapshot.js';
export type { LyraAnchorTargetEventMap } from '../internal/anchor-target-base.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
export * from './viewers/pdf-viewer/pdf-viewer.class.js';
import { html } from 'lit';
import { LyraPdfViewer } from './viewers/pdf-viewer/pdf-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-highlight-layer.js';
import './lr-virtual-list.js';
import { registerDocumentRenderer, type LyraDocumentFile } from './viewers/document-viewer/registry.js';

defineElement('pdf-viewer', LyraPdfViewer);

registerDocumentRenderer('application/pdf', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.pdf'),
  capabilities: { anchors: ['page', 'text-quote', 'region'], textSelect: true, search: true },
  load: async () => ({
    render: (file: LyraDocumentFile) => html`<lr-pdf-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-pdf-viewer>`,
  }),
});
