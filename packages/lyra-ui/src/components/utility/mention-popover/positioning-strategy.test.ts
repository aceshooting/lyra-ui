import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './mention-popover.js';
import type { LyraMentionItem, LyraMentionPopover } from './mention-popover.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function listbox(el: LyraMentionPopover): HTMLElement {
  return el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;
}

const ITEMS: LyraMentionItem[] = [
  { suggestionId: 'alice', label: 'Alice Johansson' },
];

async function openWithAnchor(wrapper: HTMLElement): Promise<LyraMentionPopover> {
  const trigger = wrapper.querySelector('#trigger') as HTMLElement;
  const el = wrapper.querySelector('lr-mention-popover') as LyraMentionPopover;
  el.anchor = trigger;
  el.items = ITEMS;
  el.open = true;
  await el.updateComplete;
  await waitUntil(() => listbox(el).style.left !== '', 'listbox was never positioned');
  return el;
}

const markup = () => html`
  <div>
    <button id="trigger" style="position:absolute; top:120px; left:80px; width:40px; height:20px;">@</button>
    <lr-mention-popover></lr-mention-popover>
  </div>
`;

describe('positioning-strategy on lr-mention-popover', () => {
  it('defaults to fixed, which is what the listbox has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const el = await openWithAnchor(wrapper);
    expect(getComputedStyle(listbox(el)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-mention-popover', () => {
  it('lets an ancestor switch an unset popover to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const el = await openWithAnchor(wrapper);
    await waitUntil(
      () => getComputedStyle(listbox(el)).position === 'absolute',
      'the ancestor override reaches an unset mention popover',
    );
  });

  it('ignores an unrecognized ancestor value and keeps the default', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: sticky">${markup()}</div>
    `);
    const el = await openWithAnchor(wrapper);
    expect(getComputedStyle(listbox(el)).position).to.equal('fixed');
  });
});
