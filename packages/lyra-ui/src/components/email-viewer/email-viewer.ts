export * from './email-loader.js';
export * from './email-viewer.class.js';
import { html } from 'lit';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import { LyraEmailViewer } from './email-viewer.class.js';
defineElement('email-viewer', LyraEmailViewer);

registerDocumentRenderer('message/rfc822', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.eml'),
  render: (file: DocumentFile) => html`<lyra-email-viewer src=${file.src} name=${file.name}></lyra-email-viewer>`,
});
