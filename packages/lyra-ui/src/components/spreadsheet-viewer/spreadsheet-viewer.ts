export * from './spreadsheet-viewer.class.js';
export * from './spreadsheet-loader.js';
import { html } from 'lit';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import { LyraSpreadsheetViewer } from './spreadsheet-viewer.class.js';

defineElement('spreadsheet-viewer', LyraSpreadsheetViewer);
const matches = (file: DocumentFile): boolean => /\.xlsx?$/i.test(file.name);
const renderer = { matches, render: (file: DocumentFile) => html`<lyra-spreadsheet-viewer src=${file.src} name=${file.name}></lyra-spreadsheet-viewer>` };
registerDocumentRenderer('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', renderer);
registerDocumentRenderer('application/vnd.ms-excel', renderer);
