/** @deprecated Import @aceshooting/lyra-ui/components/lr-email-viewer.js to register this component. */
export * from './email-loader.js';
export * from './email-viewer.class.js';
import { html } from 'lit';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';
import { LyraEmailViewer } from './email-viewer.class.js';
defineElement('email-viewer', LyraEmailViewer);

registerDocumentRenderer('message/rfc822', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.eml'),
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
  render: (file: LyraDocumentFile) => html`<lr-email-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-email-viewer>`,
});
