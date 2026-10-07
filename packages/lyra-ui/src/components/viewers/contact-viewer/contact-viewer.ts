/** @deprecated Import @aceshooting/lyra-ui/components/lr-contact-viewer.js to register this component. */
export * from './contact-viewer.class.js';
export * from './vcard.js';
import { html } from 'lit';
import { LyraContactViewer } from './contact-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

defineElement('contact-viewer', LyraContactViewer);
registerDocumentRenderer('text/vcard', {
  matches: (file: LyraDocumentFile) => /\.vcf$/i.test(file.name),
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
  render: (file: LyraDocumentFile) => html`<lr-contact-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-contact-viewer>`,
});
