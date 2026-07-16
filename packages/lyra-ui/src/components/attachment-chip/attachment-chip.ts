export * from './attachment-chip.class.js';
import '../document-viewer/document-viewer.js';
import { LyraAttachmentChip } from './attachment-chip.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('attachment-chip', LyraAttachmentChip);
