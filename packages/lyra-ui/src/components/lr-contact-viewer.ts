export * from './viewers/contact-viewer/contact-viewer.class.js';
export { parseVCards, type ParseVCardsOptions, type VCardAddress, type VCardContact, type VCardName, type VCardTypedValue } from './viewers/contact-viewer/vcard.js';
import { LyraContactViewer } from './viewers/contact-viewer/contact-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './viewers/contact-viewer/contact-viewer-register.js';

defineElement('contact-viewer', LyraContactViewer);
