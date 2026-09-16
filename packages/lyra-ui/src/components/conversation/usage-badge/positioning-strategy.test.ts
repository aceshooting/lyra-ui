import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './usage-badge.js';
import type { LyraUsageBadge } from './usage-badge.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function tooltip(el: LyraUsageBadge): HTMLElement {
  return el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
}

async function openTooltip(wrapper: HTMLElement): Promise<LyraUsageBadge> {
  const el = wrapper.querySelector('lr-usage-badge') as LyraUsageBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new Event('mouseenter'));
  await el.updateComplete;
  await waitUntil(() => !tooltip(el).hidden, 'the tooltip never opened');
  await waitUntil(() => tooltip(el).style.left !== '', 'tooltip was never positioned');
  return el;
}

const markup = () => html`<div><lr-usage-badge tokens-in="10"></lr-usage-badge></div>`;

describe('positioning-strategy on lr-usage-badge', () => {
  it('defaults to fixed, which is what the breakdown tooltip has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const el = await openTooltip(wrapper);
    expect(getComputedStyle(tooltip(el)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-usage-badge', () => {
  it('lets an ancestor switch an unset badge to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const el = await openTooltip(wrapper);
    await waitUntil(
      () => getComputedStyle(tooltip(el)).position === 'absolute',
      'the ancestor override reaches an unset usage badge',
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
