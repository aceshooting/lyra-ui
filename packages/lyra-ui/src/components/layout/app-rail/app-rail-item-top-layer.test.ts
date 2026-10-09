import { expect, html, waitUntil } from '@open-wc/testing';
import { headerFixture, pointOverSibling } from '../../../../test/top-layer-header.js';
import type { LyraAppRailItem } from './app-rail-item.class.js';
import './app-rail.js';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(
    html`<lr-app-rail-item data-lr-theme-scope
      icon-only
      tooltip
      ?top-layer=${topLayer}
      style="--lr-transition-fast: 0ms"
      ><span slot="icon">D</span>Dashboard</lr-app-rail-item
    >`,
    '96px',
  );
  const item = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
  await item.updateComplete;
  return { item, sibling };
}

async function showTooltip(item: LyraAppRailItem): Promise<HTMLElement> {
  item.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!
    .dispatchEvent(new MouseEvent('mouseenter'));
  await waitUntil(
    () => item.shadowRoot!.querySelector('[part="tooltip"]') !== null,
    'the label flyout renders',
  );
  const tip = item.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!;
  await waitUntil(
    () => tip.getBoundingClientRect().height > 0 && tip.style.left !== '',
    'the flyout is placed',
  );
  return tip;
}

describe('top-layer on lr-app-rail-item', () => {
  it('defaults off: the label flyout in a z-indexed fixed rail is not promoted', async () => {
    const { item, sibling } = await mount(false);
    expect(item.topLayer).to.equal(false);
    expect(item.hasAttribute('top-layer')).to.equal(false);
    const tip = await showTooltip(item);
    pointOverSibling(tip, sibling);
    expect(tip.matches(':popover-open')).to.equal(false);
  });

  it('is promoted above the higher sibling when opted in, and releases when unset', async () => {
    const { item, sibling } = await mount(true);
    expect(item.topLayer).to.equal(true);
    const tip = await showTooltip(item);
    await waitUntil(() => tip.matches(':popover-open'), 'the flyout is promoted');
    expect(getComputedStyle(tip).position).to.equal('fixed');
    pointOverSibling(tip, sibling);

    item.topLayer = false;
    await waitUntil(() => !tip.matches(':popover-open'), 'turning it off releases the top layer');
  });

  it('is forwarded by <lr-app-rail top-layer> without overwriting the item', async () => {
    const { wrapper, sibling } = await headerFixture(
      html`<lr-app-rail top-layer mode="icon-only" force-mode="icon-only"
        ><lr-app-rail-item data-lr-theme-scope tooltip style="--lr-transition-fast: 0ms"
          ><span slot="icon">D</span>Dashboard</lr-app-rail-item
        ></lr-app-rail
      >`,
      '96px',
    );
    const item = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    await item.updateComplete;
    expect(item.topLayer).to.equal(false);
    const tip = await showTooltip(item);
    await waitUntil(() => tip.matches(':popover-open'), 'the rail promotes the flyout');
    pointOverSibling(tip, sibling);
  });
});
