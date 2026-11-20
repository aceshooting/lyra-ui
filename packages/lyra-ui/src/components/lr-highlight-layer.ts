export type { HighlightActivateDetail, LyraHighlightTone } from './viewers/document-viewer/anchors.js';
export * from './viewers/highlight-layer/highlight-layer.class.js';
import { LyraHighlightLayer } from './viewers/highlight-layer/highlight-layer.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('highlight-layer', LyraHighlightLayer);
