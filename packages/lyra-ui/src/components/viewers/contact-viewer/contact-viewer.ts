export * from './contact-viewer.class.js';
export * from './vcard.js';
import { LyraContactViewer } from './contact-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

defineElement('contact-viewer', LyraContactViewer);
registerDocumentRenderer('text/vcard', { matches: (file: DocumentFile) => /\.vcf$/i.test(file.name), render: (file) => {
  const element = document.createElement('lr-contact-viewer');
  element.src = file.src;
  element.name = file.name;
  return element;
} });
