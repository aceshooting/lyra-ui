export * from './document-preview.class.js';
import { LyraDocumentPreview } from './document-preview.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('document-preview', LyraDocumentPreview);
