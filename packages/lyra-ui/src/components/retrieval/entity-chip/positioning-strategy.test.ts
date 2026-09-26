import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './entity-chip.js';
import type { LyraEntityChip } from './entity-chip.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function popover(el: LyraEntityChip): HTMLElement {
  return el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
}

async function openPopover(wrapper: HTMLElement): Promise<LyraEntityChip> {
  const el = wrapper.querySelector('lr-entity-chip') as LyraEntityChip;
  // The subject is positioning, not focus modality, so the ungated hover path opens it.
  (el.shadowRoot!.querySelector('.wrapper') as HTMLElement).dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  await el.updateComplete;
  await waitUntil(() => !popover(el).hidden, 'the preview popover never opened');
  await waitUntil(() => popover(el).style.left !== '', 'the preview popover was never positioned');
  return el;
}

const markup = () => html`
  <div>
    <lr-entity-chip entity-id="marie" text="Marie Curie">Physicist</lr-entity-chip>
  </div>
`;

describe('positioning-strategy on lr-entity-chip', () => {
  it('defaults to fixed, which is what the preview popover has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const el = await openPopover(wrapper);
    expect(getComputedStyle(popover(el)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-entity-chip', () => {
  it('lets an ancestor switch an unset chip to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const el = await openPopover(wrapper);
    await waitUntil(
      () => getComputedStyle(popover(el)).position === 'absolute',
      'the ancestor override reaches an unset entity chip',
    );
  });

  it('ignores an unrecognized ancestor value and keeps the default', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: sticky">${markup()}</div>
    `);
    const el = await openPopover(wrapper);
    expect(getComputedStyle(popover(el)).position).to.equal('fixed');
  });
});
