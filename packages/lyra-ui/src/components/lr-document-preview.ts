export type { HighlightActivateDetail, LyraAnchor, LyraHighlight } from './viewers/document-viewer/anchors.js';
export * from './viewers/document-preview/document-preview.class.js';
import { LyraDocumentPreview } from './viewers/document-preview/document-preview.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-pan-zoom.js';
defineElement('document-preview', LyraDocumentPreview);
