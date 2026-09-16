import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './app-rail-item.js';
import type { LyraAppRailItem } from './app-rail-item.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function tooltip(el: LyraAppRailItem): HTMLElement {
  return el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
}

async function openTooltip(wrapper: HTMLElement): Promise<LyraAppRailItem> {
  const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  await el.updateComplete;
  await waitUntil(() => tooltip(el).style.left !== '', 'the flyout tooltip was never positioned');
  return el;
}

const markup = () => html`
  <div><lr-app-rail-item tooltip icon-only>Dashboard</lr-app-rail-item></div>
`;

describe('positioning-strategy on lr-app-rail-item', () => {
  it('defaults to fixed, which is what the flyout tooltip has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const el = await openTooltip(wrapper);
    expect(getComputedStyle(tooltip(el)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-app-rail-item', () => {
  it('lets an ancestor switch an unset item to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const el = await openTooltip(wrapper);
    await waitUntil(
      () => getComputedStyle(tooltip(el)).position === 'absolute',
      'the ancestor override reaches an unset rail item',
    );
  });

  it('ignores an unrecognized ancestor value and keeps the default', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: sticky">${markup()}</div>
    `);
    const el = await openTooltip(wrapper);
    expect(getComputedStyle(tooltip(el)).position).to.equal('fixed');
  });
});
