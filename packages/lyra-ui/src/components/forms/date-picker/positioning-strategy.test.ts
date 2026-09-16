import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './date-input.js';
import type { LyraDateInput } from './date-input.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function popup(el: LyraDateInput): HTMLElement {
  return el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
}

async function openPopup(wrapper: HTMLElement): Promise<LyraDateInput> {
  const el = wrapper.querySelector('lr-date-input') as LyraDateInput;
  el.open = true;
  await el.updateComplete;
  await waitUntil(() => popup(el).style.left !== '', 'the calendar popup was never positioned');
  return el;
}

const markup = () => html`<div><lr-date-input value="2026-07-15"></lr-date-input></div>`;

describe('positioning-strategy on lr-date-input', () => {
  it('defaults to fixed, which is what the calendar popup has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const el = await openPopup(wrapper);
    expect(getComputedStyle(popup(el)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-date-input', () => {
  it('lets an ancestor switch an unset date input to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const el = await openPopup(wrapper);
    await waitUntil(
      () => getComputedStyle(popup(el)).position === 'absolute',
      'the ancestor override reaches an unset date input',
    );
  });

  it('ignores an unrecognized ancestor value and keeps the default', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: sticky">${markup()}</div>
    `);
    const el = await openPopup(wrapper);
    expect(getComputedStyle(popup(el)).position).to.equal('fixed');
  });
});
