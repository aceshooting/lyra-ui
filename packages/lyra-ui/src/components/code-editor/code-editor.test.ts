import { fixture, expect, html } from '@open-wc/testing';
import './code-editor.js';
import type { LyraCodeEditor } from './code-editor.js';

it('renders line numbers and inserts spaces for Tab', async () => {
  const el = (await fixture(html`<lyra-code-editor value="one\ntwo" tab-size="2"></lyra-code-editor>`)) as LyraCodeEditor;
  expect(el.shadowRoot!.querySelectorAll('[part="gutter"] div')).to.have.length(2);
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  textarea.focus(); textarea.setSelectionRange(0, 0); textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  expect(el.value).to.contain('  one');
});

it('is accessible', async () => {
  const el = await fixture(html`<lyra-code-editor label="Source"></lyra-code-editor>`);
  await expect(el).to.be.accessible();
});
