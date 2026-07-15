import { expect, fixture, html } from '@open-wc/testing';
import './dropdown-item.js';
import '../menu/menu.js';
import type { LyraDropdownItem } from './dropdown-item.class.js';

describe('<lyra-dropdown-item>', () => {
  it('uses the menu-item behavior and role', async () => {
    const menu = await fixture(html`<lyra-menu><button slot="trigger">Actions</button><lyra-dropdown-item value="archive">Archive</lyra-dropdown-item></lyra-menu>`);
    const el = menu.querySelector('lyra-dropdown-item') as LyraDropdownItem;
    expect(el.getAttribute('role')).to.equal('menuitem');
    expect(el.tabIndex).to.equal(-1);
  });

  it('is accessible', async () => {
    const menu = await fixture(html`<lyra-menu label="Actions"><button slot="trigger">Actions</button><lyra-dropdown-item value="archive">Archive</lyra-dropdown-item></lyra-menu>`);
    await expect(menu).to.be.accessible();
  });
});
