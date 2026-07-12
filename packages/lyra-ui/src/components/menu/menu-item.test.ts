import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './menu-item.js';
import type { LyraMenuItem } from './menu-item.js';

// role="menuitem" requires a role="menu"/"menubar"/"group" ancestor to
// satisfy axe's aria-required-parent rule -- <lyra-menu> normally supplies
// that; a plain wrapper stands in for it here since this file tests
// <lyra-menu-item> in isolation, mirroring lyra-conversation-item's
// identical fixtureInListbox helper for its own role="option".
async function fixtureInMenu(item: import('lit').TemplateResult): Promise<LyraMenuItem> {
  const wrapper = (await fixture(html`<div role="menu" aria-label="Actions">${item}</div>`)) as HTMLElement;
  return wrapper.querySelector('lyra-menu-item') as LyraMenuItem;
}

it('defaults to value="", disabled=false, destructive=false', async () => {
  const el = (await fixture(html`<lyra-menu-item>Rename</lyra-menu-item>`)) as LyraMenuItem;
  expect(el.value).to.equal('');
  expect(el.disabled).to.be.false;
  expect(el.destructive).to.be.false;
});

it('sets role="menuitem" on the host', async () => {
  const el = await fixtureInMenu(html`<lyra-menu-item>Rename</lyra-menu-item>`);
  expect(el.getAttribute('role')).to.equal('menuitem');
});

it('reflects disabled/destructive to attributes', async () => {
  const el = (await fixture(html`<lyra-menu-item disabled destructive>Delete</lyra-menu-item>`)) as LyraMenuItem;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(el.hasAttribute('destructive')).to.be.true;
  expect(el.getAttribute('aria-disabled')).to.equal('true');
});

it('has no aria-disabled attribute when enabled', async () => {
  const el = (await fixture(html`<lyra-menu-item>Rename</lyra-menu-item>`)) as LyraMenuItem;
  expect(el.hasAttribute('aria-disabled')).to.be.false;
});

it('fires lyra-menu-item-select on click', async () => {
  const el = (await fixture(html`<lyra-menu-item value="rename">Rename</lyra-menu-item>`)) as LyraMenuItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  setTimeout(() => base.click());
  const ev = await oneEvent(el, 'lyra-menu-item-select');
  // emit() forwards `detail` verbatim to the CustomEvent constructor; an
  // omitted detail resolves to `null` there, not `undefined`.
  expect(ev.detail).to.be.null;
});

it('select() fires lyra-menu-item-select directly, for a parent menu\'s own keyboard handling', async () => {
  const el = (await fixture(html`<lyra-menu-item value="rename">Rename</lyra-menu-item>`)) as LyraMenuItem;
  setTimeout(() => el.select());
  await oneEvent(el, 'lyra-menu-item-select');
});

it('does not fire lyra-menu-item-select on click or select() while disabled', async () => {
  const el = (await fixture(html`<lyra-menu-item disabled>Delete</lyra-menu-item>`)) as LyraMenuItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lyra-menu-item-select', () => (fired = true));
  base.click();
  el.select();
  expect(fired).to.be.false;
});

it('starts with tabIndex -1 before any parent menu manages roving focus', async () => {
  const el = (await fixture(html`<lyra-menu-item>Rename</lyra-menu-item>`)) as LyraMenuItem;
  expect(el.tabIndex).to.equal(-1);
});

it('hides the icon part when the icon slot is empty, shows it once populated', async () => {
  const el = (await fixture(html`<lyra-menu-item>Rename</lyra-menu-item>`)) as LyraMenuItem;
  const iconPart = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(iconPart.hidden).to.be.true;

  const el2 = (await fixture(html`
    <lyra-menu-item><span slot="icon">✏️</span>Rename</lyra-menu-item>
  `)) as LyraMenuItem;
  const iconPart2 = el2.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
  expect(iconPart2.hidden).to.be.false;
});

it('is accessible in the default state', async () => {
  const el = await fixtureInMenu(html`<lyra-menu-item value="rename">Rename</lyra-menu-item>`);
  await expect(el).to.be.accessible();
});

it('is accessible with an icon, disabled and destructive states', async () => {
  const wrapper = (await fixture(html`
    <div role="menu" aria-label="Actions">
      <lyra-menu-item value="rename"><span slot="icon">✏️</span>Rename</lyra-menu-item>
      <lyra-menu-item value="archive" disabled>Archive</lyra-menu-item>
      <lyra-menu-item value="delete" destructive>Delete</lyra-menu-item>
    </div>
  `)) as HTMLElement;
  await expect(wrapper).to.be.accessible();
});
