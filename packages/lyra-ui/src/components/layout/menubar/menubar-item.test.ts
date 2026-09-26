import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraMenubarItem } from './menubar-item.class.js';
import './menubar.js';

describe('lr-menubar-item', () => {
  it('is accessible as an open menu title and a plain action in the owning menubar', async () => {
    const wrapper = await fixture(html`<lr-menubar label="App"><lr-menubar-item id="file">File<lr-menu slot="menu"><lr-menu-item>New</lr-menu-item></lr-menu></lr-menubar-item><lr-menubar-item id="help">Help</lr-menubar-item></lr-menubar>`);
    const file = wrapper.querySelector<LyraMenubarItem>('#file')!;
    const help = wrapper.querySelector<LyraMenubarItem>('#help')!;
    await waitUntil(() => file.hasMenu); file.click();
    await waitUntil(() => file.getAttribute('aria-expanded') === 'true');
    const surface = file.querySelector('lr-menu')!.shadowRoot!.querySelector<HTMLElement>('.submenu-surface')!;
    await waitUntil(() => getComputedStyle(surface).visibility === 'visible');
    expect(file.getAttribute('aria-expanded')).to.equal('true');
    await expect(file).to.be.accessible();
    await expect(help).to.be.accessible();
  });

  it('renders literal disabled states, starts menus inert, and suppresses disabled click()', async () => {
    const wrapper = await fixture(html`<lr-menubar label="App"><lr-menubar-item id="file">File<lr-menu slot="menu"><lr-menu-item>New</lr-menu-item></lr-menu></lr-menubar-item><lr-menubar-item id="help" disabled>Help</lr-menubar-item></lr-menubar>`);
    const file = wrapper.querySelector<LyraMenubarItem>('#file')!;
    const help = wrapper.querySelector<LyraMenubarItem>('#help')!;
    expect(file.shadowRoot!.querySelector<HTMLElement>('.menu')!.inert).to.equal(true);
    expect(help.getAttribute('aria-disabled')).to.equal('true');
    expect(help.hasAttribute('aria-haspopup')).to.equal(false);
    expect(help.hasAttribute('aria-expanded')).to.equal(false);
    let clicks = 0; help.addEventListener('click', () => { clicks++; });
    help.click(); expect(clicks).to.equal(0);
    help.disabled = false; await help.updateComplete;
    expect(help.getAttribute('aria-disabled')).to.equal('false');
    help.click(); expect(clicks).to.equal(1);
  });

  it('uses only the first assigned menu and keeps unsupported assigned content hidden', async () => {
    const wrapper = await fixture(html`<lr-menubar label="App"><lr-menubar-item id="file">File<span slot="menu">Ignored</span><lr-menu id="first" slot="menu"><lr-menu-item>New</lr-menu-item></lr-menu><lr-menu id="second" slot="menu"><lr-menu-item>Other</lr-menu-item></lr-menu></lr-menubar-item></lr-menubar>`);
    const file = wrapper.querySelector<LyraMenubarItem>('#file')!;
    await waitUntil(() => file.hasMenu); file.click();
    await waitUntil(() => file.getAttribute('aria-expanded') === 'true');
    expect(file.menuElement?.id).to.equal('first');
    expect(wrapper.querySelector<HTMLElement>('#second')!.hidden).to.equal(true);
    expect(wrapper.querySelector<HTMLElement>('span')!.hidden).to.equal(true);
  });

  it('paints press and pointer focus from native state only, with no inline or data-attribute paint', async () => {
    const wrapper = await fixture(html`<lr-menubar label="App" style="--lr-transition-fast:0ms;--lr-menubar-item-active-bg:rgb(65, 43, 21)"><lr-menubar-item id="help">Help</lr-menubar-item></lr-menubar>`);
    const help = wrapper.querySelector<LyraMenubarItem>('#help')!;
    const base = help.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    await hoverUntilMatched(help, 'Help should be hovered');
    try {
      await sendMouse({ type: 'down' });
      await waitUntil(() => getComputedStyle(base).backgroundColor === 'rgb(65, 43, 21)', 'pressed paint did not apply');
      const rect = wrapper.getBoundingClientRect();
      await sendMouse({ type: 'move', position: [Math.round(rect.left + 2), Math.round(rect.bottom + 40)] });
    } finally { await sendMouse({ type: 'up' }); }
    await waitUntil(() => getComputedStyle(base).backgroundColor !== 'rgb(65, 43, 21)', 'pressed paint did not clear');
    expect(help.matches(':focus-visible')).to.equal(false);
    expect(base.getAttribute('style')).to.equal(null);
    expect(help.hasAttribute('data-pressed') || help.hasAttribute('data-focus-visible')).to.equal(false);
    await resetMouse();
  });
});
