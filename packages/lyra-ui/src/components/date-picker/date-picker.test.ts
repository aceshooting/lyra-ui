import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './date-picker.js';
import type { LyraDatePicker } from './date-picker.js';

it('selects a day and emits change with an ISO value', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;

  const day = el.shadowRoot!.querySelector('[data-date="2026-07-20"]') as HTMLButtonElement;
  setTimeout(() => day.click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-20');
  expect(el.valueAsDate?.getDate()).to.equal(20);
});

it('marks the selected day', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;
  const sel = el.shadowRoot!.querySelector('[part~="day-selected"]') as HTMLButtonElement;
  expect(sel.getAttribute('data-date')).to.equal('2026-07-15');
});

it('selects a range across two clicks', async () => {
  const el = (await fixture(html`<lyra-date-picker mode="range"></lyra-date-picker>`)) as LyraDatePicker;
  el.goToDate('2026-07-01');
  await el.updateComplete;

  (el.shadowRoot!.querySelector('[data-date="2026-07-05"]') as HTMLButtonElement).click();
  await el.updateComplete;
  setTimeout(() => (el.shadowRoot!.querySelector('[data-date="2026-07-10"]') as HTMLButtonElement).click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-05/2026-07-10');
  expect(el.shadowRoot!.querySelectorAll('[part~="day-range-inner"]').length).to.equal(4);
});

it('honors min/max by disabling out-of-range days', async () => {
  const el = (await fixture(
    html`<lyra-date-picker value="2026-07-15" min="2026-07-10" max="2026-07-20"></lyra-date-picker>`,
  )) as LyraDatePicker;
  await el.updateComplete;
  const before = el.shadowRoot!.querySelector('[data-date="2026-07-05"]') as HTMLButtonElement;
  const inside = el.shadowRoot!.querySelector('[data-date="2026-07-15"]') as HTMLButtonElement;
  expect(before.disabled).to.be.true;
  expect(inside.disabled).to.be.false;
});

it('navigates months with the next/previous buttons', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;
  const title = () => el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim();
  expect(title()).to.contain('2026');
  (el.shadowRoot!.querySelector('[part="next"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(title().toLowerCase()).to.contain('august');
});

it('renders two months when requested', async () => {
  const el = (await fixture(
    html`<lyra-date-picker value="2026-07-15" months="2"></lyra-date-picker>`,
  )) as LyraDatePicker;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="month"]').length).to.equal(2);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('renders chevron icons for month navigation instead of text glyphs', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;
  const previous = el.shadowRoot!.querySelector('[part="previous"]') as HTMLButtonElement;
  const next = el.shadowRoot!.querySelector('[part="next"]') as HTMLButtonElement;
  expect(previous.querySelector('svg')).to.exist;
  expect(next.querySelector('svg')).to.exist;
  expect(previous.textContent).to.not.contain('‹');
  expect(next.textContent).to.not.contain('›');
});

it('gives an outside-month day inside a selected range normal text contrast, not the quiet outside color', async () => {
  const el = (await fixture(
    html`<lyra-date-picker
      mode="range"
      with-outside-days
      value="2026-06-28/2026-07-05"
    ></lyra-date-picker>`,
  )) as LyraDatePicker;
  await el.updateComplete;

  // Viewing June (from's month): June 28 → July 5 puts July 1–4 in the trailing
  // "outside" days of the June grid, strictly between from/to, so they carry both
  // day-outside and day-range-inner.
  const overlapCell = el.shadowRoot!.querySelector(
    '[part~="day-outside"][part~="day-range-inner"]',
  ) as HTMLButtonElement;
  expect(overlapCell, 'expected an outside day cell inside the selected range').to.exist;

  const plainOutsideCell = el.shadowRoot!.querySelector(
    '[part~="day-outside"]:not([part~="day-range-inner"])',
  ) as HTMLButtonElement;
  expect(plainOutsideCell, 'expected a plain outside day cell for comparison').to.exist;

  const normalCell = el.shadowRoot!.querySelector(
    '[part~="day"]:not([part~="day-outside"]):not([part~="day-selected"]):not([part~="day-range-start"]):not([part~="day-range-end"])',
  ) as HTMLButtonElement;
  expect(normalCell, 'expected a plain in-month day cell for comparison').to.exist;

  const overlapColor = getComputedStyle(overlapCell).color;
  const plainOutsideColor = getComputedStyle(plainOutsideCell).color;
  const normalColor = getComputedStyle(normalCell).color;

  expect(overlapColor).to.equal(normalColor);
  expect(overlapColor).to.not.equal(plainOutsideColor);
});
