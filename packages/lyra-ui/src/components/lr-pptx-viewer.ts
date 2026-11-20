export type { AnchorResultDetail, LyraAnchorKind, TextSelectDetail } from './viewers/document-viewer/anchors.js';
export type { LyraPageViewerStateChangeDetail, PageThumbnailRenderHandle } from './viewers/page-rail/page-rail.class.js';
export type { LyraPageViewerSnapshot } from './viewers/page-rail/page-viewer-snapshot.js';
export type { LyraSearchChangeDetail, LyraTextViewerTargetEventMap } from '../internal/text-viewer-target.js';
export * from './viewers/pptx-viewer/pptx-viewer.class.js';
import { html } from 'lit';
import { defineElement } from '../internal/prefix.js';
import { LyraPptxViewer } from './viewers/pptx-viewer/pptx-viewer.class.js';
import { registerDocumentRenderer, type LyraDocumentFile } from './viewers/document-viewer/registry.js';

defineElement('pptx-viewer', LyraPptxViewer);
registerDocumentRenderer('application/vnd.openxmlformats-officedocument.presentationml.presentation', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.pptx'),
  render: (file: LyraDocumentFile) => html`<lr-pptx-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-pptx-viewer>`,
  capabilities: {
    anchors: ['text-quote', 'fragment', 'page'],
    search: true,
    textSelect: true,
  },
});
