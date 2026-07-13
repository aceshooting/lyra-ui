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

it('defaults to value="", disabled=false, destructive=false, type="normal", checked=false', async () => {
  const el = (await fixture(html`<lyra-menu-item>Rename</lyra-menu-item>`)) as LyraMenuItem;
  expect(el.value).to.equal('');
  expect(el.disabled).to.be.false;
  expect(el.destructive).to.be.false;
  expect(el.type).to.equal('normal');
  expect(el.checked).to.be.false;
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

it('forces tabIndex to -1 and blurs itself the moment disabled flips true while it holds real focus', async () => {
  const el = await fixtureInMenu(html`<lyra-menu-item tabindex="0">Rename</lyra-menu-item>`);
  el.focus();
  expect(document.activeElement).to.equal(el);

  el.disabled = true;
  await el.updateComplete;
  expect(el.tabIndex).to.equal(-1);
  expect(document.activeElement).to.not.equal(el);
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

it('type="checkbox" renders role="menuitemcheckbox" with aria-checked reflecting checked', async () => {
  const el = await fixtureInMenu(html`<lyra-menu-item type="checkbox">Wrap text</lyra-menu-item>`);
  expect(el.getAttribute('role')).to.equal('menuitemcheckbox');
  expect(el.getAttribute('aria-checked')).to.equal('false');

  el.checked = true;
  await el.updateComplete;
  expect(el.getAttribute('aria-checked')).to.equal('true');
});

it('clicking a type="checkbox" item toggles checked and fires lyra-menu-item-change with { value, checked }, in addition to lyra-menu-item-select', async () => {
  const el = (await fixture(
    html`<lyra-menu-item type="checkbox" value="wrap">Wrap text</lyra-menu-item>`,
  )) as LyraMenuItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  let selectFired = false;
  el.addEventListener('lyra-menu-item-select', () => (selectFired = true));

  setTimeout(() => base.click());
  const ev = await oneEvent(el, 'lyra-menu-item-change');
  expect(ev.detail).to.deep.equal({ value: 'wrap', checked: true });
  expect(el.checked).to.be.true;
  expect(el.getAttribute('aria-checked')).to.equal('true');
  expect(selectFired).to.be.true;

  setTimeout(() => base.click());
  const ev2 = await oneEvent(el, 'lyra-menu-item-change');
  expect(ev2.detail).to.deep.equal({ value: 'wrap', checked: false });
  expect(el.checked).to.be.false;
});

it('select() toggles checked and fires lyra-menu-item-change for type="checkbox" (Enter/Space, via a parent menu\'s own keydown handling)', async () => {
  const el = (await fixture(
    html`<lyra-menu-item type="checkbox" value="wrap">Wrap text</lyra-menu-item>`,
  )) as LyraMenuItem;

  setTimeout(() => el.select());
  const ev = await oneEvent(el, 'lyra-menu-item-change');
  expect(ev.detail).to.deep.equal({ value: 'wrap', checked: true });

  setTimeout(() => el.select());
  const ev2 = await oneEvent(el, 'lyra-menu-item-change');
  expect(ev2.detail).to.deep.equal({ value: 'wrap', checked: false });
});

it('does not toggle checked or fire lyra-menu-item-change on click or select() while disabled', async () => {
  const el = (await fixture(
    html`<lyra-menu-item type="checkbox" disabled value="wrap">Wrap text</lyra-menu-item>`,
  )) as LyraMenuItem;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lyra-menu-item-change', () => (fired = true));
  base.click();
  el.select();
  expect(fired).to.be.false;
  expect(el.checked).to.be.false;
});

it('renders a checkmark glyph only when type="checkbox" and checked', async () => {
  const unchecked = (await fixture(
    html`<lyra-menu-item type="checkbox" value="wrap">Wrap text</lyra-menu-item>`,
  )) as LyraMenuItem;
  expect(unchecked.shadowRoot!.querySelector('[part="checkmark"]')).to.not.exist;

  const checked = (await fixture(
    html`<lyra-menu-item type="checkbox" checked value="wrap">Wrap text</lyra-menu-item>`,
  )) as LyraMenuItem;
  expect(checked.shadowRoot!.querySelector('[part="checkmark"]')).to.exist;
});

it('type="normal" (default, omitted) is completely unaffected -- same role, no aria-checked, no checkmark, no lyra-menu-item-change event', async () => {
  const el = await fixtureInMenu(html`<lyra-menu-item value="rename">Rename</lyra-menu-item>`);
  expect(el.getAttribute('role')).to.equal('menuitem');
  expect(el.hasAttribute('aria-checked')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="checkmark"]')).to.not.exist;

  let changeFired = false;
  let selectFired = false;
  el.addEventListener('lyra-menu-item-change', () => (changeFired = true));
  el.addEventListener('lyra-menu-item-select', () => (selectFired = true));
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.click();
  expect(changeFired).to.be.false;
  expect(selectFired).to.be.true;
  expect(el.checked).to.be.false;
});

it('is accessible with type="checkbox", both unchecked and checked', async () => {
  const wrapper = (await fixture(html`
    <div role="menu" aria-label="View">
      <lyra-menu-item type="checkbox" value="wrap">Wrap text</lyra-menu-item>
      <lyra-menu-item type="checkbox" checked value="minimap">Minimap</lyra-menu-item>
    </div>
  `)) as HTMLElement;
  await expect(wrapper).to.be.accessible();
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
