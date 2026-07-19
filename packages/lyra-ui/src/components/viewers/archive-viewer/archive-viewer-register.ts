import { html } from 'lit';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

const isZipFile = (file: DocumentFile): boolean => file.name.toLowerCase().endsWith('.zip');
const renderArchiveViewer = (file: DocumentFile) => html`<lr-archive-viewer src=${file.src} name=${file.name}></lr-archive-viewer>`;
const load = () => import('./archive-viewer.js').then(() => ({ render: renderArchiveViewer }));

registerDocumentRenderer('application/zip', { matches: isZipFile, load });
registerDocumentRenderer('application/x-zip-compressed', { matches: isZipFile, load });
