/** @deprecated Import @aceshooting/lyra-ui/components/lr-calendar-viewer.js to register this component. */
export * from './calendar-loader.js';
export * from './calendar-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';
import { LyraCalendarViewer } from './calendar-viewer.class.js';
defineElement('calendar-viewer', LyraCalendarViewer);
registerDocumentRenderer('text/calendar', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.ics'),
  render: (file: LyraDocumentFile) => {
    const element = document.createElement('lr-calendar-viewer');
    element.src = file.src;
    element.name = file.name;
    element.anchor = file.anchor ?? null;
    element.highlights = file.highlights ?? [];
    return element;
  },
  capabilities: {
    anchors: ['text-quote', 'fragment'],
    search: true,
    textSelect: true,
  },
});
