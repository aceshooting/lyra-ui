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
