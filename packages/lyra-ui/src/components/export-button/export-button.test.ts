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
  expect(getComputedStyle(menu).display).to.not.equal('none');
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

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-export-button></lyra-export-button>`)) as LyraExportButton;
  await expect(el).to.be.accessible();
});
