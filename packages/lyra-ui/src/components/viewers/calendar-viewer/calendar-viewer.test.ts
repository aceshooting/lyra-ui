import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './calendar-viewer.js';
import type { LyraCalendarViewer } from './calendar-viewer.js';
import { getDefaultDocumentRendererRegistry } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

const SAMPLE_ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lyra-ui//test//EN', 'BEGIN:VEVENT', 'UID:event-1@example.test', 'DTSTAMP:20260701T090000Z', 'DTSTART:20260714T140000Z', 'DTEND:20260714T150000Z', 'SUMMARY:Quarterly planning', 'LOCATION:Room 204', 'DESCRIPTION:Review roadmap and budget.', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
const TWO_EVENTS = SAMPLE_ICS.replace('END:VCALENDAR', ['BEGIN:VEVENT', 'UID:event-2@example.test', 'DTSTAMP:20260701T090000Z', 'DTSTART:20260715T100000Z', 'DTEND:20260715T110000Z', 'SUMMARY:Design review', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
const EMPTY_ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lyra-ui//test//EN', 'END:VCALENDAR', ''].join('\r\n');
const SPARSE_ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lyra-ui//test//EN', 'BEGIN:VEVENT', 'DTSTAMP:20260701T090000Z', 'DTSTART:20260714T140000Z', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');

function response(body: string, ok = true): Response { return { ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', text: () => Promise.resolve(body) } as Response; }
function stubFetch(body: string, ok = true): () => void { const original = window.fetch; window.fetch = (() => Promise.resolve(response(body, ok))) as typeof window.fetch; return () => { window.fetch = original; }; }
async function loaded(body: string): Promise<{ el: LyraCalendarViewer; restore: () => void }> { const restore = stubFetch(body); const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer src="https://example.test/calendar.ics"></lr-calendar-viewer>`); await waitUntil(() => el.shadowRoot!.querySelector('[part="event"]') !== null || el.shadowRoot!.querySelector('[part="error"]') !== null, undefined, { timeout: 5000 }); return { el, restore }; }

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
  it('preserves DATE semantics and treats an all-day DTEND as exclusive', async () => {
    const allDay = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:all-day',
      'DTSTART;VALUE=DATE:20260714', 'DTEND;VALUE=DATE:20260717', 'SUMMARY:Retreat',
      'END:VEVENT', 'END:VCALENDAR', '',
    ].join('\r\n');
    const { el, restore } = await loaded(allDay);
    try {
      const formatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
      expect(el.shadowRoot!.querySelector('[part="event-time"]')!.textContent).to.equal(
        formatter.formatRange(new Date(Date.UTC(2026, 6, 14)), new Date(Date.UTC(2026, 6, 16))),
      );
      const state = (el as unknown as {
        fetchState: { kind: 'loaded'; events: Array<{ startKind: string; endKind: string }> };
      }).fetchState;
      expect(state.events[0]).to.include({ startKind: 'date', endKind: 'date' });
    } finally { restore(); }
  });
  it('formats a one-day all-day event without a fabricated midnight time or extra day', async () => {
    const allDay = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260714', 'DTEND;VALUE=DATE:20260715', 'SUMMARY:Holiday',
      'END:VEVENT', 'END:VCALENDAR', '',
    ].join('\r\n');
    const { el, restore } = await loaded(allDay);
    try {
      const expected = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })
        .format(new Date(Date.UTC(2026, 6, 14)));
      expect(el.shadowRoot!.querySelector('[part="event-time"]')!.textContent).to.equal(expected);
    } finally { restore(); }
  });
  it('renders sparse valid events with a localizable fallback summary and no empty optional chrome', async () => {
    const restore = stubFetch(SPARSE_ICS);
    try {
      const el = await fixture<LyraCalendarViewer>(html`
        <lr-calendar-viewer
          src="https://example.test/sparse.ics"
          .strings=${{ calendarViewerNoSummary: 'Untitled calendar event' }}
        ></lr-calendar-viewer>
      `);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="event"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="event-summary"]')!.textContent).to.equal(
        'Untitled calendar event',
      );
      expect(el.shadowRoot!.querySelectorAll('[part="event-location"]')).to.have.lengthOf(0);
      expect(el.shadowRoot!.querySelectorAll('[part="event-description"]')).to.have.lengthOf(0);
    } finally { restore(); }
  });
  it('uses its localized failed-load state when the calendar response is not OK', async () => {
    const restore = stubFetch('', false);
    try {
      const el = await fixture<LyraCalendarViewer>(html`
        <lr-calendar-viewer
          .strings=${{ documentPreviewFailedToLoad: 'Calendar could not be loaded.' }}
        ></lr-calendar-viewer>
      `);
      const failure = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/missing.ics';
      await failure;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'Calendar could not be loaded.',
      );
    } finally { restore(); }
  });
  it('rejects a calendar whose event count exceeds the retained-entry ceiling', async () => {
    const events = Array.from({ length: 251 }, (_unused, index) => [
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
  it('renders a non-error empty-note for a well-formed calendar with zero events, not assertively-announced error chrome', async () => {
    // Regression test: a well-formed .ics with no VEVENTs used to throw the same
    // LyraUserFacingError funneled through the generic catch block into `case 'error'` --
    // an assertive announcement and error-styled chrome for a state that isn't actually a failure.
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
    expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.be.true;
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
  it('leaves a non-empty accessible name on the host instead of copying it to the shadow region', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer aria-label="Holiday schedule"></lr-calendar-viewer>`); const base = el.shadowRoot!.querySelector('[part="base"]')!; expect(base.getAttribute('aria-label')).to.be.null; expect(base.getAttribute('role')).to.be.null; expect(el.getAttribute('aria-label')).to.equal('Holiday schedule'); });
  it('lets a host aria-label override the name property without creating a second owner', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer name="Team offsite.ics" aria-label="Host label"></lr-calendar-viewer>`); const base = el.shadowRoot!.querySelector('[part="base"]')!; expect(base.getAttribute('aria-label')).to.be.null; expect(base.getAttribute('role')).to.be.null; });
  it('preserves an explicitly empty host aria-label ahead of name', async () => { const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer name="Team offsite.ics" aria-label=""></lr-calendar-viewer>`); const base = el.shadowRoot!.querySelector('[part="base"]')!; expect(base.hasAttribute('aria-label')).to.be.true; expect(base.getAttribute('aria-label')).to.equal(''); });
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

