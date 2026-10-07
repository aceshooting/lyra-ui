/** @deprecated Import @aceshooting/lyra-ui/components/lr-email-viewer.js to register this component. */
export * from './email-loader.js';
export * from './email-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './email-viewer-register.js';
import { LyraEmailViewer } from './email-viewer.class.js';
defineElement('email-viewer', LyraEmailViewer);
