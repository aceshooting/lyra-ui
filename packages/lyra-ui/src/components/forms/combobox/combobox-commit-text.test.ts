import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys, sendMouse, resetMouse } from '@web/test-runner-commands';
import '../../lr-combobox.js';
import '../../lr-option.js';
import type { LyraCombobox } from '../../lr-combobox.js';
import type { LyraOption } from '../../lr-option.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const inputOf = (el: LyraCombobox) => el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;

async function typeText(el: LyraCombobox, text: string): Promise<HTMLInputElement> {
  const input = inputOf(el);
  input.value = text;
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: text, inputType: 'insertText' }));
  await el.updateComplete;
  return input;
}

const key = (input: HTMLInputElement, name: string) => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true });
  input.dispatchEvent(event);
  return event;
};

async function mount(): Promise<{ form: HTMLFormElement; el: LyraCombobox; after: HTMLButtonElement }> {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-combobox label="Description" name="description" commit="text">
        <lr-option value="art-1">Steel bracket</lr-option>
        <lr-option value="art-2">Steel bolt</lr-option>
      </lr-combobox>
      <button type="button">After</button>
    </form>
  `);
  const el = form.querySelector('lr-combobox') as LyraCombobox;
  (el.querySelectorAll('lr-option')[1] as LyraOption).data = { sku: 42 };
  await el.updateComplete;
  return { form, el, after: form.querySelector('button')! };
}

describe('lr-combobox commit="text"', () => {
  it('writes a picked label into the value, reports the option data, and keeps the text after blur', async () => {
    const { form, el, after } = await mount();
    const input = await typeText(el, 'bolt');
    key(input, 'ArrowDown');
    await el.updateComplete;
    const change = oneEvent(el, 'lr-change');
    key(input, 'Enter');
    const { detail } = await change;
    expect(detail.value).to.equal('Steel bolt');
    expect(detail.data).to.deep.equal([{ sku: 42 }]);
    expect(el.value).to.equal('Steel bolt');
    expect(new FormData(form).get('description')).to.equal('Steel bolt');
    after.focus();
    await el.updateComplete;
    expect(inputOf(el).value).to.equal('Steel bolt');
    expect(el.shadowRoot!.querySelector('[part="unknown-value"]') === null).to.be.true;
  });

  it('commits free text on Enter (consuming it while the list is open) and on blur', async () => {
    const { el, after } = await mount();
    const input = await typeText(el, 'Custom part');
    expect(el.open).to.be.true;
    const enter = key(input, 'Enter');
    await el.updateComplete;
    expect(enter.defaultPrevented).to.be.true;
    expect(el.value).to.equal('Custom part');
    expect(el.open).to.be.false;

    // Reopening edits the committed text in place rather than blanking it.
    await el.show();
    expect(inputOf(el).value).to.equal('Custom part');
    await typeText(el, 'Custom part 2');
    const change = oneEvent(el, 'lr-change');
    after.focus();
    const { detail } = await change;
    expect(detail.value).to.equal('Custom part 2');
    expect(detail.data).to.deep.equal([undefined]);
    await el.updateComplete;
    expect(inputOf(el).value).to.equal('Custom part 2');
  });

  it('commits free text on Enter while closed and still submits the form', async () => {
    const { form, el } = await mount();
    const input = await typeText(el, 'Zzz');
    await el.hide();
    // Escape-like dismissal reverts the draft; type again with the list closed by a veto.
    expect(el.value).to.equal('');
    el.addEventListener('lr-show', (event) => event.preventDefault(), { once: true });
    await typeText(el, 'Zzz');
    expect(el.open).to.be.false;
    form.addEventListener('submit', (event) => event.preventDefault());
    const submitted = oneEvent(form, 'submit');
    key(input, 'Enter');
    await el.updateComplete;
    expect(el.value).to.equal('Zzz');
    await submitted;
  });

  it('clears the value when the text is emptied and focus leaves', async () => {
    const { el, after } = await mount();
    el.value = 'Old text';
    await el.updateComplete;
    expect(inputOf(el).value).to.equal('Old text');
    inputOf(el).focus();
    await el.updateComplete;
    await typeText(el, '');
    after.focus();
    await el.updateComplete;
    expect(el.value).to.equal('');
  });

  it('keeps the default value mode committing the option value', async () => {
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox label="Part"><lr-option value="art-1">Steel bracket</lr-option></lr-combobox>
    `);
    const input = await typeText(el, 'bracket');
    key(input, 'ArrowDown');
    await el.updateComplete;
    key(input, 'Enter');
    await el.updateComplete;
    expect(el.value).to.equal('art-1');
    expect(el.commit).to.equal('value');
  });

  it('opens on keyboard focus and reopens on a press of the already-focused input', async () => {
    const { el } = await mount();
    await focusByKeyboard(inputOf(el));
    await el.updateComplete;
    expect(el.open).to.be.true;
    await el.hide();
    expect(el.shadowRoot!.activeElement === inputOf(el)).to.be.true;
    const rect = inputOf(el).getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(rect.left + 8), Math.round(rect.top + rect.height / 2)] });
    await resetMouse();
    await el.updateComplete;
    expect(el.open).to.be.true;
    await sendKeys({ press: 'Escape' });
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
  it('honours a vetoed change request, the clear button, a source and the minimum query', async () => {
    const { el } = await mount();
    el.addEventListener('lr-change-request', (event) => event.preventDefault(), { once: true });
    key(await typeText(el, 'Vetoed'), 'Enter');
    await el.updateComplete;
    expect(el.value).to.equal('');

    el.withClear = true;
    el.value = 'Some text';
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="clear-button"]')!.click();
    await el.updateComplete;
    expect(el.value).to.equal('');

    const sourced = await fixture<LyraCombobox>(html`<lr-combobox label="Sourced" commit="text"></lr-combobox>`);
    sourced.source = async () => [];
    sourced.value = 'From source';
    await sourced.updateComplete;
    await sourced.show();
    expect(inputOf(sourced).value).to.equal('From source');

    const gated = await fixture<LyraCombobox>(html`<lr-combobox label="Gated" commit="text" min-query-length="5"></lr-combobox>`);
    gated.value = 'abc';
    await gated.updateComplete;
    await gated.show();
    expect(gated.open).to.be.false;
    expect(inputOf(gated).value).to.equal('abc');
  });

  it('does not reopen a readonly focused input on press', async () => {
    const { el } = await mount();
    el.readonly = true;
    await el.updateComplete;
    inputOf(el).focus();
    const rect = inputOf(el).getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(rect.left + 8), Math.round(rect.top + rect.height / 2)] });
    await resetMouse();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});
