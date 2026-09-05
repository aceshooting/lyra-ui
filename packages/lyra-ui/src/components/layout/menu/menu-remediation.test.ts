import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './menu.js';
import './menu-item.js';
import './menu-label.js';
import type { LyraMenuItem } from './menu-item.class.js';

for (const change of ['disable', 'remove'] as const) {
  for (const focus of ['outside', 'header', 'footer', 'item'] as const) {
    it(`repairs ${change} roving state while preserving ${focus} focus`, async () => {
      const root = await fixture<HTMLElement>(html`<div>
        <button id="outside">Outside</button>
        <lr-menu>
          <button id="header" slot="header">Header</button>
          <lr-menu-label>Caption</lr-menu-label>
          <lr-menu-item id="first">First</lr-menu-item>
          <lr-menu-item id="middle">Middle</lr-menu-item>
          <lr-menu-item id="last">Last</lr-menu-item>
          <button id="footer" slot="footer">Footer</button>
        </lr-menu>
      </div>`);
      const item = root.querySelector<LyraMenuItem>('#middle')!;
      item.focus();
      await waitUntil(() => item.tabIndex === 0);
      if (focus !== 'item') root.querySelector<HTMLElement>(`#${focus}`)!.focus();
      if (change === 'disable') item.disabled = true;
      else item.remove();
      await waitUntil(() => [...root.querySelectorAll<LyraMenuItem>('lr-menu-item')].some(candidate => candidate.id !== 'middle' && candidate.tabIndex === 0));
      const stop = root.querySelector<LyraMenuItem>('lr-menu-item[tabindex="0"]')!;
      expect(stop.interactionDisabled).to.equal(false);
      if (focus === 'item') expect(document.activeElement?.id).to.equal(stop.id);
      else expect(document.activeElement?.id).to.equal(focus);
      expect(root.querySelectorAll('lr-menu-item[tabindex="0"]').length).to.equal(1);
    });
  }
}
