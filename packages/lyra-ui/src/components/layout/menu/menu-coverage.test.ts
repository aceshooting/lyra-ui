import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraMenu } from './menu.js';
import type { LyraMenuItem } from './menu-item.js';
import './menu.js';
import './menu-item.js';

it('closes empty-list submenu popups when Tab leaves the footer or Shift+Tab leaves the header', async () => {
  for (const slot of ['header', 'footer'] as const) {
    const controlTemplate = slot === 'header'
      ? html`<input slot="header" id="edge" aria-label="Filter actions" />`
      : html`<button slot="footer" id="edge" type="button">Apply</button>`;
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-menu label="Actions">
        <lr-menu-item id="share" value="share">Share
          <lr-menu slot="submenu" id="share-menu">${controlTemplate}</lr-menu>
        </lr-menu-item>
      </lr-menu>
      <button id="after-menu" type="button">After menu</button>
    </div>`);
    const root = wrapper.querySelector<LyraMenu>('lr-menu')!;
    const share = root.querySelector<LyraMenuItem>('#share')!;
    const child = root.querySelector<LyraMenu>('#share-menu')!;
    await share.openSubmenu('first');
    expect(share.submenuOpen).to.equal(true);
    expect(child.shadowRoot!.querySelectorAll('[part="list"] [tabindex="0"]').length).to.equal(0);

    const control = child.querySelector<HTMLElement>('#edge')!;
    const expectedFocusId = slot === 'header' ? 'share' : 'after-menu';
    await focusByKeyboard(control);
    let tabDefaultPrevented: boolean | undefined;
    const observeTab = (event: KeyboardEvent): void => {
      if (event.key === 'Tab') tabDefaultPrevented = event.defaultPrevented;
    };
    document.addEventListener('keydown', observeTab);
    try {
      if (slot === 'header') await sendKeys({ press: 'Shift+Tab' });
      else await sendKeys({ press: 'Tab' });
      await waitUntil(() => !share.submenuOpen, `${slot} edge tab should close the submenu`);
      await waitUntil(() => tabDefaultPrevented !== undefined, 'the native Tab key reached the document');
      expect(tabDefaultPrevented, 'the menu leaves native Tab navigation unprevented').to.equal(false);
      await waitUntil(
        () => document.activeElement?.id === expectedFocusId,
        `${slot} edge tab reaches the adjacent focus stop`
      );
    } finally {
      document.removeEventListener('keydown', observeTab);
    }
  }
});
