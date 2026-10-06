/** @deprecated Import @aceshooting/lyra-ui/components/lr-ebook-viewer.js to register this component. */
export * from './ebook-viewer.class.js';
import { LyraEbookViewer } from './ebook-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './ebook-viewer-register.js'; // also lets <lr-document-viewer> open this kind

defineElement('ebook-viewer', LyraEbookViewer);
