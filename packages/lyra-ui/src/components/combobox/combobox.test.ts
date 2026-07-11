import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './combobox.js';
import './option.js';
import type { LyraCombobox } from './combobox.js';
import { styles } from './combobox.styles.js';

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

it('uses shared svg icons instead of literal glyphs for chevron, clear, and tag-remove', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.withClear = true;
  el.value = ['a'];
  await el.updateComplete;

  const expandIcon = el.shadowRoot!.querySelector('[part="expand-icon"]') as HTMLElement;
  expect(expandIcon.querySelector('svg')).to.exist;
  expect(expandIcon.textContent?.trim()).to.equal('');

  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLElement;
  expect(clearBtn.querySelector('svg')).to.exist;
  expect(clearBtn.textContent?.trim()).to.equal('');

  const removeBtn = el.shadowRoot!.querySelector('[part="tag__remove-button"]') as HTMLElement;
  expect(removeBtn.querySelector('svg')).to.exist;
  expect(removeBtn.textContent?.trim()).to.equal('');

  // The chevron is rotated to a "down" glyph via its wrapping part, not the svg itself.
  expect(styles.cssText).to.include("[part='expand-icon'] svg");
});

it('transitions the listbox with the shared fast-transition token and respects reduced motion', () => {
  const css = styles.cssText;
  const listboxBlock = /\[part=['"]?listbox['"]?]\s*{([^}]*)}/.exec(css);
  expect(listboxBlock, 'expected a base [part="listbox"] rule').to.not.equal(null);
  expect(listboxBlock![1]).to.include('var(--lyra-transition-fast)');
  expect(css).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

it('uses the shared disabled-opacity token for the disabled host and disabled options', async () => {
  const el = (await fixture(html`
    <lyra-combobox open>
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b" disabled>Banana</lyra-option>
    </lyra-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;

  const css = styles.cssText;
  const disabledHostBlock = /:host\(\[disabled\]\)\s*\[part=['"]?combobox['"]?]\s*{([^}]*)}/.exec(css);
  expect(disabledHostBlock, 'expected a :host([disabled]) [part="combobox"] rule').to.not.equal(null);
  expect(disabledHostBlock![1]).to.include('var(--lyra-opacity-disabled)');

  const disabledOptionBlock = /\[part=['"]?option['"]?]\[aria-disabled=['"]?true['"]?]\s*{([^}]*)}/.exec(css);
  expect(disabledOptionBlock, 'expected a [part="option"][aria-disabled="true"] rule').to.not.equal(null);
  expect(disabledOptionBlock![1]).to.include('var(--lyra-opacity-disabled)');

  const disabledOption = el.shadowRoot!.querySelectorAll('[part="option"]')[1] as HTMLElement;
  expect(getComputedStyle(disabledOption).opacity).to.equal('0.5');
});

it('gives the clear button and expand icon a real touch target instead of collapsing to bare glyph height', async () => {
  const css = styles.cssText;
  const btnBlock = /\[part=['"]?clear-button['"]?],\s*\[part=['"]?expand-icon['"]?]\s*{([^}]*)}/.exec(css);
  expect(btnBlock, 'expected a shared [part="clear-button"], [part="expand-icon"] rule').to.not.equal(null);
  expect(btnBlock![1]).to.include('var(--lyra-icon-button-size)');

  const el = (await fixture(basic())) as LyraCombobox;
  el.withClear = true;
  el.value = 'a';
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLElement;
  expect(clearBtn.getBoundingClientRect().height).to.be.greaterThan(24);
});

it('renders errorText in var(--lyra-color-danger), distinct from and alongside the hint', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.hint = 'Pick a fruit';
  el.errorText = 'Selection required';
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  expect(errorPart).to.exist;
  expect(errorPart.textContent).to.contain('Selection required');
  expect(hintPart.textContent).to.contain('Pick a fruit');
  expect(getComputedStyle(errorPart).color).to.not.equal(getComputedStyle(hintPart).color);
});

it('reflects an invalid state only after the field has been interacted with once', async () => {
  const el = (await fixture(html`
    <lyra-combobox required>
      <lyra-option value="a">Apple</lyra-option>
    </lyra-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.false;

  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.dispatchEvent(new FocusEvent('focus'));
  input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.true;
});

it('shows a required-field asterisk after the label', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.label = 'Fruit';
  el.required = true;
  await el.updateComplete;

  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  const after = getComputedStyle(label, '::after');
  expect(after.content).to.contain('*');
});

it('applies the shared focus-ring tokens to the clear and tag-remove buttons', () => {
  const css = styles.cssText;
  const clearFocusBlock = /\[part=['"]?clear-button['"]?]:focus-visible,\s*\[part=['"]?tag__remove-button['"]?]:focus-visible\s*{([^}]*)}/.exec(css);
  expect(clearFocusBlock, 'expected a shared clear/tag-remove :focus-visible rule').to.not.equal(null);
  expect(clearFocusBlock![1]).to.include('var(--lyra-focus-ring-width)');
  expect(clearFocusBlock![1]).to.include('var(--lyra-focus-ring-color)');
});
