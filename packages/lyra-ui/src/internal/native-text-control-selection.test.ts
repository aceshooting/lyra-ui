import { expect, fixture, html } from '@open-wc/testing';
import type { LyraInput } from '../components/forms/input/input.js';
import type { LyraTextarea } from '../components/forms/textarea/textarea.js';
import type { LyraCodeEditor } from '../components/forms/code-editor/code-editor.js';
import '../components/forms/input/input.js';
import '../components/forms/textarea/textarea.js';
import '../components/forms/code-editor/code-editor.js';

type TextControl = LyraInput | LyraTextarea | LyraCodeEditor;

for (const tag of ['lr-input', 'lr-textarea', 'lr-code-editor'] as const) {
  for (const property of ['selectionStart', 'selectionEnd', 'selectionDirection'] as const) {
    it(`${tag} applies a nullable ${property} reset to subsequent silent edits and form data`, async () => {
      const form = await fixture<HTMLFormElement>(html`<form></form>`);
      const control = document.createElement(tag) as TextControl;
      control.name = 'edit';
      control.value = 'abcdef';
      control.setAttribute('aria-label', 'Text to edit');
      form.append(control);
      await control.updateComplete;
      const native = document.createElement(tag === 'lr-input' ? 'input' : 'textarea');
      native.value = 'abcdef';
      native.setSelectionRange(1, 4, 'backward');
      control.setSelectionRange(1, 4, 'backward');
      let inputEvents = 0, changeEvents = 0;
      control.addEventListener('input', () => inputEvents++);
      control.addEventListener('change', () => changeEvents++);
      control[property] = null;
      Reflect.set(native, property, null);
      const start = property === 'selectionDirection' ? 1 : 0;
      const end = property === 'selectionEnd' ? 0 : 4;
      expect([control.selectionStart, control.selectionEnd]).to.deep.equal([start, end]);
      expect(control.selectionDirection).to.equal(native.selectionDirection);
      expect(control.value).to.equal('abcdef');
      expect(new FormData(form).get('edit')).to.equal('abcdef');
      control.setRangeText('X');
      await control.updateComplete;
      const expected = property === 'selectionStart' ? 'Xef' : property === 'selectionEnd' ? 'Xabcdef' : 'aXef';
      expect(control.value).to.equal(expected);
      expect(control.input!.value).to.equal(expected);
      expect(new FormData(form).get('edit')).to.equal(expected);
      expect(inputEvents).to.equal(0);
      expect(changeEvents).to.equal(0);
    });
  }
}
