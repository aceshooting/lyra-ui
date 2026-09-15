import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

/** The stable tag `<lr-document-viewer>` upgrades a matched file to once `load` below settles --
 *  importing this register-only entry alone never registers the element itself. */
export const CSV_VIEWER_TAG = tag('csv-viewer');

registerDocumentRenderer('text/csv', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.csv'),
  capabilities: { anchors: ['cell-range'], search: true, textSelect: false },
  load: () => import('./csv-viewer.js').then(() => ({
    render: (file: DocumentFile) => html`<lr-csv-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-csv-viewer>`,
  })),
});
