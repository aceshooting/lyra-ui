import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

export const CONTACT_VIEWER_TAG = tag('contact-viewer');

registerDocumentRenderer('text/vcard', {
  matches: (file: LyraDocumentFile) => /\.vcf$/i.test(file.name),
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
  load: () => import('./contact-viewer.js').then(() => ({
    render: (file: LyraDocumentFile) => html`<lr-contact-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-contact-viewer>`,
  })),
});
