import { expect, fixture, html } from '@open-wc/testing';
import './combobox.js';
import './option.js';
import type { LyraCombobox } from './combobox.js';
import type { LyraOption } from './option.js';

describe('lr-combobox live option writes', () => {
  it('applies a live selected write while connected', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Fruit" value="a">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-combobox>`);
    const banana = el.querySelectorAll<LyraOption>('lr-option')[1]!;
    banana.selected = true;
    await Promise.resolve();
    await el.updateComplete;
    expect(el.value).to.equal('b');
  });
});

async function typeQuery(el: LyraCombobox, text: string): Promise<HTMLInputElement> {
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
  input.value = text;
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: text, inputType: 'insertText' }));
  await el.updateComplete;
  return input;
}

const enter = (input: HTMLInputElement) =>
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));

describe('lr-combobox readonly during an edit', () => {
  it('does not create an option when made readonly with a pending create row', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Fruit" allow-create>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>`);
    let creates = 0;
    el.addEventListener('lr-create', () => { creates += 1; });
    const input = await typeQuery(el, 'Kiwi');
    el.readonly = true;
    enter(input);
    await el.updateComplete;
    expect(creates).to.equal(0);
    expect(el.querySelectorAll('lr-option').length).to.equal(1);
    expect(el.value).to.equal('');
  });

  it('does not commit a custom value when made readonly mid-edit', async () => {
    const el = await fixture<LyraCombobox>(html`<lr-combobox label="Fruit" allow-custom-value>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>`);
    const input = await typeQuery(el, 'Kiwi');
    el.readonly = true;
    enter(input);
    await el.updateComplete;
    expect(el.value).to.equal('');
  });
});
