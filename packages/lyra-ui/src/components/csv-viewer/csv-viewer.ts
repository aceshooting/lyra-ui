export * from './csv-viewer.class.js';
import { html } from 'lit';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import { LyraCsvViewer } from './csv-viewer.class.js';

defineElement('csv-viewer', LyraCsvViewer);
registerDocumentRenderer('text/csv', { matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.csv'), render: (file: DocumentFile) => html`<lyra-csv-viewer src=${file.src} name=${file.name}></lyra-csv-viewer>` });
