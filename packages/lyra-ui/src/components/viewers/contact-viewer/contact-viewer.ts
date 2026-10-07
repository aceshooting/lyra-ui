/** @deprecated Import @aceshooting/lyra-ui/components/lr-contact-viewer.js to register this component. */
export * from './contact-viewer.class.js';
export * from './vcard.js';
import { LyraContactViewer } from './contact-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './contact-viewer-register.js';

defineElement('contact-viewer', LyraContactViewer);
