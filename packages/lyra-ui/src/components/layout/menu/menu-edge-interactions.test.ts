import { aTimeout, expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';
import './menu.js';
import './menu-item.js';

function press(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

async function openShare(submenu: ReturnType<typeof html>) {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share">Share ${submenu}</lr-menu-item>
      <lr-menu-item id="other" value="other">Other</lr-menu-item>
    </lr-menu>
    <button id="after-menu" type="button">After menu</button>
  </div>`);
  const share = wrapper.querySelector<LyraMenuItem>('#share')!;
  const child = wrapper.querySelector<LyraMenu>('#share-menu')!;
  await share.openSubmenu('none');
  expect(share.submenuOpen).to.equal(true);
  return { wrapper, share, child };
}

describe('lr-menu submenu Tab boundaries without a list stop', () => {
  it('closes when Shift+Tab leaves a footer-only submenu', async () => {
    const { share, child } = await openShare(html`<lr-menu slot="submenu" id="share-menu">
      <button slot="footer" id="apply" type="button">Apply</button>
    </lr-menu>`);
    await focusByKeyboard(child.querySelector<HTMLElement>('#apply')!);
    await sendKeys({ press: 'Shift+Tab' });
    await waitUntil(() => !share.submenuOpen, 'Shift+Tab out of the only region kept the submenu open');
  });

  it('closes when Tab leaves a header-only submenu', async () => {
    const { share, child } = await openShare(html`<lr-menu slot="submenu" id="share-menu">
      <input slot="header" id="filter" aria-label="Filter actions" />
    </lr-menu>`);
    await focusByKeyboard(child.querySelector<HTMLElement>('#filter')!);
    await sendKeys({ press: 'Tab' });
    await waitUntil(() => !share.submenuOpen, 'Tab out of the only region kept the submenu open');
  });

  it('keeps the submenu open for a press inside it', async () => {
    const { share, child } = await openShare(html`<lr-menu slot="submenu" id="share-menu">
      <input slot="header" id="filter" aria-label="Filter actions" />
      <lr-menu-item id="copy" value="copy">Copy link</lr-menu-item>
    </lr-menu>`);
    child.querySelector('#filter')!.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true, button: 0, isPrimary: true }),
    );
    await child.updateComplete;
    await nextFrame();
    expect(share.submenuOpen, 'a press inside the submenu dismissed it').to.equal(true);
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, composed: true, button: 0, isPrimary: true }),
    );
    await waitUntil(() => !share.submenuOpen, 'an outside press did not dismiss the submenu');
  });
});

describe('lr-menu radio rows beside other row types', () => {
  it('unchecks only same-group radio siblings, never a checkbox row', async () => {
    const menu = await fixture<LyraMenu>(html`
      <lr-menu label="View">
        <lr-menu-item id="wrap" type="checkbox" checked value="wrap">Word wrap</lr-menu-item>
        <lr-menu-item id="usd" type="radio" checked value="usd">USD</lr-menu-item>
        <lr-menu-item id="eur" type="radio" value="eur">EUR</lr-menu-item>
      </lr-menu>
    `);
    const wrap = menu.querySelector<LyraMenuItem>('#wrap')!;
    const usd = menu.querySelector<LyraMenuItem>('#usd')!;
    const eur = menu.querySelector<LyraMenuItem>('#eur')!;
    eur.select();
    await menu.updateComplete;
    expect(eur.checked).to.equal(true);
    expect(usd.checked).to.equal(false);
    expect(wrap.checked, 'a checkbox row was treated as a radio sibling').to.equal(true);
  });
});

describe('lr-menu with no navigable rows', () => {
  it('ignores type-ahead when every row is disabled', async () => {
    const menu = await fixture<LyraMenu>(html`
      <lr-menu label="Actions">
        <lr-menu-item id="alpha" value="alpha" disabled>Alpha</lr-menu-item>
        <lr-menu-item id="beta" value="beta" disabled>Beta</lr-menu-item>
      </lr-menu>
    `);
    const list = menu.shadowRoot!.querySelector<HTMLElement>('[part~="list"]')!;
    press(menu.querySelector('#alpha')!, 'b');
    await menu.updateComplete;
    const items = [...menu.querySelectorAll<LyraMenuItem>('lr-menu-item')];
    expect(items.map((item) => item.tabIndex)).to.deep.equal([-1, -1]);
    expect(list.contains(document.activeElement)).to.equal(false);
  });

  it('leaves no roving stop when the active row is removed and only disabled rows remain', async () => {
    const menu = await fixture<LyraMenu>(html`
      <lr-menu label="Actions">
        <lr-menu-item id="alpha" value="alpha">Alpha</lr-menu-item>
        <lr-menu-item id="beta" value="beta" disabled>Beta</lr-menu-item>
      </lr-menu>
    `);
    const alpha = menu.querySelector<LyraMenuItem>('#alpha')!;
    const beta = menu.querySelector<LyraMenuItem>('#beta')!;
    await focusByKeyboard(alpha);
    expect(alpha.tabIndex).to.equal(0);
    alpha.remove();
    await waitUntil(() => menu.querySelectorAll('lr-menu-item').length === 1);
    await menu.updateComplete;
    await nextFrame();
    expect(beta.tabIndex, 'a disabled row became the roving stop').to.equal(-1);
  });
});

describe('lr-menu-item no-op writes', () => {
  it('does nothing when submenuOpen is set to its current value', async () => {
    const menu = await fixture<LyraMenu>(html`
      <lr-menu label="Actions">
        <lr-menu-item id="share" value="share">Share
          <lr-menu slot="submenu" id="share-menu">
            <lr-menu-item value="copy">Copy</lr-menu-item>
          </lr-menu>
        </lr-menu-item>
      </lr-menu>
    `);
    const share = menu.querySelector<LyraMenuItem>('#share')!;
    let toggles = 0;
    share.addEventListener('lr-toggle', () => toggles++);
    share.submenuOpen = false;
    await share.updateComplete;
    expect(share.submenuOpen).to.equal(false);
    expect(share.getAttribute('aria-expanded')).to.equal('false');
    share.submenuOpen = true;
    await waitUntil(() => share.submenuOpen, 'a real write did not open the submenu');
    share.submenuOpen = true;
    await share.updateComplete;
    expect(share.submenuOpen).to.equal(true);
    expect(toggles).to.be.at.most(1);
  });

  it('does not announce a native-state write that changes nothing', async () => {
    const menu = await fixture<LyraMenu>(html`
      <lr-menu label="Actions">
        <lr-menu-item id="alpha" value="alpha">Alpha</lr-menu-item>
      </lr-menu>
    `);
    const alpha = menu.querySelector<LyraMenuItem>('#alpha')!;
    const announcements: boolean[] = [];
    alpha.addEventListener('lr-menu-item-state-change', () => announcements.push(alpha.hidden === true));
    alpha.hidden = true;
    await waitUntil(() => announcements.length === 1, 'a real hidden write was not announced');
    // Rewrites the attribute (a fresh mutation record) without changing the hidden state.
    alpha.setAttribute('hidden', 'hidden');
    await nextFrame();
    await nextFrame();
    expect(announcements, 'a no-op write woke the owning menu').to.deep.equal([true]);
  });
});

describe('lr-menu submenu pointer intent timers', () => {
  async function rootMenu(): Promise<{ menu: LyraMenu; share: LyraMenuItem; list: HTMLElement }> {
    const menu = await fixture<LyraMenu>(html`
      <lr-menu label="Actions">
        <lr-menu-item id="share" value="share">Share
          <lr-menu slot="submenu"><lr-menu-item value="copy">Copy link</lr-menu-item></lr-menu>
        </lr-menu-item>
        <lr-menu-item id="other" value="other">Other</lr-menu-item>
      </lr-menu>
    `);
    const share = menu.querySelector<LyraMenuItem>('#share')!;
    const list = menu.shadowRoot!.querySelector<HTMLElement>('[part~="list"]')!;
    return { menu, share, list };
  }

  it('never opens a submenu for a row removed before its hover delay elapsed', async () => {
    const { menu, share } = await rootMenu();
    share.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true, pointerType: 'mouse' }));
    share.remove();
    // wait-reason: negative assertion, the pending hover-open timer must not open a removed row
    await aTimeout(250);
    expect(share.submenuOpen).to.equal(false);
    expect(menu.querySelector('#other')!.getAttribute('tabindex')).to.equal('0');
  });

  it('schedules one close for repeated pointer exits and tolerates a submenu already closed', async () => {
    const { share, list } = await rootMenu();
    await share.openSubmenu('none');
    expect(share.submenuOpen).to.equal(true);
    list.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    // wait-reason: real timing semantics, the second exit lands partway through the close delay
    await aTimeout(150);
    list.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    // wait-reason: real timing semantics, the first exit's 300ms close deadline has now passed
    await aTimeout(200);
    expect(share.submenuOpen, 'the repeated exit restarted the close delay').to.equal(false);

    await share.openSubmenu('none');
    list.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    await share.closeSubmenu();
    // wait-reason: real timing semantics, let the pending close fire against the closed submenu
    await aTimeout(400);
    expect(share.submenuOpen).to.equal(false);
  });
});
