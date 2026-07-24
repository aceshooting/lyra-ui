export * from './email-loader.js';
export * from './email-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import { LyraEmailViewer } from './email-viewer.class.js';
defineElement('email-viewer', LyraEmailViewer);

registerDocumentRenderer('message/rfc822', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.eml'),
  render: (file: DocumentFile) => {
    const element = document.createElement('lr-email-viewer');
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
  },
});
