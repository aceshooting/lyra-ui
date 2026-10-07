import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

export const EMAIL_VIEWER_TAG = tag('email-viewer');

registerDocumentRenderer('message/rfc822', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.eml'),
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
  load: () => import('./email-viewer.js').then(() => ({
    render: (file: LyraDocumentFile) => html`<lr-email-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-email-viewer>`,
  })),
});
