import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

/** The stable tag `<lr-document-viewer>` upgrades a matched file to once `load` below settles --
 *  importing this register-only entry alone never registers the element itself. */
export const EBOOK_VIEWER_TAG = tag('ebook-viewer');

registerDocumentRenderer('application/epub+zip', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.epub'),
  load: () => import('./ebook-viewer.js').then(() => ({
    render: (file: DocumentFile) => html`
      <lr-ebook-viewer
        src=${file.src}
        name=${file.name}
        .anchor=${file.anchor ?? null}
        .highlights=${file.highlights ?? []}
      ></lr-ebook-viewer>
    `,
    capabilities: { anchors: ['cfi', 'text-quote'], search: true, textSelect: true },
  })),
});
