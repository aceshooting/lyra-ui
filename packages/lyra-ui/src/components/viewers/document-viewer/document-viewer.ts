export * from './document-viewer.class.js';
export * from './registry.js';
export * from './anchors.js';
import { LyraDocumentViewer } from './document-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/dialog/dialog.js';
import '../document-preview/document-preview.js';

defineElement('document-viewer', LyraDocumentViewer);
