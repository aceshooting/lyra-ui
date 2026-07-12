import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './export-button.js';
import type { LyraExportButton } from './export-button.js';

const rows = [{ id: 'a', name: 'Alpha' }];
const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
];

it('emits lyra-export then lyra-export-complete for a single format', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  await el.updateComplete;
  const btn = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
  const exportEvent = oneEvent(el, 'lyra-export');
  const completeEvent = oneEvent(el, 'lyra-export-complete');
  btn.click();
  const ev = await exportEvent;
  expect(ev.detail.format).to.equal('csv');
  await completeEvent;
});

it('suppresses the built-in download when lyra-export is cancelled', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.rows = rows;
  el.columns = columns;
  el.addEventListener('lyra-export', (e) => e.preventDefault());
  await el.updateComplete;
  let completed = false;
  el.addEventListener('lyra-export-complete', () => (completed = true));
  const btn = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
  btn.click();
  await new Promise((r) => setTimeout(r, 10));
  expect(completed).to.be.false;
});

it('offers a format menu when multiple formats are configured', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="menu-item"]').length).to.equal(2);
});

it('reflects open as a host attribute so the menu becomes visible', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.hasAttribute('open')).to.be.true;
  const menu = el.shadowRoot!.querySelector('[part="menu"]') as HTMLElement;
  expect(getComputedStyle(menu).visibility).to.equal('visible');
});

it('closes the menu on an outside pointerdown', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('closes on an outside pointerdown even when opened via the `open` property directly', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;

  // Bypasses openMenu()/the trigger click entirely -- `open` is a public,
  // reflect: true property, so setting it directly is valid API surface.
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('closes on Escape and returns focus to the trigger', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.shadowRoot!.activeElement).to.equal(trigger);
});

it('exposes aria-haspopup/aria-expanded only when a menu exists', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(trigger.getAttribute('aria-haspopup')).to.equal('menu');
  expect(trigger.getAttribute('aria-expanded')).to.equal('false');
  trigger.click();
  await el.updateComplete;
  expect(trigger.getAttribute('aria-expanded')).to.equal('true');

  el.formats = ['csv'];
  await el.updateComplete;
  const singleTrigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(singleTrigger.hasAttribute('aria-haspopup')).to.be.false;
  expect(singleTrigger.hasAttribute('aria-expanded')).to.be.false;
});

it('animates the menu open/closed with an opacity+transform transition', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const menu = el.shadowRoot!.querySelector('[part="menu"]') as HTMLElement;

  const closedStyle = getComputedStyle(menu);
  expect(closedStyle.opacity).to.equal('0');
  expect(closedStyle.transitionDuration).to.not.equal('0s');

  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  // visibility keeps the element in the render tree while opacity/transform
  // are closed, so opening it now genuinely runs a transition instead of
  // snapping instantly -- wait for it to finish before reading the end value.
  const transitionEnd = oneEvent(menu, 'transitionend');
  trigger.click();
  await el.updateComplete;
  await transitionEnd;
  expect(getComputedStyle(menu).opacity).to.equal('1');
});

it('shows a focus ring on the trigger via :focus-visible', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.focus();
  await el.updateComplete;
  const style = getComputedStyle(trigger);
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('shows a focus ring on menu items via :focus-visible', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  el.formats = ['csv', 'json'];
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  trigger.click();
  await el.updateComplete;
  const menuItem = el.shadowRoot!.querySelector('[part="menu-item"]') as HTMLButtonElement;
  menuItem.focus();
  await el.updateComplete;
  const style = getComputedStyle(menuItem);
  expect(style.outlineWidth).to.equal('2px');
  expect(style.outlineOffset).to.equal('2px');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  await expect(el).to.be.accessible();
});
