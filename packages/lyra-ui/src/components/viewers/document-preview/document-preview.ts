export * from './document-preview.class.js';
import { LyraDocumentPreview } from './document-preview.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../media/zoomable-frame/zoomable-frame.js';
defineElement('document-preview', LyraDocumentPreview);
