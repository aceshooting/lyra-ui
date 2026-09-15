import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

/** The stable tag `<lr-document-viewer>` upgrades a matched file to once `load` below settles --
 *  importing this register-only entry alone never registers the element itself. */
export const PDF_VIEWER_TAG = tag('pdf-viewer');

registerDocumentRenderer('application/pdf', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.pdf'),
  capabilities: { anchors: ['page', 'text-quote', 'region'], textSelect: true, search: true },
  load: () => import('./pdf-viewer.js').then(() => ({
    render: (file: DocumentFile) => html`<lr-pdf-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-pdf-viewer>`,
  })),
});
