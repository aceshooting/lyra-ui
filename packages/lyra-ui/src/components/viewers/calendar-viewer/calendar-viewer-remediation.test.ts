import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './calendar-viewer.js';
import type { LyraCalendarViewer } from './calendar-viewer.js';

for (const year of ['0001', '0099', '0100']) {
  it(`loads ${year} all-day ICS through the real peer and preserves exclusive DTEND`, async () => {
    const original = window.fetch;
    window.fetch = (async () => new Response([
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:early',
      `DTSTART;VALUE=DATE:${year}0714`, `DTEND;VALUE=DATE:${year}0716`,
      'SUMMARY:Early event', 'END:VEVENT', 'END:VCALENDAR', '',
    ].join('\r\n'))) as typeof window.fetch;
    try {
      const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer lang="en" src="https://example.test/early.ics"></lr-calendar-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="event"], [part="error"]') !== null, undefined, { timeout: 10000 });
      expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
      const from = new Date(0);
      from.setUTCFullYear(Number(year), 6, 14);
      const to = new Date(0);
      to.setUTCFullYear(Number(year), 6, 15);
      const formatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
      expect(el.shadowRoot!.querySelector('[part="event-time"]')!.textContent).to.equal(formatter.formatRange(from, to));
    } finally { window.fetch = original; }
  });
}
