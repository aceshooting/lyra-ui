/** @deprecated Import @aceshooting/lyra-ui/components/lr-html-viewer.js to register this component. */
export * from './html-viewer.class.js';
import { LyraHtmlViewer } from './html-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './html-viewer-register.js';

defineElement('html-viewer', LyraHtmlViewer);
