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