it('validates maxHeight before assigning the base custom property', async () => {
  const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer></lr-calendar-viewer>`);
  el.maxHeight = '10rem;position:fixed';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal('');
  expect(base.style.getPropertyValue('--lr-calendar-viewer-max-height')).to.equal('');
  el.maxHeight = 'calc(10rem + 2px)';
  await el.updateComplete;
  expect(base.style.getPropertyValue('--lr-calendar-viewer-max-height')).to.equal('calc(10rem + 2px)');
});

// -- Document-renderer registry entry ---------------------------------------

it('registers a text/calendar renderer whose matches() and render() behave as declared', async () => {
  const { getDefaultDocumentRendererRegistry } = await import('../document-viewer/registry.js');
  const def = getDefaultDocumentRendererRegistry().get('text/calendar');
  expect(def, 'importing the module registers the renderer').to.exist;
  expect(def!.matches!({ name: 'Sprint.ICS', mimeType: 'text/calendar', src: 'https://example.test/f' }), 'Sprint.ICS').to.be.true;
  expect(def!.matches!({ name: 'sprint.txt', mimeType: 'text/plain', src: 'https://example.test/f' }), 'sprint.txt').to.be.false;
  expect(def!.capabilities, 'capabilities are declared for host feature-detection').to.exist;

  const host = (await fixture(html`<div>${def!.render!({
    name: 'Sprint.ICS', mimeType: 'text/calendar', src: 'https://example.test/f',
  })}</div>`)) as HTMLElement;
  expect(host.querySelector('lr-calendar-viewer'), 'render() produces the viewer element').to.exist;
});
