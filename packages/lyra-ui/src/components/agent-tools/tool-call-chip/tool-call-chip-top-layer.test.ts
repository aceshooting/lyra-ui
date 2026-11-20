import { expect, html, waitUntil } from '@open-wc/testing';
import { headerFixture, pointOverSibling } from '../../../../test/top-layer-header.js';
import '../../lr-tool-call-chip.js';
import type { LyraToolCallChip } from './tool-call-chip.class.js';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<lr-tool-call-chip
    data-lr-theme-scope name="web_search" ?top-layer=${topLayer}
    ><p>Searching the documentation index for the configured query</p></lr-tool-call-chip>`);
  const el = wrapper.querySelector('lr-tool-call-chip') as LyraToolCallChip;
  await el.updateComplete;
  const tooltip = el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!;
  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('mouseenter'));
  await el.updateComplete;
  await waitUntil(
    () => !tooltip.hidden && tooltip.style.left !== '' && tooltip.getBoundingClientRect().height > 0,
    'the tooltip is placed',
  );
  return { el, sibling, tooltip };
}

function leave(el: LyraToolCallChip): void {
  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('mouseleave'));
}

describe('top-layer on lr-tool-call-chip', () => {
  it('defaults off, beneath a higher sibling, at the leased overlay stack index', async () => {
    const { el, sibling, tooltip } = await mount(false);
    expect(el.topLayer).to.equal(false);
    // The tooltip is inert, so it is never a hit-test target; the overlap and its promotion state
    // are what distinguish the two modes.
    pointOverSibling(tooltip, sibling);
    expect(tooltip.matches(':popover-open')).to.equal(false);
    const leased = el.style.getPropertyValue('--lr-overlay-stack-index').trim();
    expect(leased).to.not.equal('');
    expect(getComputedStyle(tooltip).zIndex).to.equal(leased);
    leave(el);
  });

  it('paints above the higher sibling when opted in, and releases when unset', async () => {
    const { el, sibling, tooltip } = await mount(true);
    expect(el.getAttribute('top-layer')).to.equal('');
    await waitUntil(() => tooltip.matches(':popover-open'), 'the tooltip is promoted');
    pointOverSibling(tooltip, sibling);
    expect(getComputedStyle(tooltip).position).to.equal('fixed');
    el.topLayer = false;
    await waitUntil(() => !tooltip.matches(':popover-open'), 'turning it off releases the top layer');
    expect(tooltip.hidden).to.equal(false);
    el.topLayer = true;
    await waitUntil(() => tooltip.matches(':popover-open'), 'turning it on again promotes live');
    leave(el);
    await waitUntil(() => !tooltip.matches(':popover-open'), 'closing leaves the top layer');
  });
});
