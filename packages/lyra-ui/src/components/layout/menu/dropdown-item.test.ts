import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './dropdown-item.js';
import './menu.js';
import { LyraDropdownItem } from './dropdown-item.class.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

async function submenuParent(): Promise<LyraDropdownItem> {
  const wrapper = (await fixture(html`
    <div role="menu" aria-label="Share actions">
      <lr-dropdown-item id="share">
        Share
        <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
      </lr-dropdown-item>
    </div>
  `)) as HTMLElement;
  const item = wrapper.querySelector('#share') as LyraDropdownItem;
  for (let frame = 0; frame < 20 && !item.hasSubmenu; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await item.updateComplete;
  }
  expect(item.hasSubmenu).to.equal(true);
  return item;
}

async function waitForSubmenuState(item: LyraDropdownItem, open: boolean): Promise<void> {
  for (let frame = 0; frame < 20 && item.submenuOpen !== open; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await item.updateComplete;
  }
}

describe('<lr-dropdown-item>', () => {
  it('uses the menu-item behavior and role', async () => {
    const menu = await fixture(html`<lr-menu><button slot="trigger">Actions</button><lr-dropdown-item value="archive">Archive</lr-dropdown-item></lr-menu>`);
    const el = menu.querySelector('lr-dropdown-item') as LyraDropdownItem;
    expect(el.getAttribute('role')).to.equal('menuitem');
    expect(el.tabIndex).to.equal(-1);
  });

  it('reflects the pinned Web Awesome type property', async () => {
    const el = await fixture<LyraDropdownItem>(html`<lr-dropdown-item>Archive</lr-dropdown-item>`);
    el.type = 'checkbox';
    await el.updateComplete;
    expect(el.getAttribute('type')).to.equal('checkbox');
  });

  it('is accessible', async () => {
    const menu = await fixture(html`<lr-menu label="Actions"><button slot="trigger">Actions</button><lr-dropdown-item value="archive">Archive</lr-dropdown-item></lr-menu>`);
    await expect(menu).to.be.accessible();
  });

  it('inherits decorative display-slot isolation without losing its host label or action', async () => {
    const wrapper = (await fixture(html`
      <div role="menu" aria-label="Actions">
        <lr-dropdown-item id="archive" value="archive" tabindex="0">
          <button id="label" type="button">Archive</button>
          <button id="details" slot="details" type="button">Shortcut action</button>
        </lr-dropdown-item>
      </div>
    `)) as HTMLElement;
    const item = wrapper.querySelector<LyraDropdownItem>('#archive')!;
    const label = wrapper.querySelector<HTMLButtonElement>('#label')!;
    const details = wrapper.querySelector<HTMLButtonElement>('#details')!;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await item.updateComplete;

    for (const control of [label, details]) {
      control.focus();
      expect(
        item.ownerDocument.activeElement?.id,
        `${control.id} cannot become a second focus stop inside the menuitem`,
      ).to.not.equal(control.id);
      expect(
        control.assignedSlot?.closest<HTMLElement>('[inert]')?.getAttribute('aria-hidden'),
        `${control.id} is visual-only item chrome`,
      ).to.equal('true');
    }

    expect(item.getTextLabel()).to.equal('Archive');
    expect(item.getAttribute('aria-label')).to.equal('Archive');

    let slottedClicks = 0;
    let selections = 0;
    label.addEventListener('click', () => slottedClicks += 1);
    item.addEventListener('lr-menu-item-select', () => selections += 1);
    const rect = label.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'click',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
    } finally {
      await resetMouse();
    }

    expect(slottedClicks).to.equal(0);
    expect(selections).to.equal(1);
    await expect(wrapper).to.be.accessible();
  });

  it('exposes submenu-open as a reflected, controllable state with a false default', async () => {
    const item = await submenuParent();
    expect(item.submenuOpen).to.equal(false);
    expect(item.hasAttribute('submenu-open')).to.equal(false);

    item.submenuOpen = true;
    await waitForSubmenuState(item, true);
    expect(item.submenuOpen).to.equal(true);
    expect(item.getAttribute('submenu-open')).to.equal('');

    item.submenuOpen = false;
    await waitForSubmenuState(item, false);
    expect(item.submenuOpen).to.equal(false);
    expect(item.hasAttribute('submenu-open')).to.equal(false);

    item.setAttribute('submenu-open', '');
    await waitForSubmenuState(item, true);
    expect(item.submenuOpen).to.equal(true);
    item.removeAttribute('submenu-open');
    await waitForSubmenuState(item, false);
    expect(item.submenuOpen).to.equal(false);
  });

  it('accepts the normalized upstream submenuopen attribute as a synchronized alias', async () => {
    const authored = (await fixture(html`
      <div role="menu" aria-label="Share actions">
        <lr-dropdown-item submenuOpen>
          Share
          <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
        </lr-dropdown-item>
      </div>
    `)).querySelector('lr-dropdown-item') as LyraDropdownItem;
    for (let frame = 0; frame < 20 && !authored.hasSubmenu; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await authored.updateComplete;
    }
    await waitForSubmenuState(authored, true);
    expect(authored.submenuOpen).to.equal(true);
    expect(authored.hasAttribute('submenuopen')).to.equal(true);
    expect(authored.hasAttribute('submenu-open')).to.equal(true);

    const item = await submenuParent();

    item.setAttribute('submenuopen', '');
    await waitForSubmenuState(item, true);
    expect(item.submenuOpen).to.equal(true);
    expect(item.hasAttribute('submenu-open')).to.equal(true);

    item.removeAttribute('submenuopen');
    await waitForSubmenuState(item, false);
    expect(item.submenuOpen).to.equal(false);
    expect(item.hasAttribute('submenu-open')).to.equal(false);

    item.setAttribute('submenuopen', '');
    await waitForSubmenuState(item, true);
    item.removeAttribute('submenu-open');
    await item.updateComplete;
    expect(item.submenuOpen).to.equal(true);
    expect(item.hasAttribute('submenu-open')).to.equal(true);

    item.removeAttribute('submenuopen');
    await waitForSubmenuState(item, false);
    expect(item.submenuOpen).to.equal(false);
    expect(item.hasAttribute('submenu-open')).to.equal(false);
  });

  it('declares the mapped submenu methods on this class and preserves their promise settlement', async () => {
    expect(Object.hasOwn(LyraDropdownItem.prototype, 'openSubmenu')).to.equal(true);
    expect(Object.hasOwn(LyraDropdownItem.prototype, 'closeSubmenu')).to.equal(true);
    const item = await submenuParent();

    const opening = item.openSubmenu();
    expect(opening).to.be.instanceOf(Promise);
    await opening;
    expect(item.submenuOpen).to.equal(true);
    expect(item.getAttribute('submenu-open')).to.equal('');

    const closing = item.closeSubmenu();
    expect(closing).to.be.instanceOf(Promise);
    await closing;
    expect(item.submenuOpen).to.equal(false);
    expect(item.hasAttribute('submenu-open')).to.equal(false);
  });

  it('uses the host native focus and blur events without translating or re-emitting them', async () => {
    const item = (await fixture(html`
      <div role="menu" aria-label="Actions">
        <lr-dropdown-item>Archive</lr-dropdown-item>
      </div>
    `)).querySelector('lr-dropdown-item') as LyraDropdownItem;
    let translatedEvents = 0;
    item.addEventListener('lr-focus', () => { translatedEvents += 1; });
    item.addEventListener('lr-blur', () => { translatedEvents += 1; });

    const focused = oneEvent(item, 'focus');
    item.focus();
    const focusEvent = await focused;
    expect(focusEvent).to.be.instanceOf(FocusEvent);
    expect(focusEvent.target).to.equal(item);
    expect(focusEvent.bubbles).to.equal(false);
    expect(focusEvent.cancelable).to.equal(false);

    const blurred = oneEvent(item, 'blur');
    item.blur();
    const blurEvent = await blurred;
    expect(blurEvent).to.be.instanceOf(FocusEvent);
    expect(blurEvent.target).to.equal(item);
    expect(blurEvent.bubbles).to.equal(false);
    expect(blurEvent.cancelable).to.equal(false);
    expect(translatedEvents).to.equal(0);
  });

  it('is accessible with its reflected submenu state open', async () => {
    const item = await submenuParent();
    await item.openSubmenu('none');
    await expect(item.parentElement!).to.be.accessible();
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
