import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './calendar.js';
import type { LyraCalendar } from './calendar.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

for (const year of ['0001', '0099', '0100']) {
  it(`renders and navigates the authored calendar year ${year}`, async () => {
    const el = await fixture<LyraCalendar>(html`<lr-calendar view-date=${`${year}-07-01`}></lr-calendar>`);
    expect(el.shadowRoot!.querySelectorAll(`[data-date^="${year}-07-"]`).length).to.equal(31);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next-button"]')!.click();
    await el.updateComplete;
    expect(el.viewDate).to.equal(`${year}-08-01`);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="previous-button"]')!.click();
    await el.updateComplete;
    expect(el.viewDate).to.equal(`${year}-07-01`);
  });
}
it('keeps colored agenda foreground and fill paired through hover and press', async () => {
  // Both invariants are read only AFTER the overlay that pointer feedback actually paints has
  // rendered, and --lr-transition-fast is zeroed: [part='agenda-event'] eases background-color, so
  // a regression that recoloured the fill would still report the RESTING colour for the first
  // frames after the pointer lands and this "the pair never moved" assertion would pass vacuously.
  const el = await fixture<LyraCalendar>(html`<lr-calendar style="--lr-transition-fast: 0s" view="agenda" view-date="2026-07-01" .events=${[{ date: '2026-07-15', title: 'Meeting', color: 'rgb(0, 60, 120)' }]}></lr-calendar>`);
  const item = el.shadowRoot!.querySelector<HTMLElement>('[part="agenda-event"]')!;
  const rest = getComputedStyle(item).backgroundColor;
  const foreground = getComputedStyle(item).color;
  const restingImage = getComputedStyle(item).backgroundImage;
  try {
    await hoverUntilMatched(item, 'agenda action hover');
    await waitUntil(() => getComputedStyle(item).backgroundImage !== restingImage, 'the hover overlay never painted');
    const hoveredImage = getComputedStyle(item).backgroundImage;
    expect(getComputedStyle(item).backgroundColor).to.equal(rest);
    expect(getComputedStyle(item).color).to.equal(foreground);
    await sendMouse({ type: 'down' });
    await waitUntil(() => item.matches(':active'), 'the agenda event never took the press');
    await waitUntil(() => getComputedStyle(item).backgroundImage !== hoveredImage, 'the press overlay never painted');
    expect(getComputedStyle(item).backgroundColor).to.equal(rest);
    expect(getComputedStyle(item).color).to.equal(foreground);
  } finally { await resetMouse(); }
});

it('repairs a foreign view token written on a mounted month calendar', async () => {
  const el = await fixture<LyraCalendar>(html`<lr-calendar></lr-calendar>`);
  el.setAttribute('view', 'week');
  await el.updateComplete;
  expect(el.getAttribute('view')).to.equal('month');
});

it('moves the day focus by month with PageUp/PageDown and to the month edges with Home/End', async () => {
  const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-01-01" value="2026-01-31"></lr-calendar>`);
  const visited: string[] = [];
  for (const key of ['PageDown', 'Home', 'End', 'PageUp']) {
    const day = el.shadowRoot!.querySelector<HTMLElement>('[part="day"][tabindex="0"]')!;
    day.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;
    visited.push(el.shadowRoot!.querySelector<HTMLElement>('[part="day"][tabindex="0"]')!.dataset['date']!);
  }
  expect(visited).to.deep.equal(['2026-02-28', '2026-02-01', '2026-02-28', '2026-01-28']);
});

it('does not rebuild the month buckets for a roving-focus move', async () => {
  const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-07-01" value="2026-07-10" .events=${[{ date: '2026-07-15', title: 'Meeting' }]}></lr-calendar>`);
  const target = el as unknown as { bucketEventsByDate: (events: unknown) => unknown };
  const original = target.bucketEventsByDate;
  let calls = 0;
  target.bucketEventsByDate = function (this: unknown, events: unknown) { calls += 1; return original.call(this, events); };
  try {
    el.shadowRoot!.querySelector<HTMLElement>('[part="day"][tabindex="0"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
    await el.updateComplete;
  } finally {
    delete (target as Partial<typeof target>).bucketEventsByDate;
  }
  expect(calls).to.equal(0);
});

it('renders the empty agenda message as a styleable part', async () => {
  const el = await fixture<LyraCalendar>(html`<lr-calendar view="agenda" view-date="2026-07-01"></lr-calendar>`);
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent!.trim()).to.equal('No events this month.');
});

it('buckets events once across renders that do not replace them', async () => {
  const el = await fixture<LyraCalendar>(html`<lr-calendar view-date="2026-07-01" .events=${[{ date: '2026-07-15', title: 'Meeting' }]}></lr-calendar>`);
  let calls = 0;
  const original = Reflect.get(el, 'bucketEventsByDate') as (events: unknown) => unknown;
  Reflect.set(el, 'bucketEventsByDate', (events: unknown) => { calls += 1; return original.call(el, events); });
  for (const value of ['2026-07-02', '2026-07-03']) {
    el.value = value;
    await el.updateComplete;
  }
  expect(calls).to.equal(0);
  el.events = [{ date: '2026-07-16', title: 'Other' }];
  await el.updateComplete;
  expect(calls).to.equal(1);
});
