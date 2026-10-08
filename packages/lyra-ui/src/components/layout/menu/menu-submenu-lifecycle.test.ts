import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './menu.js';
import './dropdown-item.js';
import type { LyraDropdownItem } from './dropdown-item.js';

describe('submenu content and focus lifecycle', () => {
  it('uses submenuOpen property assignments as idempotent open and close requests', async () => {
    const menu = await fixture<HTMLElement>(html`<lr-menu label="Actions">
      <lr-dropdown-item>Share
        <lr-dropdown-item slot="submenu">Email</lr-dropdown-item>
      </lr-dropdown-item>
    </lr-menu>`);
    const parent = menu.querySelector<LyraDropdownItem>('lr-dropdown-item')!;
    await waitUntil(() => parent.hasSubmenu);
    parent.submenuOpen = false;
    await parent.updateComplete;
    expect(parent.hasAttribute('submenuopen')).to.equal(false);
    parent.submenuOpen = true;
    await waitUntil(() => parent.submenuOpen);
    parent.submenuOpen = true;
    await parent.updateComplete;
    expect(parent.hasAttribute('submenuopen')).to.equal(true);
    parent.submenuOpen = false;
    await waitUntil(() => !parent.submenuOpen);
    expect(parent.hasAttribute('submenuopen')).to.equal(false);
    expect(parent.hasAttribute('submenu-open')).to.equal(false);
  });

  for (const attribute of ['submenu-open', 'submenuopen']) {
    it(`retains a ${attribute} request until submenu content arrives and clears it on removal`, async () => {
      const menu = await fixture<HTMLElement>(html`<lr-menu label="Actions">
        <lr-dropdown-item>Share</lr-dropdown-item>
      </lr-menu>`);
      const item = menu.querySelector<LyraDropdownItem>('lr-dropdown-item')!;
      item.setAttribute(attribute, '');
      await item.updateComplete;
      expect(item.submenuOpen).to.equal(false);
      expect(item.hasAttribute(attribute)).to.equal(true);
      const child = document.createElement('lr-dropdown-item');
      child.slot = 'submenu';
      child.textContent = 'Email';
      item.append(child);
      await waitUntil(() => item.submenuOpen, 'pending authored request opens after child insertion');
      expect(item.hasAttribute('submenu-open')).to.equal(true);
      expect(item.hasAttribute('submenuopen')).to.equal(true);
      item.remove();
      menu.append(item);
      await item.updateComplete;
      expect(item.submenuOpen).to.equal(false);
      expect(item.hasAttribute('submenu-open')).to.equal(false);
      expect(item.hasAttribute('submenuopen')).to.equal(false);
    });
  }

  it('returns focus to the parent when the final navigable submenu child becomes disabled', async () => {
    const menu = await fixture<HTMLElement>(html`<lr-menu label="Actions">
      <lr-dropdown-item>Share
        <lr-menu slot="submenu" label="Share destinations">
          <lr-dropdown-item>Email</lr-dropdown-item>
        </lr-menu>
      </lr-dropdown-item>
    </lr-menu>`);
    const parent = menu.querySelector<LyraDropdownItem>('lr-dropdown-item')!;
    const child = parent.querySelector<LyraDropdownItem>('lr-dropdown-item')!;
    await waitUntil(() => parent.hasSubmenu);
    await parent.openSubmenu('none');
    await focusByKeyboard(child);
    expect(document.activeElement === child).to.equal(true);
    child.disabled = true;
    await waitUntil(() => !parent.submenuOpen, 'submenu with no remaining enabled child dismisses');
    expect(document.activeElement === parent).to.equal(true);
    expect(parent.hasAttribute('submenuopen')).to.equal(false);
  });

  it('dismisses the previous submenu after the pointer rests on an ordinary sibling', async () => {
    const menu = await fixture<HTMLElement>(html`<lr-menu label="Actions">
      <lr-dropdown-item id="share">Share
        <lr-dropdown-item slot="submenu">Email</lr-dropdown-item>
      </lr-dropdown-item>
      <lr-dropdown-item id="archive">Archive</lr-dropdown-item>
    </lr-menu>`);
    const parent = menu.querySelector<LyraDropdownItem>('#share')!;
    const sibling = menu.querySelector<LyraDropdownItem>('#archive')!;
    await waitUntil(() => parent.hasSubmenu);
    await parent.openSubmenu('none');
    const bounds = sibling.getBoundingClientRect();
    try {
      await sendMouse({ type: 'move', position: [Math.round(bounds.left + bounds.width / 2), Math.round(bounds.top + bounds.height / 2)] });
      await waitUntil(() => sibling.matches(':hover'));
      // wait-reason: negative assertion; the submenu must not open within the hover-intent delay
      await aTimeout(400);
      expect(parent.submenuOpen).to.equal(false);
      expect(parent.hasAttribute('submenuopen')).to.equal(false);
    } finally {
      await resetMouse();
    }
  });
});
