import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './calendar.js';
import type { LyraCalendar } from './calendar.js';
import { formatISO } from '../../forms/date-picker/calendar-core.js';
import { styles } from './calendar.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

/**
 * Resolve a design token in the same scope `calendar.styles.ts` reads it from -- the calendar host,
 * where the palette's `:host` block declares it. A fixture (or assertion) that restates a token's
 * literal value is asserting the palette rather than the calendar, and breaks on every legitimate
 * regeneration of the OKLCH ramp.
 */
const readToken = (el: Element, name: string): string =>
  getComputedStyle(el).getPropertyValue(name).trim();

it('renders a month and emits date selections', async () => {
  const el = (await fixture(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`)) as LyraCalendar;
  expect(el.shadowRoot!.querySelectorAll('[part="day"]')).to.have.length(42);
  const selected = oneEvent(el, 'lr-date-select');
  (el.shadowRoot!.querySelector('[data-date="2026-07-15"]') as HTMLElement).click();
  expect((await selected).detail.date).to.equal('2026-07-15');
});

it('keeps exactly one focusable day after navigating the view away from any anchor date', async () => {
  // Regression test: the roving tab stop was `focusedDate || value || today`
  // with no fallback -- a visible month containing none of those three
  // (e.g. three months forward from a fresh calendar with no selection and
  // no prior keyboard focus) left zero cells with tabindex="0", making the
  // whole grid keyboard-unreachable.
  const el = (await fixture(html`<lr-calendar></lr-calendar>`)) as LyraCalendar;
  await el.updateComplete;
  const next = el.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement;
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
  const el = (await fixture(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`)) as LyraCalendar;
  await el.updateComplete;
  const aug7 = el.shadowRoot!.querySelector('[data-date="2026-08-07"]') as HTMLElement;
  aug7.focus();
  aug7.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;

  const title = el.shadowRoot!.querySelector('[part="title"]')!.textContent!.toLowerCase();
  expect(title, 'expected the view to have rolled forward to August').to.contain('august');

  const focused = el.shadowRoot!.querySelector('[data-date="2026-08-14"]') as HTMLElement;
  expect((focused) != null, 'expected Aug 14 to be rendered once the view rolled to August').to.equal(true);
  expect(focused.getAttribute('tabindex')).to.equal('0');
  expect((el.shadowRoot!.activeElement) === (focused)).to.equal(true);
});

