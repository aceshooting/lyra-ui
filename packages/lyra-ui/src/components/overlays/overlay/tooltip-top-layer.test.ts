import { expect, html, waitUntil } from '@open-wc/testing';
import { headerFixture, pointOverSibling } from '../../../../test/top-layer-header.js';
import '../../forms/button/button.js';
import type { LyraTooltip } from './tooltip.class.js';
import './tooltip.js';

const NO_MOTION = '--show-duration: 0ms; --hide-duration: 0ms; --lr-transition-fast: 0ms';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<lr-tooltip
    style=${NO_MOTION}
    placement="bottom"
    manual
    ?top-layer=${topLayer}
    content="Settings for the whole workspace"
  >
    <button slot="trigger">Gear</button>
  </lr-tooltip>`);
  const el = wrapper.querySelector('lr-tooltip') as LyraTooltip;
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
  return { el, sibling, popup };
}

async function openPlaced(el: LyraTooltip, popup: HTMLElement): Promise<void> {
  await el.show();
  await waitUntil(
    () => popup.style.left !== '' && popup.getBoundingClientRect().height > 0,
    'the bubble is placed',
  );
}

describe('top-layer on lr-tooltip', () => {
  it('defaults off: the bubble in a z-indexed fixed header is not promoted', async () => {
    const { el, sibling, popup } = await mount(false);
    expect(el.topLayer).to.equal(false);
    expect(el.hasAttribute('top-layer')).to.equal(false);
    await openPlaced(el, popup);
    pointOverSibling(popup, sibling);
    expect(popup.matches(':popover-open')).to.equal(false);
    expect(popup.hasAttribute('data-lr-top-layer')).to.equal(false);
    await el.hide();
  });

  it('is promoted above the higher sibling when opted in, and releases when unset', async () => {
    const { el, sibling, popup } = await mount(true);
    expect(el.topLayer).to.equal(true);
    await openPlaced(el, popup);
    await waitUntil(() => popup.matches(':popover-open'), 'the bubble is promoted');
    expect(getComputedStyle(popup).position).to.equal('fixed');
    pointOverSibling(popup, sibling);
    const triggerRect = el.querySelector('button')!.getBoundingClientRect();
    expect(popup.getBoundingClientRect().top).to.be.closeTo(triggerRect.bottom, 16);

    el.topLayer = false;
    await waitUntil(() => !popup.matches(':popover-open'), 'turning it off releases the top layer');
    expect(el.open).to.equal(true);
    await el.hide();
  });

  it('leaves the top layer once it settles closed', async () => {
    const { el, popup } = await mount(true);
    await openPlaced(el, popup);
    await waitUntil(() => popup.matches(':popover-open'), 'the bubble is promoted');
    await el.hide();
    await waitUntil(() => !popup.matches(':popover-open'), 'the promotion is released once closed');
  });
});
