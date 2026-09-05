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
  const el = await fixture<LyraCalendar>(html`<lr-calendar view="agenda" view-date="2026-07-01" .events=${[{ date: '2026-07-15', title: 'Meeting', color: 'rgb(0, 60, 120)' }]}></lr-calendar>`);
  const item = el.shadowRoot!.querySelector<HTMLElement>('[part="agenda-event"]')!;
  const rest = getComputedStyle(item).backgroundColor;
  const foreground = getComputedStyle(item).color;
  try {
    await hoverUntilMatched(item, 'agenda action hover');
    expect(getComputedStyle(item).backgroundColor).to.equal(rest);
    expect(getComputedStyle(item).color).to.equal(foreground);
    await sendMouse({ type: 'down' });
    await waitUntil(() => item.matches(':active'));
    expect(getComputedStyle(item).backgroundColor).to.equal(rest);
    expect(getComputedStyle(item).color).to.equal(foreground);
  } finally { await resetMouse(); }
});