it('gives the previous/next month nav buttons the shared minimum hit area and matching chrome', async () => {
  const el = (await fixture(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`)) as LyraCalendar;
  const previous = el.shadowRoot!.querySelector('button[part~="previous-button"]') as HTMLElement;
  const next = el.shadowRoot!.querySelector('button[part~="next-button"]') as HTMLElement;
  for (const button of [previous, next]) {
    expect(getComputedStyle(button).minInlineSize).to.equal('40px');
    expect(getComputedStyle(button).minBlockSize).to.equal('40px');
  }
  const previousStyle = getComputedStyle(previous);
  const nextStyle = getComputedStyle(next);
  expect(previousStyle.cursor, 'previous button must get the same pointer cursor as next').to.equal('pointer');
  expect(nextStyle.borderTopWidth).to.equal(previousStyle.borderTopWidth);
  expect(nextStyle.backgroundColor).to.equal(previousStyle.backgroundColor);
  expect(nextStyle.color).to.equal(previousStyle.color);
  expect(nextStyle.borderRadius).to.equal(previousStyle.borderRadius);
});

it('gives nav buttons, day cells, and agenda-event buttons hover/focus-visible treatment', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/button\[part~='nav'\]:hover[^{]*\{[^}]*background:/);
  expect(css).to.match(/button\[part~='nav'\]:focus-visible[^{]*\{[^}]*outline:/);
  expect(css).to.match(/\[part='day'\]:focus-visible[^{]*\{[^}]*outline:/);
  expect(css).to.match(/\[part='agenda-event'\]:hover[^{]*\{[^}]*background:/);
  expect(css).to.match(/\[part='agenda-event'\]:focus-visible[^{]*\{[^}]*outline:/);
});

it('gives a mouse user hover feedback on a clickable day cell, matching the keyboard focus-visible ring', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='day'\]:hover/);
});

// Regression test: [part='day'][data-selected='true'] used to be declared AFTER the
// [part='day']:hover/:active rules, so at equal (0,2,0) specificity source order alone let the
// static selected fill always win -- hovering or pressing an already-selected day showed no
// feedback beyond that flat background. Overriding --lr-calendar-day-selected-bg to a value that
// can't coincide with either state rule's own token/color-mix output makes the masking provable
// through getComputedStyle instead of by accident.
it('shows hover and pressed feedback layered on top of an already-selected day, not masked by the static selected fill', async () => {
  const wrapper = (await fixture(html`
    <div style="--lr-calendar-day-selected-bg: rgb(9, 9, 9)">
      <lr-calendar view-date="2026-07-01" value="2026-07-15"></lr-calendar>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-calendar') as LyraCalendar;
  await el.updateComplete;
  const day = el.shadowRoot!.querySelector<HTMLElement>('[data-selected="true"]')!;
  day.scrollIntoView();
  const restingColor = getComputedStyle(day).backgroundColor;
  expect(
    restingColor,
    'sanity: the selected-bg cssprop must actually apply while resting',
  ).to.equal('rgb(9, 9, 9)');

  const rect = day.getBoundingClientRect();
  const position: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];
  try {
    await sendMouse({ type: 'move', position });
    const hoveredColor = getComputedStyle(day).backgroundColor;
    expect(
      hoveredColor,
      'a hovered selected day must show hover feedback, not just the static selected fill',
    ).to.not.equal(restingColor);

    await sendMouse({ type: 'down' });
    const pressedColor = getComputedStyle(day).backgroundColor;
    expect(
      pressedColor,
      'a pressed selected day must show active feedback, not just the static selected fill',
    ).to.not.equal(restingColor);
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('renders the selected-day paint hook and falls back to brand quiet only when the hook is unset', async () => {
  const overriddenWrapper = (await fixture(html`
    <div style="--lr-calendar-day-selected-bg: rgb(1, 2, 3); --lr-theme-color-brand-fill-quiet: rgb(4, 5, 6)">
      <lr-calendar view-date="2026-07-01" value="2026-07-15"></lr-calendar>
    </div>
  `)) as HTMLElement;
  const overridden = overriddenWrapper.querySelector('lr-calendar') as LyraCalendar;
  await overridden.updateComplete;
  const overriddenSelected = overridden.shadowRoot!.querySelector<HTMLElement>('[data-selected="true"]')!;
  expect(getComputedStyle(overriddenSelected).backgroundColor).to.equal('rgb(1, 2, 3)');

  const fallbackWrapper = (await fixture(html`
    <div style="--lr-theme-color-brand-fill-quiet: rgb(4, 5, 6)">
      <lr-calendar view-date="2026-07-01" value="2026-07-15"></lr-calendar>
    </div>
  `)) as HTMLElement;
  const fallback = fallbackWrapper.querySelector('lr-calendar') as LyraCalendar;
  await fallback.updateComplete;
  const fallbackSelected = fallback.shadowRoot!.querySelector<HTMLElement>('[data-selected="true"]')!;
  expect(getComputedStyle(fallbackSelected).backgroundColor).to.equal('rgb(4, 5, 6)');
});

it('inherits independent selected, outside-month, and today paint hooks from a theme ancestor', async () => {
  const wrapper = (await fixture(html`
    <div
      style="
        --lr-calendar-day-selected-bg: rgb(1, 2, 3);
        --lr-calendar-day-outside-color: rgb(4, 5, 6);
        --lr-calendar-day-outside-bg: rgb(7, 8, 9);
      "
    >
      <lr-calendar view-date="2026-07-01" value="2026-07-15"></lr-calendar>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-calendar') as LyraCalendar;
  await el.updateComplete;
  const selected = el.shadowRoot!.querySelector<HTMLElement>('[data-selected="true"]')!;
  const outside = el.shadowRoot!.querySelector<HTMLElement>('[data-outside="true"]')!;
  expect(getComputedStyle(selected).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(outside).color).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(outside).backgroundColor).to.equal('rgb(7, 8, 9)');

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const todayWrapper = (await fixture(html`
    <div style="--lr-calendar-day-today-outline-color: rgb(10, 11, 12)">
      <lr-calendar .viewDate=${currentMonth}></lr-calendar>
    </div>
  `)) as HTMLElement;
  const todayCalendar = todayWrapper.querySelector('lr-calendar') as LyraCalendar;
  await todayCalendar.updateComplete;
  const today = todayCalendar.shadowRoot!.querySelector<HTMLElement>('[data-today="true"]')!;
  expect(getComputedStyle(today).outlineColor).to.equal('rgb(10, 11, 12)');
});

it('is accessible', async () => {
  const el = await fixture(html`<lr-calendar aria-label="Schedule"></lr-calendar>`);
  await expect(el).to.be.accessible();
});

it('is accessible with a populated month view (selection + multiple events per day)', async () => {
  const el = (await fixture(
    html`<lr-calendar aria-label="Schedule" view-date="2026-07-01" value="2026-07-15"></lr-calendar>`,
  )) as LyraCalendar;
  // A month-view event marker keeps `color: var(--lr-color-on-brand)` whatever background the
  // caller supplies, so the brand fill is the one background the palette actually guarantees a
  // readable foreground against -- resolve it live instead of restating a hex. (The literal that
  // used to sit here was the pre-8.0.0 brand blue; once the ramp moved --lr-color-on-brand off it,
  // axe measured 4.47:1 against a colour the calendar no longer has anything to do with.)
  const brand = readToken(el, '--lr-color-brand');
  expect(brand, 'expected --lr-color-brand to resolve on the calendar host').to.match(/^(#|rgb)/);
  el.events = [
    { date: '2026-07-15', title: 'Standup', color: brand },
    { date: '2026-07-15', title: 'Review' },
    { date: '2026-07-20', title: 'Deadline' },
  ];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated agenda view', async () => {
  const el = (await fixture(
    html`<lr-calendar aria-label="Schedule" view="agenda" view-date="2026-07-01"></lr-calendar>`,
  )) as LyraCalendar;
  // Same rule as the month-view case above: no palette literal in a fixture. The agenda view does
  // not currently paint `event.color` at all, so this passes either way today -- resolving the
  // token keeps it passing the day it starts to.
  el.events = [
    { date: '2026-07-15', title: 'Standup', color: readToken(el, '--lr-color-brand') },
    { date: '2026-07-20', title: 'Deadline' },
  ];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('exposes month-grid day cells as gridcells with per-day selection state and a full-date accessible name', async () => {
  const el = (await fixture(
    html`<lr-calendar view-date="2026-07-01" value="2026-07-15" locale="en-US"></lr-calendar>`,
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
  const el = await fixture(html`<lr-calendar dir="rtl" view-date="2026-07-01"></lr-calendar>`);
  const glyph = el.shadowRoot!.querySelector('[part="nav-glyph"]') as HTMLElement;
  expect(getComputedStyle(glyph).transform).to.contain('matrix(-1');
});

it('applies a valid CalendarEvent.color as the event marker background', async () => {
  const el = (await fixture(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`)) as LyraCalendar;
  el.events = [{ date: '2026-07-15', title: 'Safe', color: '#ff0000' }];
  await el.updateComplete;
  const marker = el.shadowRoot!.querySelector('[data-date="2026-07-15"] [part="event"]') as HTMLElement;
  expect(marker.style.backgroundColor).to.not.equal('');
});

// The regression this guards: the hover/press feedback used to be `filter: brightness()`, which
// multiplies every channel and therefore does NOTHING to a pure white (or pure black) chip -- and a
// plain `background:` swap could not replace it either, because CalendarEvent.color is written as an
// inline background-color and an inline declaration beats every stylesheet rule. Asserted through
// getComputedStyle on a really hovered/pressed chip, never against the stylesheet text.
it('shows a rendered hover and a stronger pressed overlay on a white event chip, without losing its fill', async () => {
  const el = (await fixture(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`)) as LyraCalendar;
  el.events = [{ date: '2026-07-15', title: 'White', color: '#ffffff' }];
  await el.updateComplete;
  const chip = el.shadowRoot!.querySelector('[data-date="2026-07-15"] [part="event"]') as HTMLElement;
  chip.scrollIntoView();
  const restingImage = getComputedStyle(chip).backgroundImage;
  const restingColor = getComputedStyle(chip).backgroundColor;
  expect(restingImage).to.equal('none');
  const rect = chip.getBoundingClientRect();
  const position: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];
  try {
    await sendMouse({ type: 'move', position });
    const hoveredImage = getComputedStyle(chip).backgroundImage;
    expect(hoveredImage, 'a hovered chip must paint an overlay').to.not.equal('none');
    await sendMouse({ type: 'down' });
    const pressedImage = getComputedStyle(chip).backgroundImage;
    expect(pressedImage, 'the pressed overlay must be stronger than the hovered one').to.not.equal(
      hoveredImage,
    );
    expect(
      getComputedStyle(chip).backgroundColor,
      "the consumer's own fill survives both states",
    ).to.equal(restingColor);
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('does not let CalendarEvent.color inject extra CSS declarations via the event marker style attribute', async () => {
  const el = (await fixture(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`)) as LyraCalendar;
  el.events = [{ date: '2026-07-15', title: 'Bad', color: 'red; position: fixed; top: 0px' }];
  await el.updateComplete;
  const marker = el.shadowRoot!.querySelector('[data-date="2026-07-15"] [part="event"]') as HTMLElement;
  expect(marker.style.position).to.equal('');
  expect(marker.style.top).to.equal('');
});

it('does not accept a non-color CSS value (e.g. url()) as an event marker background', async () => {
  const el = (await fixture(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`)) as LyraCalendar;
  el.events = [{ date: '2026-07-15', title: 'Bad', color: 'url(https://attacker.example/beacon.gif)' }];
  await el.updateComplete;
  const marker = el.shadowRoot!.querySelector('[data-date="2026-07-15"] [part="event"]') as HTMLElement;
  expect(marker.style.backgroundColor).to.equal('');
});

it('renders every event for a day in its cell, in order, and none in event-free cells', async () => {
  const el = (await fixture(html`<lr-calendar view-date="2026-07-01"></lr-calendar>`)) as LyraCalendar;
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

it('renders month events as valid focusable controls that keyboard users can activate', async () => {
  const event = { date: '2026-07-15', title: 'Keyboard event' };
  const el = (await fixture(
    html`<lr-calendar view-date="2026-07-01" .events=${[event]}></lr-calendar>`,
  )) as LyraCalendar;
  const marker = el.shadowRoot!.querySelector('[data-date="2026-07-15"] [part="event"]') as HTMLButtonElement;
  expect(marker.localName).to.equal('button');
  expect((marker.closest('button')) === (marker)).to.equal(true);
  marker.focus();
  const selected = oneEvent(el, 'lr-event-select');
  marker.click();
  expect((await selected).detail.event).to.equal(event);
});

it('keeps month-event buttons at least 24px in both axes in a narrow allocation', async () => {
  const wrapper = await fixture(html`
    <div style="inline-size: 320px">
      <lr-calendar
        view-date="2026-07-01"
        .events=${[{ date: '2026-07-15', title: 'I' }]}
      ></lr-calendar>
    </div>
  `);
  const el = wrapper.querySelector('lr-calendar') as LyraCalendar;
  const marker = el.shadowRoot!.querySelector(
    '[data-date="2026-07-15"] [part="event"]',
  ) as HTMLButtonElement;
  const rect = marker.getBoundingClientRect();
  expect(rect.width).to.be.at.least(24);
  expect(rect.height).to.be.at.least(24);
});

it('contains long RTL month content in an exact 320px allocation', async () => {
  const wrapper = (await fixture(html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-calendar
        aria-label="جدول الإصدارات والمراجعات الشهرية"
        view-date="2026-07-01"
        .events=${[
          { date: '2026-07-15', title: 'مراجعة تخطيط الإصدار لجميع مناطق النشر والإنتاج' },
          { date: '2026-07-22', title: 'release-approval-with-an-intentionally-unbroken-identifier' },
        ]}
      ></lr-calendar>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-calendar') as LyraCalendar;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector<HTMLElement>('[part="grid"]')!;
  expect(wrapper.clientWidth).to.equal(320);
  expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  expect(grid.scrollWidth).to.be.at.most(grid.clientWidth);
  expect(getComputedStyle(el).direction).to.equal('rtl');
});

it('locale-formats visible month day numbers and agenda dates', async () => {
  const event = { date: '2026-07-15', title: 'Localized date' };
  const month = (await fixture(
    html`<lr-calendar locale="ar" view-date="2026-07-01" .events=${[event]}></lr-calendar>`,
  )) as LyraCalendar;
  expect(
    month.shadowRoot!.querySelector('[data-date="2026-07-15"] [part="date"]')!.textContent,
  ).to.equal(new Intl.NumberFormat('ar').format(15));

  month.view = 'agenda';
  await month.updateComplete;
  const visibleDate = month.shadowRoot!.querySelector('[part="agenda-event"] strong')!.textContent;
  expect(visibleDate).to.equal(
    new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(2026, 6, 15)),
  );
  expect(visibleDate).to.not.equal('2026-07-15');
});

it('uses calendar-specific localized names for month navigation', async () => {
  const el = (await fixture(
    html`<lr-calendar
      .strings=${{
        calendarPreviousMonth: 'Earlier month',
        calendarNextMonth: 'Later month',
      }}
    ></lr-calendar>`,
  )) as LyraCalendar;
  const previous = el.shadowRoot!.querySelector('button[part~="previous-button"]') as HTMLButtonElement;
  const next = el.shadowRoot!.querySelector('button[part~="next-button"]') as HTMLButtonElement;
  expect(previous.getAttribute('aria-label')).to.equal('Earlier month');
  expect(next.getAttribute('aria-label')).to.equal('Later month');
});

it('exposes a stable navigation wrapper and purpose-specific parts on both direct buttons', async () => {
  const el = (await fixture(html`<lr-calendar></lr-calendar>`)) as LyraCalendar;
  const wrapper = el.shadowRoot!.querySelector('[part~="navigation"]') as HTMLElement;
  const previous = el.shadowRoot!.querySelector('button[part~="previous-button"]') as HTMLButtonElement;
  const next = el.shadowRoot!.querySelector('button[part~="next-button"]') as HTMLButtonElement;
  expect(wrapper.localName).to.equal('header');
  expect(previous.parentElement?.localName).to.equal('header');
  expect(next.parentElement?.localName).to.equal('header');
  expect(previous.getAttribute('part')?.split(/\s+/)).to.include('nav');
  expect(next.getAttribute('part')?.split(/\s+/)).to.include('nav');
});

it('normalizes a foreign view token to the month contract and reflected value', async () => {
  const el = (await fixture(html`<lr-calendar view="foreign"></lr-calendar>`)) as LyraCalendar;
  await el.updateComplete;
  expect(el.view).to.equal('month');
  expect(el.shadowRoot!.querySelectorAll('[part="day"]').length).to.equal(42);
  // The reflected surface must not keep advertising a branch runtime never uses.
  expect(el.getAttribute('view')).to.equal('month');
});

it('uses the normalized current month for agenda filtering when view-date is invalid', async () => {
  const now = new Date();
  const date = formatISO(new Date(now.getFullYear(), now.getMonth(), 15));
  const el = (await fixture(html`
    <lr-calendar view="agenda" view-date="not-a-date" .events=${[{ date, title: 'Current event' }]}></lr-calendar>
  `)) as LyraCalendar;
  expect(el.shadowRoot!.querySelectorAll('[part="agenda-event"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="agenda-event"]')?.textContent).to.contain('Current event');
});

it('uses an authored host aria-label as the internal section name instead of the generic default', async () => {
  const el = (await fixture(html`<lr-calendar aria-label="Product schedule"></lr-calendar>`)) as LyraCalendar;
  const section = el.shadowRoot!.querySelector('section')!;
  expect(el.getAttribute('aria-label')).to.equal('Product schedule');
  expect(section.getAttribute('aria-label')).to.equal('Product schedule');
});

it('themes the title and date weights through the shared semibold token', async () => {
  const el = (await fixture(
    html`<lr-calendar view-date="2026-07-01" style="--lr-font-weight-semibold: 700"></lr-calendar>`,
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
    html`<lr-calendar view-date="2026-02-01" first-day-of-week="9"></lr-calendar>`,
  )) as LyraCalendar;
  const days = [...el.shadowRoot!.querySelectorAll('[part="day"]')] as HTMLElement[];
  expect(days).to.have.length(42);
  expect(days[0].dataset.date).to.equal('2026-01-27');
  expect(days.some((day) => day.dataset.date === '2026-02-01')).to.be.true;
  expect(days.some((day) => day.dataset.date === '2026-02-02')).to.be.true;
});

it('falls back to a sane first-day-of-week instead of producing Invalid Date for a non-numeric attribute', async () => {
  const el = (await fixture(
    html`<lr-calendar view-date="2026-07-01" first-day-of-week="not-a-number"></lr-calendar>`,
  )) as LyraCalendar;
  const days = [...el.shadowRoot!.querySelectorAll('[part="day"]')] as HTMLElement[];
  expect(days).to.have.length(42);
  expect(days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.dataset.date || ''))).to.be.true;
});

it('wraps a negative firstDayOfWeek property (not just an out-of-range attribute) into [0, 6] instead of leaving Invalid Date/NaN', async () => {
  const el = (await fixture(html`<lr-calendar view-date="2026-02-01"></lr-calendar>`)) as LyraCalendar;

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

it('narrows the day-cell floor inside a narrow container, resolving it through the shared 4rem size token', async () => {
  const wrapper = (await fixture(html`
    <div style="container-type: inline-size; inline-size: 300px; --lr-theme-size-4rem: 5rem">
      <lr-calendar view-date="2026-07-01"></lr-calendar>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-calendar') as LyraCalendar;
  await el.updateComplete;
  const day = el.shadowRoot!.querySelector('[part="day"]') as HTMLElement;
  expect(getComputedStyle(day).minBlockSize).to.equal('80px');
});

it("establishes its own inline-size containment, so the narrow @container query fires without a consumer having to declare container-type on some ancestor themselves", async () => {
  const wrapper = (await fixture(html`
    <div style="inline-size: 300px">
      <lr-calendar view-date="2026-07-01"></lr-calendar>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-calendar') as LyraCalendar;
  await el.updateComplete;
  expect(getComputedStyle(el).containerType).to.equal('inline-size');
  const day = el.shadowRoot!.querySelector('[part="day"]') as HTMLElement;
  expect(getComputedStyle(day).minBlockSize).to.equal('64px'); // var(--lr-size-4rem) narrow floor
});

it('keeps the narrow day-cell floor overridable through its own cssprop', async () => {
  const wrapper = (await fixture(html`
    <div style="container-type: inline-size; inline-size: 300px; --lr-calendar-day-min-block-size-narrow: 2rem">
      <lr-calendar view-date="2026-07-01"></lr-calendar>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-calendar') as LyraCalendar;
  await el.updateComplete;
  const day = el.shadowRoot!.querySelector('[part="day"]') as HTMLElement;
  expect(getComputedStyle(day).minBlockSize).to.equal('32px');
});

it('inherits the regular day-cell floor from a theme ancestor', async () => {
  const wrapper = await fixture(html`
    <div style="inline-size: 600px; --lr-calendar-day-min-block-size: 7rem">
      <lr-calendar view-date="2026-07-01"></lr-calendar>
    </div>
  `);
  const el = wrapper.querySelector('lr-calendar') as LyraCalendar;
  const day = el.shadowRoot!.querySelector('[part="day"]') as HTMLElement;
  expect(getComputedStyle(day).minBlockSize).to.equal('112px');
});

it('centers the chevron glyph in each icon-only month-nav button', async () => {
  // The same defect first reported on <lr-widget>'s view toggle: [part='nav'] carries the
  // min-inline-size hit-area floor, its content is a single chevron far narrower than that
  // floor, and the default justify-content (normal => flex-start) left the glyph hugging the
  // button's leading edge. Measured off the rendered boxes, not the stylesheet text.
  const el = (await fixture(html`<lr-calendar></lr-calendar>`)) as LyraCalendar;
  await el.updateComplete;
  const buttons = [
    ...el.shadowRoot!.querySelectorAll('button[part~="nav"]'),
  ] as HTMLElement[];
  expect(buttons.length, 'both a previous and a next button').to.equal(2);
  for (const button of buttons) {
    const glyph = button.querySelector('[part="nav-glyph"]') as HTMLElement;
    const box = button.getBoundingClientRect();
    const mark = glyph.getBoundingClientRect();
    expect(
      box.width,
      'the button must actually be floored wider than its glyph for this to test anything',
    ).to.be.greaterThan(mark.width + 2);
    const offset = Math.abs(mark.left + mark.width / 2 - (box.left + box.width / 2));
    expect(offset, `chevron is ${offset}px off the button's centre`).to.be.at.most(0.5);
  }
});
