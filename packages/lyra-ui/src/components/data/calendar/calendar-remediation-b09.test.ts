import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-calendar.js';
import type { LyraCalendar } from '../../lr-calendar.js';

describe('calendar remediation', () => {
  it('keeps selected-day hover distinct from the resting selected fill', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-03-01" value="2026-03-10"></lr-calendar>`);
    const day = el.shadowRoot!.querySelector<HTMLElement>('[part="day"][data-date="2026-03-10"]')!;
    const rest = getComputedStyle(day).backgroundColor;
    await hoverUntilMatched(day, 'selected day did not receive hover');
    await waitUntil(() => getComputedStyle(day).backgroundColor !== rest, 'hover did not change the selected fill');
    await resetMouse();
  });

  it('paints a hovered unselected day differently from the selected day', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-03-01" value="2026-03-10"></lr-calendar>`);
    const selected = el.shadowRoot!.querySelector<HTMLElement>('[part="day"][data-date="2026-03-10"]')!;
    const other = el.shadowRoot!.querySelector<HTMLElement>('[part="day"][data-date="2026-03-12"]')!;
    const rest = getComputedStyle(other).backgroundColor;
    const selectedFill = getComputedStyle(selected).backgroundColor;
    try {
      await hoverUntilMatched(other, 'unselected day did not receive hover');
      await waitUntil(() => getComputedStyle(other).backgroundColor !== rest, 'hover did not repaint the day');
      // Compare the settled hover fill, not a frame of the fill transition.
      await Promise.all(other.getAnimations().map((animation) => animation.finished));
      expect(getComputedStyle(other).backgroundColor).to.not.equal(selectedFill);
    } finally {
      await resetMouse();
    }
  });

  it('announces the new month after navigation', async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-03-01"></lr-calendar>`);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"], button[part~="nav"]:last-of-type')!.click();
    await el.updateComplete;
    const live = [...document.querySelectorAll('[aria-live]')].map((node) => node.textContent ?? '').join(' ');
    const expected = new Intl.DateTimeFormat(el.locale || 'en', { month: 'long', year: 'numeric' }).format(new Date(2026, 3, 1));
    expect(live.includes(expected)).to.equal(true);
  });
});

it('emits only the calendar-specific month change, not the generic view event', async () => {
  const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-03-01"></lr-calendar>`);
  const details: unknown[] = [];
  let generic = 0;
  el.addEventListener('lr-month-change', (event) => details.push(event.detail));
  el.addEventListener('lr-view-change', () => { generic += 1; });
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]')!.click();
  expect(details).to.deep.equal([{ viewDate: '2026-04-01' }]);
  expect(generic).to.equal(0);
});

it('applies a caller-supplied tint over the calendar event fill on hover', async () => {
  const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-03-01"
    .events=${[{ date: '2026-03-10', title: 'Release', color: 'rgb(25, 80, 140)' }]}
    style="--lr-calendar-event-hover-tint: rgb(0, 200, 0)"></lr-calendar>`);
  const chip = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="event"]')!;
  await hoverUntilMatched(chip, 'calendar event did not receive hover');
  try {
    const { backgroundColor, backgroundImage } = getComputedStyle(chip);
    expect(backgroundColor).to.equal('rgb(25, 80, 140)');
    expect(backgroundImage).to.contain('rgb(0, 200, 0)');
  } finally {
    await resetMouse();
  }
});
