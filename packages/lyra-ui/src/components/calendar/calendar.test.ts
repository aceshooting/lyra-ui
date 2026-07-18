import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './calendar.js';
import type { LyraCalendar } from './calendar.js';
import { formatISO } from '../date-picker/calendar-core.js';

it('renders a month and emits date selections', async () => {
  const el = (await fixture(html`<lyra-calendar view-date="2026-07-01"></lyra-calendar>`)) as LyraCalendar;
  expect(el.shadowRoot!.querySelectorAll('[part="day"]')).to.have.length(42);
  const selected = oneEvent(el, 'lyra-date-select');
  (el.shadowRoot!.querySelector('[data-date="2026-07-15"]') as HTMLElement).click();
  expect((await selected).detail.date).to.equal('2026-07-15');
});

it('keeps exactly one focusable day after navigating the view away from any anchor date', async () => {
  // Regression test: the roving tab stop was `focusedDate || value || today`
  // with no fallback -- a visible month containing none of those three
  // (e.g. three months forward from a fresh calendar with no selection and
  // no prior keyboard focus) left zero cells with tabindex="0", making the
  // whole grid keyboard-unreachable.
  const el = (await fixture(html`<lyra-calendar></lyra-calendar>`)) as LyraCalendar;
  await el.updateComplete;
  const next = el.shadowRoot!.querySelector('[part="nav"] button') as HTMLButtonElement;
  for (let i = 0; i < 3; i++) {
    next.click();
    await el.updateComplete;
  }
  const focusable = el.shadowRoot!.querySelectorAll('[part="day"][tabindex="0"]');
  expect(focusable, 'expected exactly one focusable day after navigating three months forward').to.have.length(1);
  const now = new Date();
  const expectedFirstOfMonth = formatISO(new Date(now.getFullYear(), now.getMonth() + 3, 1));
  expect((focusable[0] as HTMLElement).dataset.date).to.equal(expectedFirstOfMonth);
});

it('rolls the view to the next month when ArrowDown moves focus past the bottom of the 6-week grid', async () => {
  // Regression test: arrow-key navigation only advanced focusedDate, never
  // viewDate -- moving past the grid's last rendered row (August 9, the
  // trailing edge of the July grid: Jun 29 - Aug 9) left focusedDate
  // pointing at a date with no matching cell anywhere on screen, a
  // keyboard dead end.
  const el = (await fixture(html`<lyra-calendar view-date="2026-07-01"></lyra-calendar>`)) as LyraCalendar;
  await el.updateComplete;
  const aug7 = el.shadowRoot!.querySelector('[data-date="2026-08-07"]') as HTMLElement;
  aug7.focus();
  aug7.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;

  const title = el.shadowRoot!.querySelector('[part="title"]')!.textContent!.toLowerCase();
  expect(title, 'expected the view to have rolled forward to August').to.contain('august');

  const focused = el.shadowRoot!.querySelector('[data-date="2026-08-14"]') as HTMLElement;
  expect(focused, 'expected Aug 14 to be rendered once the view rolled to August').to.exist;
  expect(focused.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.activeElement).to.equal(focused);
});

it('gives the previous/next month nav buttons the shared minimum hit area', async () => {
  const el = (await fixture(html`<lyra-calendar view-date="2026-07-01"></lyra-calendar>`)) as LyraCalendar;
  // The 'previous' button itself carries part="nav"; the 'next' button is nested inside a
  // wrapping <span part="nav"> instead (see calendar.class.ts's render()) -- both selector shapes
  // are needed to reach both buttons.
  const previous = el.shadowRoot!.querySelector('button[part="nav"]') as HTMLElement;
  const next = el.shadowRoot!.querySelector('[part="nav"] button') as HTMLElement;
  for (const button of [previous, next]) {
    expect(getComputedStyle(button).minInlineSize).to.equal('40px');
    expect(getComputedStyle(button).minBlockSize).to.equal('40px');
  }
});

it('is accessible', async () => {
  const el = await fixture(html`<lyra-calendar aria-label="Schedule"></lyra-calendar>`);
  await expect(el).to.be.accessible();
});

it('exposes month-grid day cells as gridcells with per-day selection state and a full-date accessible name', async () => {
  const el = (await fixture(
    html`<lyra-calendar view-date="2026-07-01" value="2026-07-15" locale="en-US"></lyra-calendar>`,
  )) as LyraCalendar;
  expect(el.shadowRoot!.querySelector('[part="grid"]')?.getAttribute('role')).to.equal('grid');
  expect(el.shadowRoot!.querySelector('[part="week"]')?.getAttribute('role')).to.equal('row');
  const selectedDay = el.shadowRoot!.querySelector('[data-date="2026-07-15"]') as HTMLElement;
  expect(selectedDay.getAttribute('role')).to.equal('gridcell');
  expect(selectedDay.getAttribute('aria-selected')).to.equal('true');
  expect(selectedDay.getAttribute('aria-label')).to.equal(
    new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date(2026, 6, 15)),
  );
  const unselectedDay = el.shadowRoot!.querySelector('[data-date="2026-07-16"]') as HTMLElement;
  expect(unselectedDay.getAttribute('aria-selected')).to.equal('false');
});

it('mirrors the previous/next chevron glyphs under RTL', async () => {
  const el = await fixture(html`<lyra-calendar dir="rtl" view-date="2026-07-01"></lyra-calendar>`);
  const glyph = el.shadowRoot!.querySelector('[part="nav-glyph"]') as HTMLElement;
  expect(getComputedStyle(glyph).transform).to.contain('matrix(-1');
});

