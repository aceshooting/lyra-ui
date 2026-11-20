import { expect, html, waitUntil } from '@open-wc/testing';
import { headerFixture, hitBelongsTo, pointOverSibling } from '../../../../test/top-layer-header.js';
import '../../lr-usage-badge.js';
import type { LyraUsageBadge } from './usage-badge.class.js';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<lr-usage-badge
    data-lr-theme-scope tokens-in="1200" tokens-out="340" cost-text="$0.012" latency-ms="850"
    ?top-layer=${topLayer}></lr-usage-badge>`);
  const el = wrapper.querySelector('lr-usage-badge') as LyraUsageBadge;
  await el.updateComplete;
  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('mouseenter'));
  await el.updateComplete;
  const tooltip = el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!;
  await waitUntil(
    () => !tooltip.hidden && tooltip.style.left !== '' && tooltip.getBoundingClientRect().height > 0,
    'the tooltip is placed',
  );
  return { el, sibling, tooltip };
}

function leave(el: LyraUsageBadge): void {
  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('mouseleave'));
}

describe('top-layer on lr-usage-badge', () => {
  it('defaults off, beneath a higher sibling, at the leased overlay stack index', async () => {
    const { el, sibling, tooltip } = await mount(false);
    expect(el.topLayer).to.equal(false);
    const [x, y] = pointOverSibling(tooltip, sibling);
    expect(tooltip.matches(':popover-open')).to.equal(false);
    expect(hitBelongsTo(el, x, y)).to.equal(false);
    const leased = el.style.getPropertyValue('--lr-overlay-stack-index').trim();
    expect(leased).to.not.equal('');
    expect(getComputedStyle(tooltip).zIndex).to.equal(leased);
    leave(el);
  });

  it('paints above the higher sibling when opted in, and releases when unset', async () => {
    const { el, sibling, tooltip } = await mount(true);
    expect(el.getAttribute('top-layer')).to.equal('');
    await waitUntil(() => tooltip.matches(':popover-open'), 'the tooltip is promoted');
    const [x, y] = pointOverSibling(tooltip, sibling);
    expect(hitBelongsTo(el, x, y), 'the tooltip wins the hit test over the sibling').to.equal(true);
    el.topLayer = false;
    await waitUntil(() => !tooltip.matches(':popover-open'), 'turning it off releases the top layer');
    expect(tooltip.hidden).to.equal(false);
    leave(el);
  });
});
