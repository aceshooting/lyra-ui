import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './code-block.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraCodeBlock } from './code-block.js';

it('uses the latest controlled code for gutter navigation before its next render', async () => {
  const el = await fixture<LyraCodeBlock>(html`<lr-code-block .code=${'first\nsecond'} line-numbers activatable-lines></lr-code-block>`);
  const first = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="line-button"][data-line="1"]')!;
  await focusByKeyboard(first);
  // A controlled write and key event can share a task; the DOM still has two lines here.
  el.code = 'first\nsecond\nthird\nfourth';
  first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('data-line') === '4',
    'End reaches the latest controlled final line');
  expect(el.shadowRoot!.querySelectorAll('[part~="line-button"][tabindex="0"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part~="line-button"][data-line="4"]')?.getAttribute('tabindex')).to.equal('0');
});
