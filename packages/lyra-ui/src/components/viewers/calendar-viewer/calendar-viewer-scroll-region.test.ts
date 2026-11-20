import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-calendar-viewer.js';
import type { LyraCalendarViewer } from '../../lr-calendar-viewer.js';

const events = Array.from({ length: 12 }, (_, i) => ['BEGIN:VEVENT', `UID:e${i}@example.test`, 'DTSTAMP:20260701T090000Z', `DTSTART:202607${String(10 + i).padStart(2, '0')}T140000Z`, `SUMMARY:Event ${i}`, 'END:VEVENT'].join('\r\n'));
const ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lyra-ui//test//EN', ...events, 'END:VCALENDAR', ''].join('\r\n');

describe('capped viewer bodies are keyboard scrollable', () => {
  it('lr-calendar-viewer body gets a tab stop only while it overflows', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(ICS) } as Response)) as typeof window.fetch;
    try {
      const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer max-height="80px" src="https://example.test/c.ics"></lr-calendar-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="event"]') !== null);
      const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
      await waitUntil(() => body.getAttribute('tabindex') === '0', 'overflowing body never became focusable');
      expect(body.getAttribute('role')).to.equal('region');
      expect(body.getAttribute('aria-label') ?? '').to.not.equal('');
      el.style.setProperty('--lr-calendar-viewer-max-height', 'none');
      el.maxHeight = 'none';
      await waitUntil(() => !body.hasAttribute('tabindex'), 'short body kept its tab stop');
    } finally {
      window.fetch = original;
    }
  });
});
