export type { HighlightActivateDetail, LyraHighlightTone } from '../internal/document-anchors.js';
export * from './viewers/highlight-layer/highlight-layer.class.js';
import { LyraHighlightLayer } from './viewers/highlight-layer/highlight-layer.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('highlight-layer', LyraHighlightLayer);
