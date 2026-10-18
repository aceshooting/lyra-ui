import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
it('refreshes a stable unknown label callback after an explicit coalesced update', async () => {
  let label = 'Before';
  const el = await fixture<LyraSelect>(html`<lr-select label="Choice" with-unknown-option><lr-option value="known">Known</lr-option></lr-select>`);
  el.getUnknownLabel = () => label; el.value = 'missing'; await el.show(); await nextFrame(); await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="listbox"]')?.textContent).contain('Before');
  label = 'After'; el.label = 'Updated'; el.requestUpdate(); await el.updateComplete; await nextFrame();
  expect(el.shadowRoot!.querySelector('[part="listbox"]')?.textContent).contain('After');
});
