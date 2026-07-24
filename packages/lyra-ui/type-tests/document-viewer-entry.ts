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

const anchor: LyraAnchor = { kind: 'page', page: 1 };
const kind: LyraAnchorKind = anchor.kind;
const tone: LyraHighlightTone = 'accent';
const highlight: LyraHighlight = { id: 'result', anchor, tone };
const capabilities: AnchorTargetCapabilities = { anchors: [kind], search: true };
const activated: HighlightActivateDetail = { id: highlight.id };
const selected: TextSelectDetail = { text: '', anchor, rects: [] };
const result: AnchorResultDetail = { found: true };

void [capabilities, activated, selected, result];
