import { expect, fixture, html, aTimeout } from '@open-wc/testing';
import '../../lr-textarea.js';
import '../../lr-input.js';
import type { LyraTextarea } from './textarea.class.js';
import type { LyraInput } from '../input/input.class.js';

describe('lr-textarea rows', () => {
  it('returns to the declared default when the attribute is removed', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea></lr-textarea>`);
    el.setAttribute('rows', '8');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('textarea')!.rows).to.equal(8);
    el.removeAttribute('rows');
    await el.updateComplete;
    expect(el.rows).to.equal(4);
    expect(el.shadowRoot!.querySelector('textarea')!.rows).to.equal(4);
  });
});

describe('Enter that confirms an IME candidate', () => {
  for (const [tag, selector] of [['lr-textarea', 'textarea'], ['lr-input', 'input']] as const) {
    it(`does not flush ${tag}'s pending settle`, async () => {
      const el = await fixture<LyraTextarea | LyraInput>(
        tag === 'lr-textarea'
          ? html`<lr-textarea debounce="400"></lr-textarea>`
          : html`<lr-input debounce="400"></lr-input>`,
      );
      let settled = 0;
      el.addEventListener('lr-input-settled', () => settled++);
      const control = el.shadowRoot!.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
      control.value = 'nihon';
      control.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, isComposing: true }));
      control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229, bubbles: true, composed: true, cancelable: true }));
      await aTimeout(50);
      expect(settled).to.equal(0);
      control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
      expect(settled).to.equal(1);
    });
  }
});
