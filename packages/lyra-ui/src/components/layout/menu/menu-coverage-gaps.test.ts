import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';
import './menu.js';
import './menu-item.js';

// The application registers the menu's width-scale property BEFORE the first menu connects, so
// the library's own registration is the rejected second attempt. Runs at module load, ahead of
// every fixture in this file.
let appRegistered = false;
if (typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function') {
  try {
    CSS.registerProperty({
      name: '--_lr-menu-max-inline-size',
      syntax: '<length-percentage>',
      inherits: false,
      initialValue: '100%',
    });
    appRegistered = true;
  } catch {
    appRegistered = false;
  }
}

it('tolerates the application having registered the width-scale property first', async function () {
  if (!appRegistered) this.skip();
  const menu = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item value="a">Alpha</lr-menu-item>
    </lr-menu>
  `);
  expect(menu.shadowRoot!.querySelector('[part~="list"]') !== null).to.equal(true);
  expect(menu.querySelectorAll('lr-menu-item').length).to.equal(1);
});

it('closes a submenu whose anchor cannot be measured instead of leaving it half open', async () => {
  const root = await fixture<LyraMenu>(html`
    <lr-menu label="Actions">
      <lr-menu-item id="share" value="share">Share
        <lr-menu slot="submenu" id="child" label="Share">
          <lr-menu-item value="mail">Mail</lr-menu-item>
        </lr-menu>
      </lr-menu-item>
    </lr-menu>
  `);
  const share = root.querySelector<LyraMenuItem>('#share')!;
  const original = share.getBoundingClientRect;
  share.getBoundingClientRect = () => new DOMRect(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
  try {
    await share.openSubmenu('first');
    await waitUntil(() => !share.submenuOpen, 'placement failure closes the submenu');
  } finally {
    share.getBoundingClientRect = original;
  }
  expect(share.submenuOpen).to.equal(false);
  // The failure is not sticky: with real geometry the same submenu opens.
  await share.openSubmenu('first');
  expect(share.submenuOpen).to.equal(true);
});
