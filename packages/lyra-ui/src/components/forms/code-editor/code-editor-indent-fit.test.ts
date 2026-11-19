import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './code-editor.js';
import type { LyraCodeEditor } from './code-editor.js';

const textareaOf = (el: LyraCodeEditor): HTMLTextAreaElement => el.shadowRoot!.querySelector('textarea')!;

async function pressTab(el: LyraCodeEditor, selection: [number, number]): Promise<void> {
  const textarea = textareaOf(el);
  await focusByKeyboard(textarea);
  textarea.setSelectionRange(selection[0], selection[1]);
  textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
}

describe('lr-code-editor Tab', () => {
  it('indents every line of a multi-line selection and keeps the selection instead of replacing it', async () => {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor tab-size="2" value=${'one\ntwo\nthree'}></lr-code-editor>`);
    await pressTab(el, [0, el.value.length]);
    expect(el.value).to.equal('  one\n  two\n  three');
    const textarea = textareaOf(el);
    expect(textarea.selectionStart).to.equal(0);
    expect(textarea.selectionEnd).to.equal(el.value.length);
  });

  it('does not indent a line the selection only touches at its start', async () => {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor tab-size="2" value=${'one\ntwo\nthree'}></lr-code-editor>`);
    await pressTab(el, [2, 8]);
    expect(el.value).to.equal('  one\n  two\nthree');
  });

  it('indents a line with a partial selection without deleting the selected text', async () => {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor tab-size="2" value="example"></lr-code-editor>`);
    const textarea = textareaOf(el);
    await focusByKeyboard(textarea);
    textarea.setSelectionRange(1, 4, 'backward');
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(el.value).to.equal('  example');
    expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).to.equal('xam');
    expect(textarea.selectionDirection).to.equal('backward');
  });

  it('indents a leading empty line when the selection starts at the beginning', async () => {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor tab-size="2" .value=${'\nexample'}></lr-code-editor>`);
    await pressTab(el, [0, el.value.length]);
    expect(el.value).to.equal('  \n  example');
  });

  it('leaves Tab alone in a document without a browsing context', async () => {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor value="example"></lr-code-editor>`);
    const detached = document.implementation.createHTMLDocument();
    detached.body.append(el);
    await el.updateComplete;
    const textarea = textareaOf(el);
    textarea.setSelectionRange(0, 0);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    textarea.dispatchEvent(tab);
    expect(tab.defaultPrevented).to.equal(false);
    expect(el.value).to.equal('example');
    expect(textarea.value).to.equal('example');
    el.remove();
  });

  it('never grows the value past maxlength', async () => {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor tab-size="4" maxlength="6" value="abcde"></lr-code-editor>`);
    await pressTab(el, [5, 5]);
    expect(el.value).to.equal('abcde ');
    expect(el.validity.tooLong).to.equal(false);
    await pressTab(el, [6, 6]);
    expect(el.value).to.equal('abcde ');
    el.value = 'a\nb';
    await el.updateComplete;
    el.maxlength = 4;
    await el.updateComplete;
    await pressTab(el, [0, 3]);
    expect(el.value).to.equal('a\nb');
  });
});

describe('lr-code-editor resize="auto"', () => {
  it('refits when the container width changes and the text re-wraps', async () => {
    const holder = await fixture<HTMLElement>(html`
      <div style="inline-size: 600px">
        <lr-code-editor resize="auto" wrap="soft" without-line-numbers
          value=${'word '.repeat(80)}></lr-code-editor>
      </div>
    `);
    const el = holder.querySelector('lr-code-editor') as LyraCodeEditor;
    await el.updateComplete;
    // wait-reason: the initial resize-observer fit must settle before the wide height is sampled.
    await aTimeout(100);
    const wide = textareaOf(el).getBoundingClientRect().height;
    holder.style.inlineSize = '200px';
    await waitUntil(() => textareaOf(el).getBoundingClientRect().height > wide + 10, 'the narrower editor grows');
    const narrow = textareaOf(el);
    expect(narrow.scrollHeight).to.be.at.most(narrow.clientHeight + 1);
    holder.style.inlineSize = '600px';
    await waitUntil(() => textareaOf(el).getBoundingClientRect().height <= wide + 1, 'the wider editor shrinks back');
  });
});

describe('lr-code-editor rows', () => {
  it('returns to the declared default when the attribute is removed', async () => {
    const el = await fixture<LyraCodeEditor>(html`<lr-code-editor></lr-code-editor>`);
    el.setAttribute('rows', '8');
    await el.updateComplete;
    expect(el.rows).to.equal(8);
    el.removeAttribute('rows');
    await el.updateComplete;
    expect(el.rows).to.equal(4);
    expect(textareaOf(el).rows).to.equal(4);
  });
});
