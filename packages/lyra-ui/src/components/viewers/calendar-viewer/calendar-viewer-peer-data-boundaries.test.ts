import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { loadIcal, type IcalTimeApi } from './calendar-loader.js';
import type { LyraCalendarViewer } from './calendar-viewer.class.js';
import './calendar-viewer.js';

const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:valid',
  'DTSTART;VALUE=DATE:20260102', 'SUMMARY:Recovered event', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
const day: IcalTimeApi = { isDate: true, year: 2026, month: 1, day: 2, toJSDate: () => new Date(Date.UTC(2026, 0, 2)) };

for (const kind of ['missing', 'rolled date', 'invalid instant', 'date without end', 'mixed end'] as const) {
  it(`keeps a calendar event readable when its peer supplies ${kind} time data and recovers on replacement`, async () => {
    const api = await loadIcal();
    if (!api) throw new Error('The calendar peer is unavailable.');
    const OriginalEvent = api.Event;
    const originalFetch = window.fetch;
    const start = kind === 'missing' ? undefined : kind === 'rolled date'
      ? { ...day, month: 2, day: 30 } : kind === 'invalid instant'
        ? { isDate: false, toJSDate: () => new Date(NaN) } : day;
    const end = kind === 'mixed end' ? { isDate: false, toJSDate: () => new Date(Date.UTC(2026, 0, 3, 12)) } : undefined;
    api.Event = class {
      readonly summary = 'Peer event';
      readonly startDate = start;
      readonly endDate = end;
    };
    window.fetch = async () => new Response(calendar);
    try {
      const element = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer src="https://example.test/peer-calendar.ics"></lr-calendar-viewer>`);
      await waitUntil(() => element.shadowRoot!.querySelector('[part="event-summary"]')?.textContent === 'Peer event');
      const expected = kind === 'date without end' || kind === 'mixed end'
        ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 2))) : '';
      expect(element.shadowRoot!.querySelector('[part="event-time"]')?.textContent).to.equal(expected);
      expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
      expect(await element.search('Peer event')).to.equal(1);
      api.Event = OriginalEvent;
      element.src = 'https://example.test/recovered-calendar.ics';
      await waitUntil(() => element.shadowRoot!.querySelector('[part="event-summary"]')?.textContent === 'Recovered event');
      expect(await element.search('Recovered event')).to.equal(1);
      expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    } finally { api.Event = OriginalEvent; window.fetch = originalFetch; }
  });
}

it('rejects an over-limit event collection returned by the calendar peer before constructing events', async () => {
  const api = await loadIcal();
  if (!api) throw new Error('The calendar peer is unavailable.');
  const OriginalComponent = api.Component;
  const OriginalEvent = api.Event;
  const originalFetch = window.fetch;
  let constructions = 0;
  api.Component = class { getAllSubcomponents() { return Array.from({ length: 251 }, () => ({})); } };
  api.Event = class { readonly summary = 'Unexpected'; constructor() { constructions++; } };
  window.fetch = async () => new Response(calendar);
  try {
    const element = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer
      .strings=${{ documentPreviewResourceTooLarge: 'Calendar exceeds limits' }}
    ></lr-calendar-viewer>`);
    const failed = oneEvent(element, 'lr-render-error');
    element.src = 'https://example.test/oversized-peer-calendar.ics';
    await failed;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Calendar exceeds limits');
    expect(constructions).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('[part="event"]').length).to.equal(0);
    api.Component = OriginalComponent;
    api.Event = OriginalEvent;
    element.src = 'https://example.test/recovered-calendar.ics';
    await waitUntil(() => element.shadowRoot!.querySelector('[part="event-summary"]')?.textContent === 'Recovered event');
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  } finally { api.Component = OriginalComponent; api.Event = OriginalEvent; window.fetch = originalFetch; }
});