it('applies a valid CalendarEvent.color as the event marker background', async () => {
  const el = (await fixture(html`<lyra-calendar view-date="2026-07-01"></lyra-calendar>`)) as LyraCalendar;
  el.events = [{ date: '2026-07-15', title: 'Safe', color: '#ff0000' }];
  await el.updateComplete;
  const marker = el.shadowRoot!.querySelector('[data-date="2026-07-15"] [part="event"]') as HTMLElement;
  expect(marker.style.background).to.not.equal('');
});

it('does not let CalendarEvent.color inject extra CSS declarations via the event marker style attribute', async () => {
  const el = (await fixture(html`<lyra-calendar view-date="2026-07-01"></lyra-calendar>`)) as LyraCalendar;
  el.events = [{ date: '2026-07-15', title: 'Bad', color: 'red; position: fixed; top: 0px' }];
  await el.updateComplete;
  const marker = el.shadowRoot!.querySelector('[data-date="2026-07-15"] [part="event"]') as HTMLElement;
  expect(marker.style.position).to.equal('');
  expect(marker.style.top).to.equal('');
});

it('does not accept a non-color CSS value (e.g. url()) as an event marker background', async () => {
  const el = (await fixture(html`<lyra-calendar view-date="2026-07-01"></lyra-calendar>`)) as LyraCalendar;
  el.events = [{ date: '2026-07-15', title: 'Bad', color: 'url(https://attacker.example/beacon.gif)' }];
  await el.updateComplete;
  const marker = el.shadowRoot!.querySelector('[data-date="2026-07-15"] [part="event"]') as HTMLElement;
  expect(marker.style.background).to.equal('');
});

it('renders every event for a day in its cell, in order, and none in event-free cells', async () => {
  const el = (await fixture(html`<lyra-calendar view-date="2026-07-01"></lyra-calendar>`)) as LyraCalendar;
  el.events = [
    { date: '2026-07-15', title: 'A' },
    { date: '2026-07-20', title: 'C' },
    { date: '2026-07-15', title: 'B' },
  ];
  await el.updateComplete;
  const markers = [...el.shadowRoot!.querySelectorAll('[data-date="2026-07-15"] [part="event"]')];
  expect(markers.map((marker) => marker.textContent!.trim())).to.deep.equal(['A', 'B']);
  expect(el.shadowRoot!.querySelectorAll('[data-date="2026-07-20"] [part="event"]')).to.have.length(1);
  expect(el.shadowRoot!.querySelectorAll('[data-date="2026-07-16"] [part="event"]')).to.have.length(0);
});

it('themes the title and date weights through the shared semibold token', async () => {
  const el = (await fixture(
    html`<lyra-calendar view-date="2026-07-01" style="--lyra-font-weight-semibold: 700"></lyra-calendar>`,
  )) as LyraCalendar;
  const title = el.shadowRoot!.querySelector('[part="title"]') as HTMLElement;
  const date = el.shadowRoot!.querySelector('[part="date"]') as HTMLElement;
  expect(getComputedStyle(title).fontWeight).to.equal('700');
  expect(getComputedStyle(date).fontWeight).to.equal('700');
});

it('normalizes an out-of-range first-day-of-week instead of dropping leading days of the month', async () => {
  // (0 - 9 + 7) % 7 === -2 in JS, which previously made the grid start on
  // Feb 3rd instead of wrapping to the prior month -- silently dropping Feb
  // 1-2 from the rendered 42-day window.
  const el = (await fixture(
    html`<lyra-calendar view-date="2026-02-01" first-day-of-week="9"></lyra-calendar>`,
  )) as LyraCalendar;
  const days = [...el.shadowRoot!.querySelectorAll('[part="day"]')] as HTMLElement[];
  expect(days).to.have.length(42);
  expect(days[0].dataset.date).to.equal('2026-01-27');
  expect(days.some((day) => day.dataset.date === '2026-02-01')).to.be.true;
  expect(days.some((day) => day.dataset.date === '2026-02-02')).to.be.true;
});

it('falls back to a sane first-day-of-week instead of producing Invalid Date for a non-numeric attribute', async () => {
  const el = (await fixture(
    html`<lyra-calendar view-date="2026-07-01" first-day-of-week="not-a-number"></lyra-calendar>`,
  )) as LyraCalendar;
  const days = [...el.shadowRoot!.querySelectorAll('[part="day"]')] as HTMLElement[];
  expect(days).to.have.length(42);
  expect(days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.dataset.date || ''))).to.be.true;
});

it('wraps a negative firstDayOfWeek property (not just an out-of-range attribute) into [0, 6] instead of leaving Invalid Date/NaN', async () => {
  const el = (await fixture(html`<lyra-calendar view-date="2026-02-01"></lyra-calendar>`)) as LyraCalendar;

  el.firstDayOfWeek = -2; // ((-2 % 7) + 7) % 7 === 5 (Friday)
  await el.updateComplete;
  let days = [...el.shadowRoot!.querySelectorAll('[part="day"]')] as HTMLElement[];
  expect(days).to.have.length(42);
  expect(days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.dataset.date || ''))).to.be.true;

  el.firstDayOfWeek = NaN;
  await el.updateComplete;
  days = [...el.shadowRoot!.querySelectorAll('[part="day"]')] as HTMLElement[];
  expect(days).to.have.length(42);
  expect(days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.dataset.date || ''))).to.be.true;
});
