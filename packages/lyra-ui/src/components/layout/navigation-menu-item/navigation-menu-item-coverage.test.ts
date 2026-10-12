import { aTimeout, expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraNavigationMenuItem, LyraNavigationMenuToggleDetail } from './navigation-menu-item.class.js';
import './navigation-menu-item.js';
import '../navigation-menu/navigation-menu.js';

function base(item: LyraNavigationMenuItem): HTMLElement {
  return item.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
}

async function click(target: HTMLElement): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({
    type: 'click',
    position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
  });
}

it('normalizes an initial open write when its panel is removed before the first render, then recovers', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const item = document.createElement('lr-navigation-menu-item') as LyraNavigationMenuItem;
  const panel = document.createElement('div');
  panel.slot = 'panel';
  panel.textContent = 'Temporary panel';
  item.append(panel);
  item.open = true;
  const events: LyraNavigationMenuToggleDetail[] = [];
  item.addEventListener('lr-toggle', (event) => {
    events.push((event as CustomEvent<LyraNavigationMenuToggleDetail>).detail);
  });
  wrapper.append(item);
  panel.remove();
  await item.updateComplete;
  await nextFrame();
  expect(item.open, 'the pre-render write is normalized when the panel is gone').to.equal(false);
  expect(events).to.have.length(0);

  const replacement = document.createElement('div');
  replacement.slot = 'panel';
  replacement.textContent = 'Available panel';
  item.append(replacement);
  await waitUntil(() => base(item).getAttribute('aria-expanded') === 'false');
  item.open = true;
  await item.updateComplete;
  expect(item.open).to.equal(true);
  expect(item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!.hidden).to.equal(false);
  expect(events.map(({ expanded }) => expanded)).to.deep.equal([true]);
});

it('pins an owned hover-open panel after a real click and pointer departure', async () => {
  const menu = await fixture(html`<lr-navigation-menu data-lr-theme-scope style="--lr-navigation-menu-show-duration:0ms;--lr-navigation-menu-hide-duration:0ms">
    <lr-navigation-menu-item id="products">Products
      <ul slot="panel" style="inline-size:12rem;margin:0"><li><a href="#plans">Plans</a></li></ul>
    </lr-navigation-menu-item>
  </lr-navigation-menu>`);
  const item = menu.querySelector<LyraNavigationMenuItem>('#products')!;
  try {
    await hoverUntilMatched(base(item), 'the pointer did not reach the navigation item');
    await waitUntil(() => item.open, 'the owned menu did not open on hover');
    // wait-reason: negative assertion, a pointer-held panel stays open beyond the hide delay
    await aTimeout(350);
    expect(item.open).to.equal(true);

    await click(base(item));
    await item.updateComplete;
    await sendMouse({ type: 'move', position: [800, 600] });
    // wait-reason: negative assertion, a pinned panel stays open after the pointer-leave hide delay
    await aTimeout(350);
    expect(item.open, 'clicking the hovered trigger pins its panel').to.equal(true);
    expect(item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!.hidden).to.equal(false);
  } finally {
    await sendMouse({ type: 'move', position: [800, 600] });
  }
});
