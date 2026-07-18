import { expect, fixture, html } from '@open-wc/testing';
import './dropdown-item.js';
import '../menu/menu.js';
import type { LyraDropdownItem } from './dropdown-item.class.js';

describe('<lr-dropdown-item>', () => {
  it('uses the menu-item behavior and role', async () => {
    const menu = await fixture(html`<lr-menu><button slot="trigger">Actions</button><lr-dropdown-item value="archive">Archive</lr-dropdown-item></lr-menu>`);
    const el = menu.querySelector('lr-dropdown-item') as LyraDropdownItem;
    expect(el.getAttribute('role')).to.equal('menuitem');
    expect(el.tabIndex).to.equal(-1);
  });

  it('is accessible', async () => {
    const menu = await fixture(html`<lr-menu label="Actions"><button slot="trigger">Actions</button><lr-dropdown-item value="archive">Archive</lr-dropdown-item></lr-menu>`);
    await expect(menu).to.be.accessible();
  });
});
