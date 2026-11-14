import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';
import './menu.js';
import './menu-item.js';

async function openSubmenu(extra = html``) {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share">Share
        <lr-menu slot="submenu" id="share-menu">
          <input slot="header" id="filter" aria-label="Filter actions" />
          <lr-menu-item id="copy" value="copy">Copy link</lr-menu-item>
          <button slot="footer" id="apply" type="button">Apply</button>
          ${extra}
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
  for (const slot of ['header', 'footer', ''] as const) {
    it(`keeps adjacent ${slot || 'default-slot'} controls usable in both Tab directions, skipping disabled and inert controls`, async () => {
      const { share, child } = await openSubmenu(html`<div slot=${slot}>
        <button id="first-control" type="button">First control</button>
        <button disabled type="button">Disabled control</button>
        <span inert><button type="button">Inert control</button></span>
        <button id="last-control" type="button">Last control</button>
      </div>`);
      const first = child.querySelector<HTMLButtonElement>('#first-control')!;
      let activations = 0;
      first.addEventListener('click', () => { activations++; });
      await focusByKeyboard(first);
      await sendKeys({ press: 'Tab' });
      await waitUntil(() => document.activeElement?.id === 'last-control', 'Tab skips unavailable controls');
      expect(share.submenuOpen).to.equal(true);
      await sendKeys({ press: 'Shift+Tab' });
      await waitUntil(() => document.activeElement?.id === 'first-control', 'Shift+Tab returns to the adjacent control');
      expect(share.submenuOpen).to.equal(true);
      await sendKeys({ press: 'Enter' });
      expect(activations, 'the native action remains operable').to.equal(1);
      expect(share.submenuOpen).to.equal(true);
    });
  }

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
