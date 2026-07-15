export * from './calendar-loader.js';
export * from './calendar-viewer.class.js';
import { html } from 'lit';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import { LyraCalendarViewer } from './calendar-viewer.class.js';
defineElement('calendar-viewer', LyraCalendarViewer);
registerDocumentRenderer('text/calendar', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.ics'),
  render: (file: DocumentFile) => html`<lyra-calendar-viewer src=${file.src} name=${file.name}></lyra-calendar-viewer>`,
});
