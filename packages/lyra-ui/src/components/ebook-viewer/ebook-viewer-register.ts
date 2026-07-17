import { html } from 'lit';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

registerDocumentRenderer('application/epub+zip', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.epub'),
  load: () => import('./ebook-viewer.js').then(() => ({
    render: (file: DocumentFile) => html`<lyra-ebook-viewer src=${file.src} name=${file.name}></lyra-ebook-viewer>`,
    capabilities: { anchors: ['cfi', 'text-quote'], search: true, textSelect: true },
  })),
});
