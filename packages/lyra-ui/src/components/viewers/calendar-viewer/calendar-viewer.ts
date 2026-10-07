/** @deprecated Import @aceshooting/lyra-ui/components/lr-calendar-viewer.js to register this component. */
export * from './calendar-loader.js';
export * from './calendar-viewer.class.js';
import { html } from 'lit';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';
import { LyraCalendarViewer } from './calendar-viewer.class.js';
defineElement('calendar-viewer', LyraCalendarViewer);
registerDocumentRenderer('text/calendar', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.ics'),
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
  render: (file: LyraDocumentFile) => html`<lr-calendar-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-calendar-viewer>`,
});
