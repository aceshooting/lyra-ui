import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './command-palette.js';
import type { LyraCommandPalette } from './command-palette.js';

it('opens, filters, and selects a command', async () => {
  const el = (await fixture(html`<lyra-command-palette .commands=${[{ id: 'save', label: 'Save', group: 'File' }, { id: 'close', label: 'Close' }]}></lyra-command-palette>`)) as LyraCommandPalette;
  el.openPalette(); await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'save'; input.dispatchEvent(new Event('input', { bubbles: true })); await el.updateComplete;
  const selected = oneEvent(el, 'lyra-select');
  el.shadowRoot!.querySelector('[part="command"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect((await selected).detail.command.id).to.equal('save');
  expect(el.open).to.be.false;
});

it('is accessible while open', async () => {
  const el = (await fixture(html`<lyra-command-palette .commands=${[{ id: 'save', label: 'Save' }]}></lyra-command-palette>`)) as LyraCommandPalette;
  el.openPalette(); await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('wires aria-activedescendant to a stable id on the active command row', async () => {
  const el = (await fixture(html`<lyra-command-palette .commands=${[{ id: 'save', label: 'Save' }, { id: 'close', label: 'Close' }]}></lyra-command-palette>`)) as LyraCommandPalette;
  el.openPalette(); await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input')!;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(rows[0].id).to.not.equal('');
  expect(input.getAttribute('aria-activedescendant')).to.equal(rows[0].id);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(input.getAttribute('aria-activedescendant')).to.equal(rows[1].id);
});

it('skips disabled commands during arrow navigation and marks them aria-disabled', async () => {
  const el = (await fixture(html`<lyra-command-palette .commands=${[
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Bravo', disabled: true },
    { id: 'c', label: 'Charlie' },
  ]}></lyra-command-palette>`)) as LyraCommandPalette;
  el.openPalette(); await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input')!;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(rows[0].getAttribute('aria-disabled')).to.equal('false');
  expect(rows[1].getAttribute('aria-disabled')).to.equal('true');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(input.getAttribute('aria-activedescendant')).to.equal(rows[2].id);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(input.getAttribute('aria-activedescendant')).to.equal(rows[0].id);
});

it('never rests the active option on a disabled command when one leads the list', async () => {
  const el = (await fixture(html`<lyra-command-palette .commands=${[
    { id: 'a', label: 'Alpha', disabled: true },
    { id: 'b', label: 'Bravo' },
  ]}></lyra-command-palette>`)) as LyraCommandPalette;
  el.openPalette(); await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input')!;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(input.getAttribute('aria-activedescendant')).to.equal(rows[1].id);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(input.getAttribute('aria-activedescendant')).to.equal(rows[1].id);
});

it('scrolls the newly active row into view when navigating with arrow keys', async () => {
  const commands = Array.from({ length: 5 }, (_unused, i) => ({ id: `c${i}`, label: `Command ${i}` }));
  const el = (await fixture(html`<lyra-command-palette .commands=${commands}></lyra-command-palette>`)) as LyraCommandPalette;
  el.openPalette(); await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input')!;
  const secondRow = el.shadowRoot!.querySelectorAll('[part="command"]')[1] as HTMLElement;
  let called = false;
  secondRow.scrollIntoView = () => { called = true; };
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(called).to.be.true;
});

it('traps focus by inerting sibling content while open, releasing it on close', async () => {
  const wrapper = await fixture(html`<div>
    <button id="outside">Outside</button>
    <lyra-command-palette .commands=${[{ id: 'save', label: 'Save' }]}></lyra-command-palette>
  </div>`);
  const el = wrapper.querySelector('lyra-command-palette') as LyraCommandPalette;
  const outside = wrapper.querySelector('#outside') as HTMLButtonElement & { inert: boolean };
  el.openPalette(); await el.updateComplete;
  expect(outside.inert).to.be.true;
  el.close(); await el.updateComplete;
  expect(outside.inert).to.be.false;
});

it('closes on a document-level Escape via the shared overlay manager', async () => {
  const el = (await fixture(html`<lyra-command-palette .commands=${[{ id: 'save', label: 'Save' }]}></lyra-command-palette>`)) as LyraCommandPalette;
  el.openPalette(); await el.updateComplete;
  expect(el.open).to.be.true;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('locks document scroll while open and releases it on close', async () => {
  const el = (await fixture(html`<lyra-command-palette .commands=${[{ id: 'save', label: 'Save' }]}></lyra-command-palette>`)) as LyraCommandPalette;
  el.openPalette(); await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');
  el.close(); await el.updateComplete;
  expect(document.documentElement.style.overflow).to.not.equal('hidden');
});

it('does not match the default mod+k shortcut when an extra Shift modifier is held', async () => {
  const el = (await fixture(html`<lyra-command-palette></lyra-command-palette>`)) as LyraCommandPalette;
  const modInit: KeyboardEventInit = { key: 'k', shiftKey: true, bubbles: true, cancelable: true };
  if (navigator.platform.includes('Mac')) modInit.metaKey = true; else modInit.ctrlKey = true;
  window.dispatchEvent(new KeyboardEvent('keydown', modInit));
  await el.updateComplete;
  expect(el.open).to.be.false;
  const plainInit: KeyboardEventInit = { key: 'k', bubbles: true, cancelable: true };
  if (navigator.platform.includes('Mac')) plainInit.metaKey = true; else plainInit.ctrlKey = true;
  window.dispatchEvent(new KeyboardEvent('keydown', plainInit));
  await el.updateComplete;
  expect(el.open).to.be.true;
});
