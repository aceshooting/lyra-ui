import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-calendar-viewer.js';
import type { LyraCalendarViewer } from '../../lr-calendar-viewer.js';
import type { LyraCalendarViewerEventRecord } from './calendar-viewer.class.js';

const SAMPLE_ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lyra-ui//test//EN', 'BEGIN:VEVENT', 'UID:fetched@example.test', 'DTSTAMP:20260701T090000Z', 'DTSTART:20260714T140000Z', 'SUMMARY:Fetched event', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');

function countingFetch(): { calls: () => number; restore: () => void } {
  const original = window.fetch;
  let calls = 0;
  window.fetch = (() => {
    calls++;
    return Promise.resolve(new Response(SAMPLE_ICS));
  }) as typeof window.fetch;
  return { calls: () => calls, restore: () => { window.fetch = original; } };
}

const summaries = (el: LyraCalendarViewer): string[] =>
  Array.from(el.shadowRoot!.querySelectorAll('[part="event-summary"]'), node => node.textContent ?? '');
const times = (el: LyraCalendarViewer): string[] =>
  Array.from(el.shadowRoot!.querySelectorAll('[part="event-time"]'), node => node.textContent ?? '');

async function withEvents(events: unknown, src = ''): Promise<LyraCalendarViewer> {
  const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer src=${src} .events=${events as LyraCalendarViewerEventRecord[]}></lr-calendar-viewer>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="event"], [part="error"], .empty-note') !== null);
  return el;
}

