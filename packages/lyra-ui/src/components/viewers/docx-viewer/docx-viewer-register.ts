import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

/** The stable tag `<lr-document-viewer>` upgrades a matched file to once `load` below settles --
 *  importing this register-only entry alone never registers the element itself. */
export const DOCX_VIEWER_TAG = tag('docx-viewer');

registerDocumentRenderer('application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.docx'),
  capabilities: { anchors: ['fragment', 'text-quote'], search: true, textSelect: true },
  load: () => import('./docx-viewer.js').then(() => ({
    render: (file: DocumentFile) => html`<lr-docx-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-docx-viewer>`,
  })),
});
