import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';
import './menu.js';
import './menu-item.js';

async function openSubmenu() {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share">Share
        <lr-menu slot="submenu" id="share-menu">
          <input slot="header" id="filter" aria-label="Filter actions" />
          <lr-menu-item id="copy" value="copy">Copy link</lr-menu-item>
          <button slot="footer" id="apply" type="button">Apply</button>
        </lr-menu>
      </lr-menu-item>
    </lr-menu>
    <button id="after-menu" type="button">After menu</button>
  </div>`);
  const share = wrapper.querySelector<LyraMenuItem>('#share')!;
  const child = wrapper.querySelector<LyraMenu>('#share-menu')!;
  await share.openSubmenu('first');
  expect(share.submenuOpen).to.equal(true);
  return { share, child };
}

describe('lr-menu submenu popup Tab stops with header, list and footer', () => {
  it('keeps the submenu open when Shift+Tab leaves the footer for the list', async () => {
    const { share, child } = await openSubmenu();
    await focusByKeyboard(child.querySelector<HTMLElement>('#apply')!);
    await sendKeys({ press: 'Shift+Tab' });
    await waitUntil(() => document.activeElement?.id === 'copy', 'focus returns to the list item');
    expect(share.submenuOpen).to.equal(true);
  });

  it('keeps the submenu open when Tab leaves the header for the list', async () => {
    const { share, child } = await openSubmenu();
    await focusByKeyboard(child.querySelector<HTMLElement>('#filter')!);
    await sendKeys({ press: 'Tab' });
    await waitUntil(() => document.activeElement?.id === 'copy', 'focus moves to the list item');
    expect(share.submenuOpen).to.equal(true);
  });
});
