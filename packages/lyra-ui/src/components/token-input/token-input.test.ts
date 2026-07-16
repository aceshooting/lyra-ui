import { fixture, expect, html } from '@open-wc/testing';
import './token-input.js';
import type { LyraTokenInput } from './token-input.js';

it('adds and removes tokens with the keyboard', async () => {
  const el = (await fixture(html`<lyra-token-input></lyra-token-input>`)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'alpha'; input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.value).to.deep.equal(['alpha']);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
  expect(el.value).to.deep.equal([]);
});

it('is form-associated and validates required values', async () => {
  const el = (await fixture(html`<lyra-token-input required></lyra-token-input>`)) as LyraTokenInput;
  expect(el.checkValidity()).to.be.false;
  el.value = ['ready'];
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;
});

it('is accessible', async () => {
  const el = await fixture(html`<lyra-token-input label="Recipients"></lyra-token-input>`);
  await expect(el).to.be.accessible();
});
