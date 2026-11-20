import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-combobox.js';
import '../../lr-option.js';
import type { LyraCombobox } from '../../lr-combobox.js';
import type { LyraOption } from '../../lr-option.js';

describe('lr-combobox live option writes', () => {
  it('lets a later parent value write supersede a queued option edit without user events', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-combobox label="Fruit" name="fruit">
        <lr-option value="a" selected>Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-combobox></form>
    `);
    const el = form.querySelector('lr-combobox')!;
    const options = [...el.querySelectorAll<LyraOption>('lr-option')];
    const events: string[] = [];
    for (const name of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(name, () => events.push(name));

    options[1]!.selected = true;
    el.value = 'c';
    expect(new FormData(form).getAll('fruit')).to.deep.equal(['c']);
    await Promise.resolve();
    await Promise.resolve();
    await el.updateComplete;

    expect(el.value).to.equal('c');
    expect(options.map(option => option.selected)).to.deep.equal([false, false, true]);
    expect(new FormData(form).getAll('fruit')).to.deep.equal(['c']);
    expect(options.map(option => option.defaultSelected)).to.deep.equal([true, false, false]);
    expect(events).to.deep.equal([]);
  });

  it('lets a native reset supersede queued multiple option edits without changing the reset default', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-combobox multiple label="Fruit" name="fruit">
        <lr-option value="a" selected>Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-combobox></form>
    `);
    const el = form.querySelector('lr-combobox') as LyraCombobox<true>;
    const options = [...el.querySelectorAll<LyraOption>('lr-option')];
    el.value = ['c'];
    await el.updateComplete;
    const events: string[] = [];
    for (const name of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(name, () => events.push(name));

    options[1]!.selected = true;
    options[2]!.selected = false;
    form.reset();
    expect(new FormData(form).getAll('fruit')).to.deep.equal(['a']);
    await Promise.resolve();
    await Promise.resolve();
    await el.updateComplete;

    expect(el.value).to.deep.equal(['a']);
    expect(options.map(option => option.defaultSelected)).to.deep.equal([true, false, false]);
    expect(options.map(option => option.selected)).to.deep.equal([true, false, false]);
    expect(new FormData(form).getAll('fruit')).to.deep.equal(['a']);
    expect(events).to.deep.equal([]);
  });

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
