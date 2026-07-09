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
