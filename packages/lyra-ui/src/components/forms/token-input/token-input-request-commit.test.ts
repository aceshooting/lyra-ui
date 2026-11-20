import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-token-input.js';
import type { LyraTokenInput } from '../../lr-token-input.js';

const draftOf = (el: LyraTokenInput): HTMLInputElement =>
  el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;

function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('lr-token-input request listeners', () => {
  it('keeps a controlled write made by an add-request listener', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['a']}></lr-token-input>`);
    el.addEventListener('lr-token-add-request', () => {
      el.value = ['a', 'controlled'];
    });
    const input = draftOf(el);
    input.value = 'b';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    press(input, 'Enter');
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a', 'controlled', 'b']);
  });

  it('removes the right token when a remove-request listener rewrote the list', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['a', 'b', 'c']}></lr-token-input>`);
    el.addEventListener('lr-token-remove-request', () => {
      el.value = ['x', 'a', 'b', 'c'];
    });
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="remove"]')[1]!.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(['x', 'a', 'c']);
  });

  it('does not commit an add after the listener disabled the field', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['a']}></lr-token-input>`);
    el.addEventListener('lr-token-add-request', () => {
      el.disabled = true;
    });
    const input = draftOf(el);
    input.value = 'b';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    press(input, 'Enter');
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a']);
  });

  it('does not delete a second token for a held Backspace on an empty draft', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['a', 'b', 'c']}></lr-token-input>`);
    const input = draftOf(el);
    press(input, 'Backspace');
    press(input, 'Backspace', { repeat: true });
    press(input, 'Backspace', { repeat: true });
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a', 'b']);
  });

  it('applies an edit to the token a request listener moved, and drops it when the token is gone', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input editable .value=${['a', 'b']}></lr-token-input>`);
    el.addEventListener('lr-token-edit-request', () => {
      el.value = ['x', 'a', 'b'];
    }, { once: true });
    (el as unknown as { startEdit(index: number): void }).startEdit(1);
    await el.updateComplete;
    (el as unknown as { editDraft: string }).editDraft = 'B2';
    (el as unknown as { commitEdit(restore: boolean): void }).commitEdit(false);
    await el.updateComplete;
    expect(el.value).to.deep.equal(['x', 'a', 'B2']);

    const gone = await fixture<LyraTokenInput>(html`<lr-token-input editable .value=${['a', 'b']}></lr-token-input>`);
    gone.addEventListener('lr-token-edit-request', () => {
      gone.value = ['a'];
    }, { once: true });
    (gone as unknown as { startEdit(index: number): void }).startEdit(1);
    await gone.updateComplete;
    (gone as unknown as { editDraft: string }).editDraft = 'B2';
    (gone as unknown as { commitEdit(restore: boolean): void }).commitEdit(false);
    await gone.updateComplete;
    expect(gone.value).to.deep.equal(['a']);
  });
});
