import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './citation-badge.js';
import type { LyraCitationBadge } from './citation-badge.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function popover(el: LyraCitationBadge): HTMLElement {
  return el.shadowRoot!.querySelector('[part="popover"]') as HTMLElement;
}

async function openPopover(wrapper: HTMLElement): Promise<LyraCitationBadge> {
  const el = wrapper.querySelector('lr-citation-badge') as LyraCitationBadge;
  // The subject is positioning, not focus modality, so the ungated hover path opens it.
  (el.shadowRoot!.querySelector('.wrapper') as HTMLElement).dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  await el.updateComplete;
  await waitUntil(() => !popover(el).hidden, 'the preview popover never opened');
  await waitUntil(() => popover(el).style.left !== '', 'the preview popover was never positioned');
  return el;
}

const markup = () => html`
  <div>
    <lr-citation-badge index="1"><span>Preview</span></lr-citation-badge>
  </div>
`;

describe('positioning-strategy on lr-citation-badge', () => {
  it('defaults to fixed, which is what the preview popover has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(markup());
    const el = await openPopover(wrapper);
    expect(getComputedStyle(popover(el)).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-citation-badge', () => {
  it('lets an ancestor switch an unset badge to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${markup()}</div>
    `);
    const el = await openPopover(wrapper);
    await waitUntil(
      () => getComputedStyle(popover(el)).position === 'absolute',
      'the ancestor override reaches an unset citation badge',
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
