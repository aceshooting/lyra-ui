import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import './combobox.js';
import './option.js';
import type { LyraCombobox } from './combobox.js';
async function settle(el: LyraCombobox) { await el.updateComplete; await nextFrame(); await el.updateComplete; }
it('refreshes a stable filter callback after an explicit coalesced update', async () => {
  let accepted = 'a';
  const el = await fixture<LyraCombobox>(html`<lr-combobox label="Choice"><lr-option value="a">Alpha</lr-option><lr-option value="b">Beta</lr-option></lr-combobox>`);
  el.filter = option => option.value === accepted;
  await el.show();
  (el as unknown as { query: string }).query = 'x'; await settle(el);
  expect(el.shadowRoot!.querySelector('[part="option"]')?.textContent).contain('Alpha');
  accepted = 'b'; el.label = 'Updated'; el.requestUpdate(); await settle(el);
  expect(el.shadowRoot!.querySelector('[part="option"]')?.textContent).contain('Beta');
});
it('refreshes a stable unknown label callback after an explicit coalesced update', async () => {
  let label = 'Before';
  const el = await fixture<LyraCombobox>(html`<lr-combobox label="Choice" with-unknown-option><lr-option value="known">Known</lr-option></lr-combobox>`);
  el.getUnknownLabel = () => label; el.value = 'missing'; await el.show(); await settle(el);
  expect(el.shadowRoot!.querySelector('[part="listbox"]')?.textContent).contain('Before');
  label = 'After'; el.label = 'Updated'; el.requestUpdate(); await settle(el);
  expect(el.shadowRoot!.querySelector('[part="listbox"]')?.textContent).contain('After');
});
