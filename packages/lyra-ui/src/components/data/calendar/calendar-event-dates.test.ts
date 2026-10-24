import { expect, fixture, html } from '@open-wc/testing';
import { sinkTexts } from '../../../../test/announcements.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import './calendar.js';
import type { CalendarEvent, LyraCalendar } from './calendar.class.js';

function agendaTitles(el: LyraCalendar): string[] {
  return [...el.shadowRoot!.querySelectorAll('[part="agenda-event"]')]
    .map((event) => event.textContent!.replace(/\s+/g, ' ').trim());
}

describe('lr-calendar event dates', () => {
  it('places string, numeric and Date instants and drops values that are not instants', async () => {
    const day = (date: number) => new Date(2026, 2, date);
    const events = [
      { date: '2026-03-05', title: 'String' },
      { date: day(6).getTime(), title: 'Numeric' },
      { date: day(7), title: 'Date object' },
      { date: 'not a date', title: 'Bad string' },
      { date: Number.NaN, title: 'Bad number' },
      { date: Number.POSITIVE_INFINITY, title: 'Infinite number' },
      { date: 8.64e15 + 1, title: 'Beyond the Date range' },
      { date: new Date(Number.NaN), title: 'Invalid Date' },
      { date: true, title: 'Boolean' },
      { date: null, title: 'Null' },
      { date: { toString: () => '2026-03-08' }, title: 'Plain object' },
    ] as unknown as CalendarEvent[];
    const el = await fixture<LyraCalendar>(html`<lr-calendar view="agenda" view-date="2026-03-01" .events=${events}></lr-calendar>`);
    const titles = agendaTitles(el);
    expect(titles).to.have.length(3);
    expect(titles[0]).to.contain('String');
    expect(titles[1]).to.contain('Numeric');
    expect(titles[2]).to.contain('Date object');
    el.view = 'month';
    await el.updateComplete;
    expect([...el.shadowRoot!.querySelectorAll('[part="event"]')].map((event) => event.textContent!.trim()))
      .to.deep.equal(['String', 'Numeric', 'Date object']);
  });
});

describe('lr-calendar input limit announcement', () => {
  const oversized = () => Array.from({ length: 10_001 }, () => ({ date: '2026-01-01', title: 'Event' }));

  it('announces a limit that arrives after mount once, not on every repeated assignment', async () => {
    // The 10,001-entry assignment deliberately exercises the documented truncation warning.
    expectDevWarning('lyra-collection-truncated:lr-calendar:events');
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-01-01" .strings=${{ calendarInputLimit: 'Calendar input limited' }}></lr-calendar>`);
    const announced = () => sinkTexts().filter((text) => text.includes('Calendar input limited')).length;
    const before = announced();
    el.events = oversized();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.contain('Calendar input limited');
    expect(announced()).to.equal(before + 1);
    el.events = oversized();
    await el.updateComplete;
    expect(announced()).to.equal(before + 1);
  });
});
