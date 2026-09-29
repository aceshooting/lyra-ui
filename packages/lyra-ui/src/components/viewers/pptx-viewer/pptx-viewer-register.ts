import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

/** The stable tag `<lr-document-viewer>` upgrades a matched file to once `load` below settles --
 *  importing this register-only entry alone never registers the element itself. */
export const PPTX_VIEWER_TAG = tag('pptx-viewer');

registerDocumentRenderer('application/vnd.openxmlformats-officedocument.presentationml.presentation', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.pptx'),
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
  load: () => import('./pptx-viewer.js').then(() => ({
    render: (file: DocumentFile) => html`<lr-pptx-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-pptx-viewer>`,
  })),
});
