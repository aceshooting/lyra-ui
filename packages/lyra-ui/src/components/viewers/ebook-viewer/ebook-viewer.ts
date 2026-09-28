/** @deprecated Import @aceshooting/lyra-ui/components/lr-ebook-viewer.js to register this component. */
export * from './ebook-viewer.class.js';
import { LyraEbookViewer } from './ebook-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('ebook-viewer', LyraEbookViewer);
