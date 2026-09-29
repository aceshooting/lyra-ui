import type {
  AnchorResultDetail,
  AnchorTargetCapabilities,
  HighlightActivateDetail,
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
  LyraHighlightTone,
  TextSelectDetail,
  } from '../src/components/viewers/document-viewer/document-viewer.js';
import type { LyraDocumentPreview } from '../src/components/viewers/document-preview/document-preview.class.js';
// @ts-expect-error The retired constructor is available through its granular class route, not the curated root.
import type { LyraDocumentPreview as RemovedRootDocumentPreview } from '../src/lyra.js';

const anchor: LyraAnchor = { kind: 'page', page: 1 };
const kind: LyraAnchorKind = anchor.kind;
const tone: LyraHighlightTone = 'accent';
const highlight: LyraHighlight = { id: 'result', anchor, tone };
const capabilities: AnchorTargetCapabilities = { anchors: [kind], search: true };
const activated: HighlightActivateDetail = { highlightId: highlight.id };
const selected: TextSelectDetail = { text: '', anchor, rects: [] };
const result: AnchorResultDetail = { found: true };

void [capabilities, activated, selected, result];

declare const preview: LyraDocumentPreview;
preview.suppressDownload = true;
declare const removedRootPreview: RemovedRootDocumentPreview;
void removedRootPreview;
