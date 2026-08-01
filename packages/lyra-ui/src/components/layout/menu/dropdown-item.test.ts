import { expect, fixture, html } from '@open-wc/testing';
import './dropdown-item.js';
import './menu.js';
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

  // Asserted against this tag rather than <lr-menu-item>: the ladder arrives through the
  // superclass's `static styles`, which a subclass silently loses the moment it declares its own.
  describe('size', () => {
    const rowHeight = (el: LyraDropdownItem): number =>
      (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getBoundingClientRect().height;

    it('defaults to size="m", reflected', async () => {
      const el = (await fixture(html`<lr-dropdown-item>Archive</lr-dropdown-item>`)) as LyraDropdownItem;
      expect(el.size).to.equal('m');
      expect(el.getAttribute('size')).to.equal('m');
    });

    it('grows the rendered row measurably from size="s" to size="l"', async () => {
      const small = (await fixture(html`<lr-dropdown-item size="s">Archive</lr-dropdown-item>`)) as LyraDropdownItem;
      const large = (await fixture(html`<lr-dropdown-item size="l">Archive</lr-dropdown-item>`)) as LyraDropdownItem;
      expect(rowHeight(large)).to.be.greaterThan(rowHeight(small));
    });

    it('keeps every tier at or above the 24px pointer-target floor', async () => {
      for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl']) {
        const el = (await fixture(
          html`<lr-dropdown-item size=${size}>Archive</lr-dropdown-item>`,
        )) as LyraDropdownItem;
        expect(rowHeight(el), size).to.be.at.least(24);
      }
    });
  });
});
