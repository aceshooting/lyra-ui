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
