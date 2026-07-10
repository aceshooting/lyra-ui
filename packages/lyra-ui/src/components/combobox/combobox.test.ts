import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './combobox.js';
import './option.js';
import type { LyraCombobox } from './combobox.js';

const basic = () => html`
  <lyra-combobox>
    <lyra-option value="a">Apple</lyra-option>
    <lyra-option value="b">Banana</lyra-option>
    <lyra-option value="c">Cherry</lyra-option>
  </lyra-combobox>
`;

async function typeQuery(el: LyraCombobox, text: string) {
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
  return input;
}

it('filters options and emits change on select (single)', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  await typeQuery(el, 'ban');
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]');
  expect(rows.length).to.equal(1);

  setTimeout(() => (rows[0] as HTMLElement).click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
});

it('supports multiple selection with tags and array value', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.open = true;
  await el.updateComplete;

  const rows = () => el.shadowRoot!.querySelectorAll('[part="option"]');
  (rows()[0] as HTMLElement).click();
  await el.updateComplete;
  (rows()[2] as HTMLElement).click();
  await el.updateComplete;

  expect(el.value).to.deep.equal(['a', 'c']);
  expect(el.shadowRoot!.querySelectorAll('[part="tag"]').length).to.equal(2);
});

it('removes a value via its tag button', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ['a', 'b'];
  await el.updateComplete;

  const removeBtn = el.shadowRoot!.querySelector('[part="tag__remove-button"]') as HTMLButtonElement;
  removeBtn.click();
  await el.updateComplete;
  expect(el.value).to.deep.equal(['b']);
});

it('clears the value with the clear button', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.withClear = true;
  el.value = 'a';
  await el.updateComplete;

  const clear = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement;
  setTimeout(() => clear.click());
  await oneEvent(el, 'lyra-clear');
  expect(el.value).to.equal('');
});

it('selects with keyboard (ArrowDown + Enter)', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  setTimeout(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
});

it('participates in a form (single + multiple)', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-combobox name="fruit">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;
  el.value = 'b';
  await el.updateComplete;
  expect(new FormData(form).get('fruit')).to.equal('b');

  el.multiple = true;
  el.value = ['a', 'b'];
  await el.updateComplete;
  expect(new FormData(form).getAll('fruit')).to.deep.equal(['a', 'b']);
});

it('is accessible', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.label = 'Fruit';
  el.open = true;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('blocks a required, empty combobox from submitting the form', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-combobox name="fruit" required>
        <lyra-option value="a">Apple</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it('seeds the initial selection from a declaratively-selected <lyra-option>', async () => {
  const el = (await fixture(html`
    <lyra-combobox>
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b" selected>Banana</lyra-option>
    </lyra-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal('b');
});

it('restores the declared default selection on form.reset()', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-combobox name="fruit">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b" selected>Banana</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;
  await el.updateComplete;
  el.value = 'a';
  form.reset();
  expect(el.value).to.equal('b');
});

it('does not let a user pick become the reset default when no option is declared selected', async () => {
  // Regression for the 2026-07-10 review: previously the *first* pick on an
  // initially-unselected combobox silently became the permanent reset
  // default, so a later different pick could never reset back to empty.
  const form = (await fixture(html`
    <form>
      <lyra-combobox name="fruit">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;
  await el.updateComplete;
  el.value = 'a';
  el.value = 'b';
  form.reset();
  expect(el.value).to.equal('');
});
