import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import {
  registerDocumentRenderer,
  type DocumentFile,
  type LazyDocumentRendererDefinition,
} from '../document-viewer/registry.js';

/** The stable tag `<lr-document-viewer>` upgrades a matched file to once `load` below settles --
 *  importing this register-only entry alone never registers the element itself. */
export const SPREADSHEET_VIEWER_TAG = tag('spreadsheet-viewer');

const matches = (file: DocumentFile): boolean => /\.xlsx?$/i.test(file.name);
const renderer: LazyDocumentRendererDefinition = {
  matches,
  capabilities: { anchors: ['cell-range'], search: true, textSelect: false },
  load: () => import('./spreadsheet-viewer.js').then(() => ({
    render: (file: DocumentFile) => html`<lr-spreadsheet-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-spreadsheet-viewer>`,
  })),
};
registerDocumentRenderer('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', renderer);
registerDocumentRenderer('application/vnd.ms-excel', renderer);
