import { fixture, expect, html } from '@open-wc/testing';
import './code-editor.js';
import type { LyraCodeEditor } from './code-editor.js';
import { styles } from './code-editor.styles.js';

it('keeps scrolling on the editor frame instead of creating a nested textarea scrollbar', () => {
  expect(styles.cssText).to.contain('grid-template-columns: auto max-content');
  expect(styles.cssText).to.contain('inline-size: max-content');
  expect(styles.cssText).to.contain('overflow: visible');
});

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

it('renders hint/errorText text and wires aria-describedby to the visible parts', async () => {
  const el = (await fixture(
    html`<lyra-code-editor label="Source" hint="Keep it short" error-text="Required"></lyra-code-editor>`,
  )) as LyraCodeEditor;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hint.hidden).to.be.false;
  expect(hint.textContent).to.contain('Keep it short');
  expect(error.hidden).to.be.false;
  expect(error.textContent).to.contain('Required');
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(textarea.getAttribute('aria-describedby')).to.equal(`${error.id} ${hint.id}`);
});

it('supports label, hint, and error slots with same-shadow description ids', async () => {
  const el = (await fixture(html`
    <lyra-code-editor>
      <span slot="label">Slotted label</span>
      <span slot="hint">Slotted hint</span>
      <span slot="error">Slotted error</span>
    </lyra-code-editor>
  `)) as LyraCodeEditor;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(label.hidden).to.be.false;
  expect(hint.hidden).to.be.false;
  expect(error.hidden).to.be.false;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(textarea.getAttribute('aria-describedby')).to.equal(`${error.id} ${hint.id}`);
});

it('hides hint/error parts and omits aria-describedby when unset', async () => {
  const el = (await fixture(html`<lyra-code-editor></lyra-code-editor>`)) as LyraCodeEditor;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hint.hidden).to.be.true;
  expect(error.hidden).to.be.true;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(textarea.hasAttribute('aria-describedby')).to.be.false;
});

it('toggles data-invalid once touched and invalid', async () => {
  const el = (await fixture(html`<lyra-code-editor required></lyra-code-editor>`)) as LyraCodeEditor;
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.false;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  textarea.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.true;
});
