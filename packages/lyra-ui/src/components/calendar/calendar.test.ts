import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './calendar.js';
import type { LyraCalendar } from './calendar.js';

it('renders a month and emits date selections', async () => {
  const el = (await fixture(html`<lyra-calendar view-date="2026-07-01"></lyra-calendar>`)) as LyraCalendar;
  expect(el.shadowRoot!.querySelectorAll('[part="day"]')).to.have.length(42);
  const selected = oneEvent(el, 'lyra-date-select');
  (el.shadowRoot!.querySelector('[data-date="2026-07-15"]') as HTMLElement).click();
  expect((await selected).detail.date).to.equal('2026-07-15');
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
