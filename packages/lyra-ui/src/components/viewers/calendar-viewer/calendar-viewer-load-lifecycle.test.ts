import { html } from '@open-wc/testing';
import { describeViewerResponseLifecycle } from '../../../../test/contracts/viewer-response-lifecycle.js';
import { loadIcal } from './calendar-loader.js';
import './calendar-viewer.js';

describeViewerResponseLifecycle('lr-calendar-viewer', html`<lr-calendar-viewer></lr-calendar-viewer>`, {
  extension: 'ics', contentSelector: '[part="event-summary"]', preload: loadIcal,
  source: label => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lyra-ui//test//EN',
    'BEGIN:VEVENT', `UID:${label}@example.test`, 'DTSTAMP:20260701T090000Z',
    'DTSTART:20260714T140000Z', 'DTEND:20260714T150000Z', `SUMMARY:${label}`,
    'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n'),
});
