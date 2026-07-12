import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './date-picker.js';
import type { LyraDatePicker } from './date-picker.js';
import { styles } from './date-picker.styles.js';

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

it('disables every day button and dims the host when the picker itself is disabled', async () => {
  const el = (await fixture(
    html`<lyra-date-picker value="2026-07-15" disabled></lyra-date-picker>`,
  )) as LyraDatePicker;
  await el.updateComplete;

  const days = el.shadowRoot!.querySelectorAll('[part~="day"]') as NodeListOf<HTMLButtonElement>;
  expect(days.length).to.be.greaterThan(0);
  for (const day of days) expect(day.disabled).to.be.true;

  expect(getComputedStyle(el).pointerEvents).to.equal('none');
});

it('disables every day button when the picker is readonly', async () => {
  const el = (await fixture(
    html`<lyra-date-picker value="2026-07-15" readonly></lyra-date-picker>`,
  )) as LyraDatePicker;
  await el.updateComplete;

  const days = el.shadowRoot!.querySelectorAll('[part~="day"]') as NodeListOf<HTMLButtonElement>;
  expect(days.length).to.be.greaterThan(0);
  for (const day of days) expect(day.disabled).to.be.true;
});

it('uses the shared --lyra-color-on-brand token instead of a raw #fff for selected/range day text', () => {
  const css = styles.cssText;
  const selectedBlock =
    /\[part~=['"]?day-selected['"]?],\s*\[part~=['"]?day-range-start['"]?],\s*\[part~=['"]?day-range-end['"]?]\s*{([^}]*)}/.exec(
      css,
    );
  expect(selectedBlock, 'expected a shared day-selected/day-range-start/day-range-end rule').to.not.equal(null);
  expect(selectedBlock![1]).to.include('var(--lyra-color-on-brand');
  expect(selectedBlock![1]).to.not.match(/color:\s*#fff/);
});

// onGridKey: the ARIA-grid keyboard navigation handler (roving focus across
// ArrowLeft/Right/Up/Down, PageUp/PageDown, Home/End, Enter/Space).
function dispatchGridKey(el: LyraDatePicker, key: string): void {
  const grid = el.shadowRoot!.querySelector('[part="grid"]') as HTMLElement;
  grid.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

it('moves roving focus one day left/right with ArrowLeft/ArrowRight', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, 'ArrowRight');
  await el.updateComplete;
  let focused = el.shadowRoot!.querySelector('[data-date="2026-07-16"]') as HTMLButtonElement;
  expect(focused.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.activeElement).to.equal(focused);

  dispatchGridKey(el, 'ArrowLeft');
  await el.updateComplete;
  focused = el.shadowRoot!.querySelector('[data-date="2026-07-15"]') as HTMLButtonElement;
  expect(focused.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.activeElement).to.equal(focused);
});

it('moves roving focus one week up/down with ArrowUp/ArrowDown', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, 'ArrowDown');
  await el.updateComplete;
  expect(
    (el.shadowRoot!.querySelector('[data-date="2026-07-22"]') as HTMLButtonElement).getAttribute('tabindex'),
  ).to.equal('0');

  dispatchGridKey(el, 'ArrowUp');
  await el.updateComplete;
  expect(
    (el.shadowRoot!.querySelector('[data-date="2026-07-15"]') as HTMLButtonElement).getAttribute('tabindex'),
  ).to.equal('0');
});

it('jumps a month with PageUp/PageDown, re-rendering the grid for the new month', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;
  const title = () => el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim().toLowerCase();

  dispatchGridKey(el, 'PageDown');
  await el.updateComplete;
  expect(title()).to.contain('august');
  expect(el.shadowRoot!.querySelector('[data-date="2026-08-15"]')).to.exist;

  dispatchGridKey(el, 'PageUp');
  await el.updateComplete;
  expect(title()).to.contain('july');
  expect(el.shadowRoot!.querySelector('[data-date="2026-07-15"]')).to.exist;
});

it('moves focus to the first/last day of the month with Home/End', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, 'Home');
  await el.updateComplete;
  expect(
    (el.shadowRoot!.querySelector('[data-date="2026-07-01"]') as HTMLButtonElement).getAttribute('tabindex'),
  ).to.equal('0');

  dispatchGridKey(el, 'End');
  await el.updateComplete;
  expect(
    (el.shadowRoot!.querySelector('[data-date="2026-07-31"]') as HTMLButtonElement).getAttribute('tabindex'),
  ).to.equal('0');
});

it('commits the currently-focused day with Enter or Space', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, 'ArrowRight'); // focus moves to 2026-07-16, nothing committed yet
  await el.updateComplete;
  expect(el.value).to.equal('2026-07-15');

  setTimeout(() => dispatchGridKey(el, 'Enter'));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-16');

  dispatchGridKey(el, 'ArrowLeft'); // focus moves to 2026-07-15
  await el.updateComplete;
  setTimeout(() => dispatchGridKey(el, ' ')); // Space also commits
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-15');
});

it('keeps exactly one grid cell in the roving tab order after moving focus', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, 'ArrowRight');
  await el.updateComplete;

  const inTabOrder = el.shadowRoot!.querySelectorAll('[part~="day"][tabindex="0"]');
  expect(inTabOrder.length).to.equal(1);
  expect((inTabOrder[0] as HTMLElement).dataset.date).to.equal('2026-07-16');
});

it('crosses a month boundary when ArrowRight moves past the last day of the month', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-31"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, 'ArrowRight');
  await el.updateComplete;

  const title = el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim().toLowerCase();
  expect(title).to.contain('august');
  const focused = el.shadowRoot!.querySelector('[data-date="2026-08-01"]') as HTMLButtonElement;
  expect(focused, 'expected the next day, in August, to be rendered').to.exist;
  expect(focused.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.activeElement).to.equal(focused);
});

it('crosses a month boundary backwards when ArrowLeft moves before the first day of the month', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-01"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;

  dispatchGridKey(el, 'ArrowLeft');
  await el.updateComplete;

  const title = el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim().toLowerCase();
  expect(title).to.contain('june');
  const focused = el.shadowRoot!.querySelector('[data-date="2026-06-30"]') as HTMLButtonElement;
  expect(focused, 'expected the previous day, in June, to be rendered').to.exist;
  expect(focused.getAttribute('tabindex')).to.equal('0');
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
