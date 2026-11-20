import { expect, html, waitUntil } from '@open-wc/testing';
import { headerFixture, hitBelongsTo, pointOverSibling } from '../../../../test/top-layer-header.js';
import { deepActiveElement } from '../../../internal/nonmodal-overlay-manager.js';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-export-button.js';
import type { LyraExportButton } from '../../lr-export-button.js';

const NO_MOTION = '--lr-transition-fast: 0ms';

async function mount(topLayer: boolean) {
  const { wrapper, sibling } = await headerFixture(html`<lr-export-button
    data-lr-theme-scope style=${NO_MOTION} ?top-layer=${topLayer} .formats=${['csv', 'json']}></lr-export-button>`);
  const el = wrapper.querySelector('lr-export-button') as LyraExportButton;
  await el.updateComplete;
  const menu = el.shadowRoot!.querySelector<HTMLElement>('[part="menu"]')!;
  el.open = true;
  await el.updateComplete;
  await waitUntil(
    () => menu.hasAttribute('data-positioned') && menu.getBoundingClientRect().height > 0,
    'the menu is placed',
  );
  return { el, sibling, menu };
}

describe('top-layer on lr-export-button', () => {
  it('defaults off, beneath a higher sibling, at the leased overlay stack index', async () => {
    const { el, sibling, menu } = await mount(false);
    expect(el.topLayer).to.equal(false);
    const [x, y] = pointOverSibling(menu, sibling);
    expect(menu.matches(':popover-open')).to.equal(false);
    expect(hitBelongsTo(el, x, y)).to.equal(false);
    const leased = el.style.getPropertyValue('--lr-overlay-stack-index').trim();
    expect(leased).to.not.equal('');
    expect(getComputedStyle(menu).zIndex).to.equal(leased);
    el.open = false;
  });

  it('paints above the higher sibling when opted in, and releases when unset without moving focus', async () => {
    const { el, sibling, menu } = await mount(true);
    expect(el.getAttribute('top-layer')).to.equal('');
    await waitUntil(() => menu.matches(':popover-open'), 'the menu is promoted');
    const [x, y] = pointOverSibling(menu, sibling);
    expect(hitBelongsTo(el, x, y), 'the menu wins the hit test over the sibling').to.equal(true);
    const items = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="menu-item"]');
    await waitUntil(() => deepActiveElement(document) === items[0], 'opening focuses the first item');
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => deepActiveElement(document) === items[1], 'ArrowDown moves to the second item');
    el.topLayer = false;
    await waitUntil(() => !menu.matches(':popover-open'), 'turning it off releases the top layer');
    await waitUntil(() => menu.hasAttribute('data-positioned'), 'the menu is placed again');
    expect(el.open).to.equal(true);
    expect(deepActiveElement(document) === items[1], 'focus stays on the second item').to.equal(true);
    el.open = false;
  });
});
