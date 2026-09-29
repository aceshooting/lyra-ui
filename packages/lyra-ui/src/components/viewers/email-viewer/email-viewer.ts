/** @deprecated Import @aceshooting/lyra-ui/components/lr-email-viewer.js to register this component. */
export * from './email-loader.js';
export * from './email-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';
import { LyraEmailViewer } from './email-viewer.class.js';
defineElement('email-viewer', LyraEmailViewer);

registerDocumentRenderer('message/rfc822', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.eml'),
  render: (file: LyraDocumentFile) => {
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