describe('lr-calendar-viewer plain events', () => {
  it('renders supplied plain events in supplied order as text', async () => {
    const el = await withEvents([
      { id: 'b', title: 'Later item', start: '2026-07-15T10:00:00Z', location: 'Room 9', description: 'Notes here.' },
      { id: 'a', title: 'Earlier item', start: '2026-07-14T10:00:00Z' },
    ]);
    expect(summaries(el)).to.deep.equal(['Later item', 'Earlier item']);
    expect(el.shadowRoot!.querySelector('[part="event-location"]')!.textContent).to.equal('Room 9');
    expect(el.shadowRoot!.querySelector('[part="event-description"]')!.textContent).to.equal('Notes here.');
    const formatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
    expect(times(el)[1]).to.equal(formatter.format(new Date('2026-07-14T10:00:00Z')));
  });

  it('never interprets record text as markup', async () => {
    const el = await withEvents([{ title: '<img src=x onerror="window.__lyraCalendarXss=1">', start: '2026-07-14T10:00:00Z', description: '<b>bold</b>' }]);
    expect(el.shadowRoot!.querySelectorAll('img, b').length).to.equal(0);
    expect(summaries(el)).to.deep.equal(['<img src=x onerror="window.__lyraCalendarXss=1">']);
    expect((window as unknown as Record<string, unknown>)['__lyraCalendarXss']).to.equal(undefined);
  });

  it('formats a date-time range and an all-day range with an exclusive end', async () => {
    const el = await withEvents([
      { title: 'Meeting', start: '2026-07-14T14:00:00Z', end: '2026-07-14T15:00:00Z' },
      { title: 'Retreat', start: '2026-07-14', end: '2026-07-17', allDay: true },
      { title: 'Holiday', start: '2026-07-14', allDay: true },
      { title: 'Date part only', start: '2026-07-20T09:30:00Z', allDay: true },
    ]);
    const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
    const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });
    expect(times(el)).to.deep.equal([
      dateTime.formatRange(new Date('2026-07-14T14:00:00Z'), new Date('2026-07-14T15:00:00Z')),
      date.formatRange(new Date(Date.UTC(2026, 6, 14)), new Date(Date.UTC(2026, 6, 16))),
      date.format(new Date(Date.UTC(2026, 6, 14))),
      date.format(new Date(Date.UTC(2026, 6, 20))),
    ]);
  });

  it('ignores invalid and reversed dates without dropping the event', async () => {
    const el = await withEvents([
      { title: 'No real date', start: 'tomorrow' },
      { title: 'Impossible day', start: '2026-02-30', allDay: true },
      { title: 'Impossible time', start: '2026-02-30T10:00:00Z' },
      { title: 'Reversed', start: '2026-07-14T14:00:00Z', end: '2026-07-14T13:00:00Z' },
      { title: 'Mixed kinds', start: '2026-07-14T14:00:00Z', end: '2026-07-15', allDay: false },
      { title: 'Number start', start: 1_700_000_000_000 },
    ]);
    expect(summaries(el)).to.deep.equal(['No real date', 'Impossible day', 'Impossible time', 'Reversed', 'Mixed kinds', 'Number start']);
    const single = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-07-14T14:00:00Z'));
    expect(times(el)).to.deep.equal(['', '', '', single, single, '']);
  });

  it('uses the localized fallback title and skips non-record entries', async () => {
    const el = await withEvents([null, 'text', 7, { title: 42, start: '2026-07-14T10:00:00Z' }, { title: '  ', location: 'Hall' }]);
    expect(summaries(el)).to.deep.equal(['(no title)', '(no title)']);
  });

  it('takes precedence over src and falls back to src once cleared', async () => {
    const network = countingFetch();
    try {
      const el = await withEvents([{ title: 'Supplied', start: '2026-07-14T10:00:00Z' }], 'https://example.test/calendar.ics');
      await aTimeout(20);
      expect(network.calls()).to.equal(0);
      expect(summaries(el)).to.deep.equal(['Supplied']);
      el.src = 'https://example.test/other.ics';
      await aTimeout(20);
      expect(network.calls()).to.equal(0);
      expect(summaries(el)).to.deep.equal(['Supplied']);
      el.events = null;
      await waitUntil(() => summaries(el)[0] === 'Fetched event');
      expect(network.calls()).to.equal(1);
    } finally { network.restore(); }
  });

  it('supersedes an in-flight src load', async () => {
    const original = window.fetch;
    let release!: (value: Response) => void;
    window.fetch = (() => new Promise<Response>(resolve => { release = resolve; })) as typeof window.fetch;
    try {
      const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer src="https://example.test/slow.ics"></lr-calendar-viewer>`);
      await waitUntil(() => release !== undefined);
      el.events = [{ title: 'Supplied', start: '2026-07-14T10:00:00Z' }];
      await waitUntil(() => summaries(el)[0] === 'Supplied');
      release(new Response(SAMPLE_ICS));
      await aTimeout(30);
      expect(summaries(el)).to.deep.equal(['Supplied']);
    } finally { window.fetch = original; }
  });

  it('fires lr-load for supplied events and shows the empty note for an empty array', async () => {
    const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer></lr-calendar-viewer>`);
    const loaded = oneEvent(el, 'lr-load');
    el.events = [];
    await loaded;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('This calendar has no events.');
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  it('enforces max-events and the rendered-text ceiling with the resource-limit message', async () => {
    const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer max-events="2"></lr-calendar-viewer>`);
    let failure = oneEvent(el, 'lr-render-error');
    el.events = Array.from({ length: 3 }, (_, index) => ({ title: `Item ${index}`, start: '2026-07-14T10:00:00Z' }));
    await failure;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
    el.maxEvents = 3;
    await waitUntil(() => summaries(el).length === 3);
    failure = oneEvent(el, 'lr-render-error');
    el.events = [{ title: 'x'.repeat(2 * 1024 * 1024 + 1), start: '2026-07-14T10:00:00Z' }];
    await failure;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
  });

  it('rejects a non-array events value with the localized failure state', async () => {
    const el = await fixture<LyraCalendarViewer>(html`<lr-calendar-viewer></lr-calendar-viewer>`);
    const failure = oneEvent(el, 'lr-render-error');
    el.events = { title: 'Not a list' } as unknown as LyraCalendarViewerEventRecord[];
    await failure;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load document.');
  });

  it('snapshots the supplied records at assignment', async () => {
    const records = [{ title: 'Original', start: '2026-07-14T10:00:00Z' }];
    const el = await withEvents(records);
    records[0]!.title = 'Mutated';
    el.requestUpdate();
    await el.updateComplete;
    expect(summaries(el)).to.deep.equal(['Original']);
  });

  it('isolates supplied text under RTL and is accessible', async () => {
    const el = await withEvents([{ title: 'اجتماع', start: '2026-07-14T10:00:00Z', location: 'Room 9', description: 'Agenda' }]);
    el.dir = 'rtl';
    await el.updateComplete;
    for (const part of ['event-summary', 'event-location', 'event-description', 'event-time']) {
      expect(getComputedStyle(el.shadowRoot!.querySelector(`[part="${part}"] bdi`)!).unicodeBidi, part).to.equal('isolate');
    }
    expect(el.shadowRoot!.querySelectorAll('[part="event"]')).to.have.lengthOf(1);
    await expect(el).to.be.accessible();
  });
});
