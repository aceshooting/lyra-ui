/** @deprecated Import @aceshooting/lyra-ui/components/lr-document-preview.js to register this component. */
export * from './document-preview.class.js';
import { LyraDocumentPreview } from './document-preview.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../media/pan-zoom/pan-zoom.js';
defineElement('document-preview', LyraDocumentPreview);
