import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.js';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';

// showFlags defaults to true, so opening the listbox below renders a `<lr-flag>` per locale row
// (and the trigger). This file only cares about positioning, but an unregistered resolver still
// warns -- mirrors locale-picker.test.ts's own stub registration.
const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
setFlagUrlResolver(async () => TEST_FLAG_SRC);

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
