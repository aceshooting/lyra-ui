import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './calendar-viewer.js';
import type { LyraCalendarViewer } from './calendar-viewer.js';
import { getDefaultDocumentRendererRegistry } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

const SAMPLE_ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lyra-ui//test//EN', 'BEGIN:VEVENT', 'UID:event-1@example.test', 'DTSTAMP:20260701T090000Z', 'DTSTART:20260714T140000Z', 'DTEND:20260714T150000Z', 'SUMMARY:Quarterly planning', 'LOCATION:Room 204', 'DESCRIPTION:Review roadmap and budget.', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
const TWO_EVENTS = SAMPLE_ICS.replace('END:VCALENDAR', ['BEGIN:VEVENT', 'UID:event-2@example.test', 'DTSTAMP:20260701T090000Z', 'DTSTART:20260715T100000Z', 'DTEND:20260715T110000Z', 'SUMMARY:Design review', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
const EMPTY_ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lyra-ui//test//EN', 'END:VCALENDAR', ''].join('\r\n');

function response(body: string, ok = true): Response { return { ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', text: () => Promise.resolve(body) } as Response; }
function stubFetch(body: string): () => void { const original = window.fetch; window.fetch = (() => Promise.resolve(response(body))) as typeof window.fetch; return () => { window.fetch = original; }; }
async function loaded(body: string): Promise<{ el: LyraCalendarViewer; restore: () => void }> { const restore = stubFetch(body); const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer src="https://example.test/calendar.ics"></lr-calendar-viewer>`); await waitUntil(() => el.shadowRoot!.querySelector('[part="event"]') !== null || el.shadowRoot!.querySelector('[part="error"]') !== null); return { el, restore }; }

describe('lr-calendar-viewer', () => {
  it('renders a localized empty state by default', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer></lr-calendar-viewer>`); expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No calendar to display.'); });
  it('parses and renders events with plain text fields', async () => { const { el, restore } = await loaded(SAMPLE_ICS); try { expect(el.shadowRoot!.querySelectorAll('[part="event"]')).to.have.lengthOf(1); expect(el.shadowRoot!.querySelector('[part="event-summary"]')!.textContent).to.contain('Quarterly planning'); expect(el.shadowRoot!.querySelector('[part="event-location"]')!.textContent).to.contain('Room 204'); expect(el.shadowRoot!.querySelector('[part="event-description"]')!.textContent).to.contain('Review roadmap'); expect(el.shadowRoot!.querySelector('[part="event-time"]')!.textContent).to.not.equal(''); } finally { restore(); } });
  it('uses the locale date-range formatter instead of fixed punctuation', async () => {
    const restore = stubFetch(SAMPLE_ICS);
    try {
      const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer lang="ja" src="https://example.test/calendar.ics"></lr-calendar-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="event-time"]') !== null);
      const formatter = new Intl.DateTimeFormat('ja', { dateStyle: 'medium', timeStyle: 'short' });
      expect(el.shadowRoot!.querySelector('[part="event-time"]')!.textContent).to.equal(
        formatter.formatRange(new Date('2026-07-14T14:00:00Z'), new Date('2026-07-14T15:00:00Z')),
      );
    } finally { restore(); }
  });
  it('normalizes an end-before-start event to a single start instant', async () => {
    const reversed = SAMPLE_ICS.replace('DTEND:20260714T150000Z', 'DTEND:20260714T130000Z');
    const { el, restore } = await loaded(reversed);
    try {
      expect(el.shadowRoot!.querySelector('[part="event-time"]')!.textContent).to.equal(
        new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date('2026-07-14T14:00:00Z'),
        ),
      );
    } finally { restore(); }
  });
  it('rejects a calendar whose event count exceeds the retained-entry ceiling', async () => {
    const events = Array.from({ length: 10_001 }, (_unused, index) => [
      'BEGIN:VEVENT',
      `UID:${index}@example.test`,
      'DTSTART:20260714T140000Z',
      'SUMMARY:Event',
      'END:VEVENT',
    ].join('\r\n')).join('\r\n');
    const restore = stubFetch(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR\r\n`);
    try {
      const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer></lr-calendar-viewer>`);
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/large.ics';
      await event;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
    } finally { restore(); }
  });
  it('renders multiple events in source order', async () => { const { el, restore } = await loaded(TWO_EVENTS); try { expect(Array.from(el.shadowRoot!.querySelectorAll('[part="event-summary"]')).map((node) => node.textContent)).to.deep.equal(['Quarterly planning', 'Design review']); } finally { restore(); } });
  it('renders a non-error empty-note for a well-formed calendar with zero events, not the role="alert" error chrome', async () => {
    // Regression test: a well-formed .ics with no VEVENTs used to throw the same
    // LyraUserFacingError funneled through the generic catch block into `case 'error'` --
    // role="alert" and error-styled chrome for a state that isn't actually a failure.
    const restore = stubFetch(EMPTY_ICS);
    try {
      const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer></lr-calendar-viewer>`);
      let renderErrors = 0;
      el.addEventListener('lr-render-error', () => { renderErrors++; });
      el.src = 'https://example.test/calendar.ics';
      await waitUntil(() => el.shadowRoot!.querySelector('.empty-note')?.textContent === 'This calendar has no events.');
      expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('This calendar has no events.');
      expect(el.shadowRoot!.querySelectorAll('[part="error"]')).to.have.lengthOf(0);
      expect(renderErrors).to.equal(0);
    } finally {
      restore();
    }
  });
  it('rejects unsafe URLs, emits exactly one error event, and applies max-height', async () => {
    const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer max-height="20rem"></lr-calendar-viewer>`);
    let count = 0;
    el.addEventListener('lr-render-error', () => { count++; });
    const event = oneEvent(el, 'lr-render-error');
    el.src = 'java\tscript:alert(1)';
    await event;
    await aTimeout(0);
    expect(count).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue('--lr-calendar-viewer-max-height')).to.equal('20rem');
  });
  it('reloads the same source after reconnecting and restores its named region', async () => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => { calls++; return Promise.resolve(response(SAMPLE_ICS)); }) as typeof window.fetch;
    try {
      const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer src="https://example.test/calendar.ics"></lr-calendar-viewer>`);
      await waitUntil(() => calls === 1 && el.shadowRoot!.querySelector('[part="event"]') !== null);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => calls === 2);
      expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('region');
    } finally { window.fetch = original; }
  });
  it('supports localized empty-state strings', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer .strings=${{ documentPreviewEmpty: 'Aucun {type} à afficher.', documentPreviewTypeCalendar: 'calendrier' }}></lr-calendar-viewer>`); expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('Aucun calendrier à afficher.'); });
  it('is accessible', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer></lr-calendar-viewer>`); await expect(el).to.be.accessible(); });
  it('is accessible with events listed', async () => { const { el, restore } = await loaded(TWO_EVENTS); try { expect(el.shadowRoot!.querySelectorAll('[part="event"]')).to.have.lengthOf(2); await expect(el).to.be.accessible(); } finally { restore(); } });
  it('uses the name property as the accessible name of the base region', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer name="Team offsite.ics"></lr-calendar-viewer>`); expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Team offsite.ics'); });
  it('falls back to a host aria-label when name is unset', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer aria-label="Holiday schedule"></lr-calendar-viewer>`); expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Holiday schedule'); });
  it('lets a host aria-label override the name property', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer name="Team offsite.ics" aria-label="Host label"></lr-calendar-viewer>`); expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Host label'); });
  it('falls back to the localized calendarViewerLabel default when neither name nor a host aria-label is set', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer></lr-calendar-viewer>`); expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Calendar viewer'); });
  it('supports a .strings override for the calendarViewerLabel fallback', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer .strings=${{ calendarViewerLabel: 'Visionneuse de calendrier' }}></lr-calendar-viewer>`); expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Visionneuse de calendrier'); });
  it('forwards document anchors/highlights and advertises its text contracts', () => {
    const definition = getDefaultDocumentRendererRegistry().get('text/calendar')!;
    const highlights: LyraHighlight[] = [{ id: 'event', anchor: { kind: 'text-quote', exact: 'planning' } }];
    const anchor = { kind: 'fragment' as const, id: 'event' };
    const rendered = definition.render!({
      name: 'team.ics',
      mimeType: 'text/calendar',
      src: 'https://example.test/team.ics',
      anchor,
      highlights,
    }) as LyraCalendarViewer;
    expect(rendered.anchor).to.equal(anchor);
    expect(rendered.highlights).to.equal(highlights);
    expect(definition.capabilities).to.deep.equal({
      anchors: ['text-quote', 'fragment'],
      search: true,
      textSelect: true,
    });
  });
});
