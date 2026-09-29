import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

/** The stable tag `<lr-document-viewer>` upgrades a matched file to once `load` below settles --
 *  importing this register-only entry alone never registers the element itself. */
export const ARCHIVE_VIEWER_TAG = tag('archive-viewer');

const isZipFile = (file: DocumentFile): boolean => file.name.toLowerCase().endsWith('.zip');
const renderArchiveViewer = (file: DocumentFile) => html`<lr-archive-viewer
  src=${file.src}
  name=${file.name}
  .anchor=${file.anchor ?? null}
  .highlights=${file.highlights ?? []}
></lr-archive-viewer>`;
const load = () => import('./archive-viewer.js').then(() => ({ render: renderArchiveViewer }));

registerDocumentRenderer('application/zip', {
  matches: isZipFile,
  load,
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
});
registerDocumentRenderer('application/x-zip-compressed', {
  matches: isZipFile,
  load,
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
});
