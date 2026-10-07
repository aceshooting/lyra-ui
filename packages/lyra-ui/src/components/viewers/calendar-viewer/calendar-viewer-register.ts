import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

export const CALENDAR_VIEWER_TAG = tag('calendar-viewer');

registerDocumentRenderer('text/calendar', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.ics'),
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
  load: () => import('./calendar-viewer.js').then(() => ({
    render: (file: LyraDocumentFile) => html`<lr-calendar-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-calendar-viewer>`,
  })),
});
