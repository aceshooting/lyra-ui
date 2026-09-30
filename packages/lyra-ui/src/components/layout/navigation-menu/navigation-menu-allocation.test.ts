import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraNavigationMenu } from './navigation-menu.class.js';
import './navigation-menu.js';

for (const direction of ['ltr', 'rtl']) {
  it(`measures content allocation when ResizeObserver is unavailable in ${direction}`, async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver')!;
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: undefined });
    try {
      const menu = await fixture<LyraNavigationMenu>(html`<lr-navigation-menu dir=${direction}
        style="box-sizing:border-box;width:344px;padding-inline:20px;border:2px solid transparent">
        <lr-navigation-menu-item href="#docs">Documentation</lr-navigation-menu-item>
      </lr-navigation-menu>`);
      await menu.updateComplete;
      // The 344px border box contains exactly 300px of usable menu allocation.
      menu.mobileBreakpoint = '320px';
      await menu.updateComplete;
      await waitUntil(() => menu.shadowRoot!.querySelectorAll('[part="toggle"]').length === 1);
      const toggle = menu.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!;
      expect(toggle.getBoundingClientRect().width).to.be.greaterThan(0);
      menu.mobileBreakpoint = '290px';
      await menu.updateComplete;
      await waitUntil(() => menu.shadowRoot!.querySelectorAll('[part="toggle"]').length === 0);
      expect(menu.querySelector('lr-navigation-menu-item')?.getAttribute('role')).to.equal('listitem');
      menu.remove();
      menu.mobileBreakpoint = '310px';
      await menu.updateComplete;
      expect(menu.isConnected).to.equal(false);
    } finally {
      Object.defineProperty(window, 'ResizeObserver', descriptor);
    }
  });
}
