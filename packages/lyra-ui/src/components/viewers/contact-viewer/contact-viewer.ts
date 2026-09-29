/** @deprecated Import @aceshooting/lyra-ui/components/lr-contact-viewer.js to register this component. */
export * from './contact-viewer.class.js';
export * from './vcard.js';
import { LyraContactViewer } from './contact-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

defineElement('contact-viewer', LyraContactViewer);
registerDocumentRenderer('text/vcard', { matches: (file: LyraDocumentFile) => /\.vcf$/i.test(file.name), render: (file) => {
  const element = document.createElement('lr-contact-viewer');
  element.src = file.src;
  element.name = file.name;
  element.anchor = file.anchor ?? null;
  element.highlights = file.highlights ?? [];
  return element;
},
capabilities: {
  anchors: ['text-quote', 'fragment'],
  search: true,
  textSelect: true,
} });
