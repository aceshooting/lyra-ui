import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { headerFixture, hitBelongsTo, pointOverSibling } from '../../../../test/top-layer-header.js';
import '../../lr-menu.js';
import '../../lr-menu-item.js';
import '../../lr-dropdown.js';
import type { LyraMenu } from './menu.class.js';
import type { LyraMenuItem } from './menu-item.class.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';

const NO_MOTION = '--lr-transition-fast: 0ms';

function surface(item: LyraMenuItem): HTMLElement {
  return item.querySelector('lr-menu')!.shadowRoot!.querySelector<HTMLElement>('.submenu-surface')!;
}

async function openSubmenu(item: LyraMenuItem): Promise<HTMLElement> {
  item.openSubmenu('none');
  const popup = surface(item);
  await waitUntil(
    () => getComputedStyle(popup).visibility === 'visible' && popup.style.left !== '',
    'the submenu is placed',
  );
  return popup;
}

async function mount(topLayer: boolean, nestedTopLayer = false) {
  const { wrapper, sibling } = await headerFixture(html`<lr-menu
    data-lr-theme-scope label="Actions" style=${NO_MOTION} ?top-layer=${topLayer}>
    <lr-menu-item id="share">Share<lr-menu slot="submenu" ?top-layer=${nestedTopLayer}
      ><lr-menu-item>Email</lr-menu-item><lr-menu-item>Link</lr-menu-item></lr-menu
    ></lr-menu-item>
  </lr-menu>`);
  const menu = wrapper.querySelector('lr-menu') as LyraMenu;
  await menu.updateComplete;
  return { menu, sibling, share: wrapper.querySelector<LyraMenuItem>('#share')! };
}

describe('top-layer on lr-menu', () => {
  it('defaults off: a submenu stays beneath a higher sibling', async () => {
    const { menu, sibling, share } = await mount(false);
    expect(menu.topLayer).to.equal(false);
    const popup = await openSubmenu(share);
    const [x, y] = pointOverSibling(popup, sibling);
    expect(popup.matches(':popover-open')).to.equal(false);
    expect(hitBelongsTo(menu, x, y)).to.equal(false);
    share.closeSubmenu();
  });

  it('promotes submenus opened from an opted-in ancestor menu, and releases when unset', async () => {
    const { menu, sibling, share } = await mount(true);
    const popup = await openSubmenu(share);
    await waitUntil(() => popup.matches(':popover-open'), 'the submenu is promoted');
    const [x, y] = pointOverSibling(popup, sibling);
    expect(hitBelongsTo(menu, x, y), 'the submenu wins the hit test over the sibling').to.equal(true);
    share.closeSubmenu();
    await waitUntil(() => !popup.matches(':popover-open'), 'a settled close leaves the top layer');
  });

  it('honours the submenu menu\'s own top-layer live while open', async () => {
    const { share } = await mount(false, true);
    const nested = share.querySelector('lr-menu') as LyraMenu;
    const popup = await openSubmenu(share);
    await waitUntil(() => popup.matches(':popover-open'), 'the submenu is promoted');
    nested.topLayer = false;
    await waitUntil(() => !popup.matches(':popover-open'), 'turning it off releases the top layer');
    expect(share.getAttribute('aria-expanded')).to.equal('true');
    share.closeSubmenu();
  });

  it('applies an enclosing menu\'s top-layer live to an already open submenu', async () => {
    const { menu, share } = await mount(false);
    const popup = await openSubmenu(share);
    expect(popup.matches(':popover-open')).to.equal(false);
    menu.topLayer = true;
    await waitUntil(() => popup.matches(':popover-open'), 'the open submenu is promoted');
    menu.topLayer = false;
    await waitUntil(() => !popup.matches(':popover-open'), 'unsetting it releases the open submenu');
    expect(share.getAttribute('aria-expanded')).to.equal('true');
    share.closeSubmenu();
  });

  it('stacks a submenu at its enclosing overlay\'s leased stack index', async () => {
    const dropdown = await fixture<LyraDropdown>(html`<lr-dropdown data-lr-theme-scope style=${NO_MOTION}>
      <button slot="trigger">Open</button>
      <lr-menu label="Actions"><lr-menu-item id="share">Share<lr-menu slot="submenu"
        ><lr-menu-item>Email</lr-menu-item></lr-menu></lr-menu-item></lr-menu>
    </lr-dropdown>`);
    await dropdown.show();
    await waitUntil(() => dropdown.style.getPropertyValue('--lr-overlay-stack-index') !== '', 'the dropdown leases a stack index');
    const popup = await openSubmenu(dropdown.querySelector<LyraMenuItem>('#share')!);
    expect(getComputedStyle(popup).zIndex).to.equal(dropdown.style.getPropertyValue('--lr-overlay-stack-index').trim());
    await dropdown.hide();
  });
});
