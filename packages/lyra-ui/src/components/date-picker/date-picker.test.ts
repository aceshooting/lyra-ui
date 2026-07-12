import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './date-picker.js';
import type { LyraDatePicker } from './date-picker.js';
import { styles } from './date-picker.styles.js';
import { weekdayLabels, monthTitle } from './calendar-core.js';

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

it('keeps viewing the month the user navigated to after completing a cross-month range pick', async () => {
  // Regression test: willUpdate() used to unconditionally resync viewDate to
  // selection.from's month on every `value` change, including the component's
  // own commit() -- so completing a range in a later month than the range's
  // start snapped the view straight back to the start month.
  const el = (await fixture(html`<lyra-date-picker mode="range"></lyra-date-picker>`)) as LyraDatePicker;
  el.goToDate('2026-07-01');
  await el.updateComplete;

  (el.shadowRoot!.querySelector('[data-date="2026-07-25"]') as HTMLButtonElement).click();
  await el.updateComplete;

  (el.shadowRoot!.querySelector('[part="next"]') as HTMLButtonElement).click();
  await el.updateComplete;
  const title = () => el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim().toLowerCase();
  expect(title()).to.contain('august');

  setTimeout(() => (el.shadowRoot!.querySelector('[data-date="2026-08-05"]') as HTMLButtonElement).click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-25/2026-08-05');
  expect(
    title(),
    'the view should stay on the month the user navigated to, not snap back to the range-start month',
  ).to.contain('august');
  expect(
    el.shadowRoot!.querySelector('[data-date="2026-08-05"]'),
    'the day just picked should still be rendered',
  ).to.exist;
});

it('still syncs the view to an externally-assigned value (not just to its own commits)', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-01-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;

  el.value = '2026-09-10';
  await el.updateComplete;
  const title = el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim().toLowerCase();
  expect(title).to.contain('september');
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

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

it('disables days before today when disable-past is set', async () => {
  const el = (await fixture(html`<lyra-date-picker disable-past></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;
  const today = new Date();

  const todayCell = el.shadowRoot!.querySelector(`[data-date="${iso(today)}"]`) as HTMLButtonElement;
  expect(todayCell.disabled, 'today itself should remain selectable').to.be.false;

  if (today.getDate() > 1) {
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const pastCell = el.shadowRoot!.querySelector(`[data-date="${iso(yesterday)}"]`) as HTMLButtonElement;
    expect(pastCell.disabled, 'a day before today should be disabled').to.be.true;
  }
});

it('disables days after today when disable-future is set', async () => {
  const el = (await fixture(html`<lyra-date-picker disable-future></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;
  const today = new Date();

  const todayCell = el.shadowRoot!.querySelector(`[data-date="${iso(today)}"]`) as HTMLButtonElement;
  expect(todayCell.disabled, 'today itself should remain selectable').to.be.false;

  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  if (lastOfMonth > today.getDate()) {
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const futureCell = el.shadowRoot!.querySelector(`[data-date="${iso(tomorrow)}"]`) as HTMLButtonElement;
    expect(futureCell.disabled, 'a day after today should be disabled').to.be.true;
  }
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

it('leaves the two-month view alone when ArrowRight moves into a date already visible in the second grid', async () => {
  // Regression test: onGridKey used to always recenter the view as if the
  // focused cell belonged to the first (offset 0) calendar, so crossing into
  // the already-visible second month discarded the first month from view.
  const el = (await fixture(html`<lyra-date-picker months="2"></lyra-date-picker>`)) as LyraDatePicker;
  el.goToDate('2026-07-31');
  await el.updateComplete;

  const grids = el.shadowRoot!.querySelectorAll('[part="grid"]');
  grids[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;

  const titles = Array.from(el.shadowRoot!.querySelectorAll('[part="title"]')).map((t) =>
    t.textContent!.trim().toLowerCase(),
  );
  expect(titles[0], 'July should stay visible -- it was never scrolled past').to.contain('july');
  expect(titles[1]).to.contain('august');

  const focused = el.shadowRoot!.querySelector('[data-date="2026-08-01"]') as HTMLButtonElement;
  expect(focused, 'August 1 was already showing in the second grid').to.exist;
  expect(focused.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.activeElement).to.equal(focused);
});

it('slides the two-month view by exactly one month once a keypress moves past the last visible month', async () => {
  const el = (await fixture(html`<lyra-date-picker months="2"></lyra-date-picker>`)) as LyraDatePicker;
  el.goToDate('2026-07-31');
  await el.updateComplete;
  const grids = () => el.shadowRoot!.querySelectorAll('[part="grid"]');
  const titles = () =>
    Array.from(el.shadowRoot!.querySelectorAll('[part="title"]')).map((t) => t.textContent!.trim().toLowerCase());

  // PageDown from July 31 lands on Aug 31, already visible in the second grid.
  grids()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
  await el.updateComplete;
  expect(titles()[0]).to.contain('july');
  expect(titles()[1]).to.contain('august');

  // One more day forward crosses past the visible window (Sep 1 isn't shown yet).
  grids()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(titles()[0], 'August should slide into the first grid, not be discarded from view').to.contain('august');
  expect(titles()[1]).to.contain('september');

  const focused = el.shadowRoot!.querySelector('[data-date="2026-09-01"]') as HTMLButtonElement;
  expect(focused).to.exist;
  expect(el.shadowRoot!.activeElement).to.equal(focused);
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

it('clear() resets the value and emits input + change', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;
  setTimeout(() => el.clear());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('');
});

it('goToToday() navigates the view to the current month and focuses today', async () => {
  const el = (await fixture(html`<lyra-date-picker value="2026-01-01"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;
  el.goToToday();
  await el.updateComplete;

  const today = new Date();
  const cell = el.shadowRoot!.querySelector(`[data-date="${iso(today)}"]`) as HTMLButtonElement;
  expect(cell, 'expected today to be rendered after goToToday()').to.exist;
  expect(cell.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.activeElement).to.equal(cell);
});

it('uses the shared --lyra-opacity-disabled token instead of a literal 0.35 for the disabled day state', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  const dayDisabledBlock = /\[part~=['"]?day['"]?]:disabled\s*{([^}]*)}/.exec(css);
  expect(dayDisabledBlock, 'expected a [part~="day"]:disabled rule').to.not.equal(null);
  expect(dayDisabledBlock![1]).to.include('opacity: var(--lyra-opacity-disabled);');
  expect(dayDisabledBlock![1]).to.not.include('0.35');
});

it('wires locale, weekday-format and first-day-of-week through to the rendered weekday headers, month title and grid alignment', async () => {
  const el = (await fixture(
    html`<lyra-date-picker
      value="2026-07-15"
      locale="fr-FR"
      first-day-of-week="mon"
      weekday-format="narrow"
    ></lyra-date-picker>`,
  )) as LyraDatePicker;
  await el.updateComplete;

  const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="weekday"]')).map((w) => w.textContent!.trim());
  expect(labels).to.deep.equal(weekdayLabels(1, 'narrow', 'fr-FR'));

  const title = el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim();
  expect(title).to.equal(monthTitle(2026, 6, 'fr-FR'));

  // July 1 2026 is a Wednesday; with a Monday-first grid it must land in the
  // third column (index 2), proving first-day-of-week reached monthMatrix().
  const cells = Array.from(el.shadowRoot!.querySelectorAll('[part="grid"] [role="gridcell"]'));
  const idx = cells.findIndex((c) => (c as HTMLElement).dataset.date === '2026-07-01');
  expect(idx % 7).to.equal(2);
});

it('clamps goToDate() to min/max instead of navigating to an out-of-range date', async () => {
  const el = (await fixture(
    html`<lyra-date-picker min="2026-07-10" max="2026-07-20"></lyra-date-picker>`,
  )) as LyraDatePicker;
  el.goToDate('2026-08-05');
  await el.updateComplete;

  const title = el.shadowRoot!.querySelector('[part="title"]')!.textContent!.trim().toLowerCase();
  expect(title, 'expected the view to clamp into July instead of jumping to August').to.contain('july');
  const focused = el.shadowRoot!.querySelector('[data-date="2026-07-20"]') as HTMLButtonElement;
  expect(focused, 'expected the view to clamp to max').to.exist;
  expect(el.shadowRoot!.activeElement).to.equal(focused);
});

it('hides outside-month placeholders from the accessibility tree only in rows that also have a real visible day', async () => {
  // July 2026 (Sunday-first, the default) has a mixed leading row (June 28-30
  // outside, July 1-4 inside) and a fully-outside trailing row (Aug 2-8) --
  // only the former may have its placeholders aria-hidden.
  const el = (await fixture(html`<lyra-date-picker value="2026-07-15"></lyra-date-picker>`)) as LyraDatePicker;
  await el.updateComplete;

  const weeks = el.shadowRoot!.querySelectorAll('[part="week"]');
  const firstRowPlaceholders = weeks[0].querySelectorAll('[part="day-placeholder"]');
  const lastRowPlaceholders = weeks[weeks.length - 1].querySelectorAll('[part="day-placeholder"]');
  expect(firstRowPlaceholders.length, 'expected a mixed leading row').to.equal(3);
  expect(lastRowPlaceholders.length, 'expected a fully-outside trailing row').to.equal(7);

  for (const cell of Array.from(firstRowPlaceholders)) {
    expect(cell.getAttribute('aria-hidden'), 'mixed row already has a visible day cell').to.equal('true');
  }
  for (const cell of Array.from(lastRowPlaceholders)) {
    expect(
      cell.hasAttribute('aria-hidden'),
      'row role requires at least one visible gridcell; this row has none but placeholders',
    ).to.be.false;
  }
});
