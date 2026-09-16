import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './tool-call-chip.js';
import type { LyraToolCallChip } from './tool-call-chip.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function tooltip(el: LyraToolCallChip): HTMLElement {
  return el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
}

async function openTooltip(wrapper: HTMLElement): Promise<LyraToolCallChip> {
  const el = wrapper.querySelector('lr-tool-call-chip') as LyraToolCallChip;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new MouseEvent('mouseenter'));
  await el.updateComplete;
  await waitUntil(() => !tooltip(el).hidden, 'the tooltip never opened');
  await waitUntil(() => tooltip(el).style.left !== '', 'tooltip was never positioned');
  return el;
}

const markup = () => html`
  <div>
    <lr-tool-call-chip name="web_search"><p>Query: solar panel efficiency</p></lr-tool-call-chip>
  </div>
`;

describe('positioning-strategy on lr-tool-call-chip', () => {
  it('defaults to fixed, which is what the detail tooltip has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const el = await openTooltip(wrapper);
    expect(getComputedStyle(tooltip(el)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-tool-call-chip', () => {
  it('lets an ancestor switch an unset chip to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const el = await openTooltip(wrapper);
    await waitUntil(
      () => getComputedStyle(tooltip(el)).position === 'absolute',
      'the ancestor override reaches an unset tool call chip',
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
