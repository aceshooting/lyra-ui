import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './time-input.js';
import type { LyraTimeInput } from './time-input.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function popup(el: LyraTimeInput): HTMLElement {
  return el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
}

async function openPopup(wrapper: HTMLElement): Promise<LyraTimeInput> {
  const el = wrapper.querySelector('lr-time-input') as LyraTimeInput;
  const afterShow = oneEvent(el, 'lr-after-show');
  el.open = true;
  await afterShow;
  await waitUntil(() => popup(el).style.left !== '', 'the column picker was never positioned');
  return el;
}

const markup = () => html`<div><lr-time-input value="10:00"></lr-time-input></div>`;

describe('positioning-strategy on lr-time-input', () => {
  it('defaults to fixed, which is what the column picker has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const el = await openPopup(wrapper);
    expect(getComputedStyle(popup(el)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-time-input', () => {
  it('lets an ancestor switch an unset time input to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const el = await openPopup(wrapper);
    await waitUntil(
      () => getComputedStyle(popup(el)).position === 'absolute',
      'the ancestor override reaches an unset time input',
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
