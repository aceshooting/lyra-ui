import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function listbox(el: LyraLocalePicker): HTMLElement {
  return el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;
}

async function openListbox(wrapper: HTMLElement): Promise<LyraLocalePicker> {
  const el = wrapper.querySelector('lr-locale-picker') as LyraLocalePicker;
  el.open = true;
  await el.updateComplete;
  await waitUntil(() => listbox(el).style.left !== '', 'listbox was never positioned');
  return el;
}

const markup = () => html`<div><lr-locale-picker .locales=${['en', 'fr']}></lr-locale-picker></div>`;

describe('positioning-strategy on lr-locale-picker', () => {
  it('defaults to fixed, which is what the listbox has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const el = await openListbox(wrapper);
    expect(getComputedStyle(listbox(el)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-locale-picker', () => {
  it('lets an ancestor switch an unset picker to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const el = await openListbox(wrapper);
    await waitUntil(
      () => getComputedStyle(listbox(el)).position === 'absolute',
      'the ancestor override reaches an unset locale picker',
    );
  });

  it('ignores an unrecognized ancestor value and keeps the default', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: sticky">${markup()}</div>
    `);
    const el = await openListbox(wrapper);
    expect(getComputedStyle(listbox(el)).position).to.equal('fixed');
  });
});
