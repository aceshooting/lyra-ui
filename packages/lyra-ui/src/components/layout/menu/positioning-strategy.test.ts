import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './menu.js';
import './menu-item.js';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';

/** The positioner writes `position` on the popup itself, so the RENDERED value -- never the
 *  stylesheet text -- is what these assertions read. */
function submenuSurface(menu: LyraMenu): HTMLElement {
  return menu.shadowRoot!.querySelector('.submenu-surface') as HTMLElement;
}

function byId<T extends HTMLElement = HTMLElement>(root: ParentNode, id: string): T {
  return root.querySelector(`#${id}`) as T;
}

const nested = () => html`
  <lr-menu label="Row actions">
    <lr-menu-item value="share" id="share">
      Share
      <lr-menu slot="submenu" id="share-menu">
        <lr-menu-item value="email" id="email">Email</lr-menu-item>
      </lr-menu>
    </lr-menu-item>
  </lr-menu>
`;

async function openSubmenu(wrapper: HTMLElement): Promise<LyraMenu> {
  const menu = wrapper.querySelector('lr-menu') as LyraMenu;
  const share = byId<LyraMenuItem>(menu, 'share');
  const child = byId<LyraMenu>(menu, 'share-menu');
  await share.openSubmenu('none');
  await menu.updateComplete;
  await child.updateComplete;
  return child;
}

describe('positioning-strategy on lr-menu (private submenu surface)', () => {
  it('defaults to fixed, which is what the submenu surface has always rendered', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>${nested()}</div>`);
    const child = await openSubmenu(wrapper);
    const surface = submenuSurface(child);
    await waitUntil(() => surface.style.left !== '', 'submenu was never positioned');
    expect(getComputedStyle(surface).position).to.equal('fixed');
  });
});

describe('the cascading --lr-positioning-strategy custom property on lr-menu', () => {
  it('lets an ancestor switch an unset submenu to absolute', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: absolute">${nested()}</div>
    `);
    const child = await openSubmenu(wrapper);
    const surface = submenuSurface(child);
    await waitUntil(
      () => surface.style.left !== '' && getComputedStyle(surface).position === 'absolute',
      'the ancestor override reaches the unset submenu',
    );
  });

  it('ignores an unrecognized ancestor value and keeps the default', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-positioning-strategy: sticky">${nested()}</div>
    `);
    const child = await openSubmenu(wrapper);
    const surface = submenuSurface(child);
    await waitUntil(() => surface.style.left !== '', 'submenu was never positioned');
    expect(getComputedStyle(surface).position).to.equal('fixed');
  });
});
