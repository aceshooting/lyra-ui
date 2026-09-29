import { expect, html, nextFrame, waitUntil } from '@open-wc/testing';
import {
  headerFixture,
  hitBelongsTo,
  hitId,
  pointOverSibling,
} from '../../../../test/top-layer-header.js';
import type { LyraNavigationMenuItem } from '../navigation-menu-item/navigation-menu-item.class.js';
import type { LyraNavigationMenu } from './navigation-menu.class.js';
import './navigation-menu.js';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(
    html`<lr-navigation-menu mobile-breakpoint="20rem" expanded ?top-layer=${topLayer}>
      <lr-navigation-menu-item id="products"
        >Products<ul slot="panel" style="inline-size: 12rem; margin: 0"
          ><li><a href="#analytics">Analytics</a></li
          ><li><a href="#billing">Billing</a></li></ul
        ></lr-navigation-menu-item
      >
      <lr-navigation-menu-item id="docs" href="#docs">Docs</lr-navigation-menu-item>
    </lr-navigation-menu>`,
    '900px',
  );
  const menu = wrapper.querySelector('lr-navigation-menu') as LyraNavigationMenu;
  const item = wrapper.querySelector('#products') as LyraNavigationMenuItem;
  await menu.updateComplete;
  await item.updateComplete;
  await nextFrame();
  const panel = item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
  return { menu, item, sibling, panel };
}

async function openPlaced(item: LyraNavigationMenuItem, panel: HTMLElement): Promise<void> {
  item.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!.click();
  await waitUntil(
    () =>
      item.open &&
      !panel.hidden &&
      panel.getBoundingClientRect().height > 0 &&
      getComputedStyle(panel).visibility !== 'hidden',
    'the panel is placed',
  );
}

describe('top-layer on lr-navigation-menu', () => {
  it('defaults off: a bar panel stays beneath a higher sibling', async () => {
    const { menu, item, sibling, panel } = await mount(false);
    expect(menu.topLayer).to.equal(false);
    expect(menu.hasAttribute('top-layer')).to.equal(false);
    await openPlaced(item, panel);
    const [x, y] = pointOverSibling(panel, sibling);
    expect(panel.matches(':popover-open')).to.equal(false);
    expect(hitId(x, y)).to.equal('sibling');
  });

  it('paints above the higher sibling when opted in, and releases when unset', async () => {
    const { menu, item, sibling, panel } = await mount(true);
    expect(menu.topLayer).to.equal(true);
    await openPlaced(item, panel);
    await waitUntil(() => panel.matches(':popover-open'), 'the panel is promoted');
    const [x, y] = pointOverSibling(panel, sibling);
    expect(hitBelongsTo(item, x, y), 'the panel wins the hit test over the sibling').to.equal(true);
    const baseRect = item.shadowRoot!.querySelector('[part~="base"]')!.getBoundingClientRect();
    expect(panel.getBoundingClientRect().top).to.be.at.least(baseRect.bottom - 1);

    menu.topLayer = false;
    await waitUntil(() => !panel.matches(':popover-open'), 'turning it off releases the top layer');
    await waitUntil(
      () => panel.getBoundingClientRect().height > 0,
      'the panel stays open and placed',
    );
    expect(item.open).to.equal(true);
    const [x2, y2] = pointOverSibling(panel, sibling);
    expect(hitId(x2, y2)).to.equal('sibling');
  });
});
