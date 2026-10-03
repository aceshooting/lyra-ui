import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './currency-picker.js';
import '../../../translations/fr/forms.js';
import '../../../translations/fr/shared.js';
import type { LyraCurrencyPicker } from './currency-picker.js';
import type { LyraCombobox } from '../combobox/combobox.class.js';
import type { LyraSelect } from '../select/select.class.js';
import { resolveValidityAnchor } from '../../../internal/anchored-validity.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function child(picker: LyraCurrencyPicker): LyraSelect<false> | LyraCombobox<false> {
  const control = picker.shadowRoot?.querySelector<LyraSelect<false> | LyraCombobox<false>>('lr-select, lr-combobox');
  if (!control) throw new Error('Missing composed currency control');
  return control;
}
function combo(picker: LyraCurrencyPicker): LyraCombobox<false> {
  const control = child(picker);
  if (!('inputValue' in control)) throw new Error('Expected searchable currency control');
  return control;
}
async function settle(picker: LyraCurrencyPicker): Promise<void> {
  await picker.updateComplete;
  await child(picker).updateComplete;
  await picker.updateComplete;
  await child(picker).updateComplete;
}
function input(picker: LyraCurrencyPicker): HTMLInputElement {
  if (!picker.input) throw new Error('Missing public currency filter input');
  return picker.input;
}
function rowCodes(picker: LyraCurrencyPicker): string[] {
  return [...child(picker).shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]')]
    .map(row => row.dataset['value'] ?? '');
}
async function filter(picker: LyraCurrencyPicker, query: string): Promise<void> {
  const control = combo(picker);
  control.open = true;
  await control.updateComplete;
  input(picker).value = query;
  input(picker).dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: query, inputType: 'insertText' }));
  await settle(picker);
}
async function click(element: HTMLElement): Promise<void> {
  await hoverUntilMatched(element, 'Pointer reaches the currency search control');
  const bounds = element.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(bounds.x + bounds.width / 2), Math.round(bounds.y + bounds.height / 2)] });
  await resetMouse();
}

describe('lr-currency-picker optional search and groups', () => {
  it('keeps the unset compact mode and its code-only typeahead', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker label="Currency"
      .currencies=${[{ code: 'EUR', label: 'Dollar account' }, { code: 'USD', label: 'Euro account' }]}></lr-currency-picker>`);
    await settle(picker);
    expect(picker.searchable).to.equal(false);
    expect(picker.input === null).to.equal(true);
    expect(child(picker).localName).to.equal('lr-select');
    expect(Object.hasOwn(child(picker), 'maxRender')).to.equal(false);
    expect(Object.hasOwn(child(picker), 'autocomplete')).to.equal(false);
    await focusByKeyboard(picker);
    await sendKeys({ press: 'u' });
    expect(picker.value).to.equal('USD');
  });

  it('starts search mode truly empty with a placeholder and no unknown badge or clear action', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker searchable required clearable
      placeholder="Choose currency" .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settle(picker);
    expect(input(picker).value).to.equal('');
    expect(input(picker).placeholder).to.equal('Choose currency');
    expect(combo(picker).shadowRoot!.querySelectorAll('[part="unknown-value"], [part="clear-button"]').length).to.equal(0);
    expect(picker.validity.valueMissing).to.equal(true);
    expect(input(picker).getAttribute('aria-label')).to.equal('Currency');
  });

  it('matches codes, localized names and normal or narrow symbols despite caller display overrides', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker searchable locale="en-US"
      .currencies=${[{ code: 'CAD', label: 'Northern account', symbol: 'credits' }, { code: 'EUR' }, { code: 'JPY' }]}></lr-currency-picker>`);
    await settle(picker);
    for (const query of ['cad', 'Northern', 'Canadian', 'CA$', '$', 'credits']) {
      await filter(picker, query);
      expect(rowCodes(picker), query).to.deep.equal(['CAD']);
    }
    await filter(picker, '€');
    expect(rowCodes(picker)).to.deep.equal(['EUR']);
    picker.locale = 'fr';
    await settle(picker);
    await filter(picker, 'japonais');
    expect(rowCodes(picker)).to.deep.equal(['JPY']);
  });

  it('preserves caller ordering and contiguous group headings in both modes', async () => {
    const currencies = [
      { code: 'JPY', group: 'Often used' }, { code: 'EUR', group: 'Often used' },
      { code: 'USD', group: 'Accounts' }, { code: 'CAD', group: 'Often used' },
    ];
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker .currencies=${currencies}></lr-currency-picker>`);
    for (const searchable of [false, true]) {
      picker.searchable = searchable;
      await settle(picker);
      child(picker).open = true;
      await settle(picker);
      expect(rowCodes(picker)).to.deep.equal(['JPY', 'EUR', 'USD', 'CAD']);
      expect([...child(picker).shadowRoot!.querySelectorAll('[part="group-label"]')].map(node => node.textContent?.trim()))
        .to.deep.equal(['Often used', 'Accounts', 'Often used']);
    }
  });

  it('keeps every bounded custom catalog row reachable beyond the combobox default render limit', async () => {
    const currencies = Array.from({ length: 230 }, (_, index) =>
      `A${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + index % 26)}`);
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker searchable .currencies=${currencies}></lr-currency-picker>`);
    await settle(picker);
    await focusByKeyboard(picker);
    await waitUntil(() => combo(picker).open);
    expect(rowCodes(picker)).to.deep.equal(currencies);
    expect(combo(picker).shadowRoot!.querySelectorAll('[part="option-overflow"]').length).to.equal(0);
    await sendKeys({ press: 'End' });
    await sendKeys({ press: 'Enter' });
    expect(picker.value).to.equal(currencies[currencies.length - 1]);
  });

  it('retains the composed combobox full-list behavior for text equal to the selected code', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker searchable value="EUR"
      .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settle(picker);
    await filter(picker, 'eur');
    expect(rowCodes(picker)).to.deep.equal(['EUR', 'USD']);
    expect(picker.value).to.equal('EUR');
  });

  it('contains typing events and commits one keyboard selection after the outer form value changes', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-currency-picker searchable name="currency" value="EUR"
      .currencies=${['EUR', 'USD', 'JPY']}></lr-currency-picker></form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settle(picker);
    const events: string[] = [];
    for (const name of ['input', 'lr-input', 'change', 'lr-change', 'lr-filter']) {
      picker.addEventListener(name, () => events.push(`${name}:${new FormData(form).get('currency')}`));
    }
    await focusByKeyboard(picker);
    input(picker).select();
    await sendKeys({ type: 'dollar' });
    await waitUntil(() => combo(picker).inputValue === 'dollar');
    expect(rowCodes(picker)).to.deep.equal(['USD']);
    expect(picker.value).to.equal('EUR');
    expect(new FormData(form).get('currency')).to.equal('EUR');
    expect(events).to.deep.equal([]);
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'Enter' });
    await settle(picker);
    expect(events).to.deep.equal(['input:USD', 'lr-input:USD', 'change:USD', 'lr-change:USD']);
    expect(input(picker).value).to.equal('USD');
    expect(combo(picker).name).to.equal('');
    expect(combo(picker).form === null).to.equal(true);
  });

  it('selects a real pointer result and clears the committed code once', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker searchable clearable
      .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settle(picker);
    await focusByKeyboard(picker);
    await sendKeys({ type: 'dollar' });
    await waitUntil(() => rowCodes(picker).join() === 'USD');
    const changes: string[] = [];
    picker.addEventListener('lr-change', event => changes.push(event.detail.value));
    await click(combo(picker).shadowRoot!.querySelector<HTMLElement>('[part="option"][data-value="USD"]')!);
    await settle(picker);
    await click(combo(picker).shadowRoot!.querySelector<HTMLElement>('[part="clear-button"]')!);
    await settle(picker);
    expect(changes).to.deep.equal(['USD', '']);
    expect(input(picker).value).to.equal('');
    expect(combo(picker).shadowRoot!.querySelectorAll('[part="unknown-value"]').length).to.equal(0);
  });

  it('submits the outer form with its submitter on unclaimed Enter without committing query text', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-currency-picker searchable name="currency" value="EUR"
      .currencies=${['EUR', 'USD']}></lr-currency-picker><button type="submit" name="intent" value="save">Save</button></form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    const submitted: Array<[string | null, FormDataEntryValue | null]> = [];
    form.addEventListener('submit', event => {
      event.preventDefault();
      submitted.push([event.submitter?.getAttribute('name') ?? null, new FormData(form).get('currency')]);
    });
    await settle(picker);
    await focusByKeyboard(picker);
    await sendKeys({ press: 'Enter' });
    expect(submitted).to.deep.equal([['intent', 'EUR']]);
    await filter(picker, 'no currency match');
    await sendKeys({ press: 'Enter' });
    expect(submitted).to.deep.equal([['intent', 'EUR'], ['intent', 'EUR']]);
    await filter(picker, 'dollar');
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'Enter' });
    expect(picker.value).to.equal('USD');
    expect(submitted.length).to.equal(2);
    for (const event of [
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, composed: true }),
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, composed: true }),
    ]) input(picker).dispatchEvent(event);
    expect(submitted.length).to.equal(2);
  });

  it('never commits an unmatched query or disabled result and localizes no matches through strings', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker searchable value="EUR"
      .strings=${{ noMatches: 'No supported currencies' }}
      .currencies=${[{ code: 'EUR' }, { code: 'USD', disabled: true }]}></lr-currency-picker>`);
    await settle(picker);
    await focusByKeyboard(picker);
    await filter(picker, 'dollar');
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'Enter' });
    expect(picker.value).to.equal('EUR');
    await filter(picker, 'unmatched text');
    expect(rowCodes(picker)).to.deep.equal([]);
    expect(combo(picker).shadowRoot!.querySelector('.empty')?.textContent?.trim()).to.equal('No supported currencies');
    await sendKeys({ press: 'Enter' });
    expect(picker.value).to.equal('EUR');
  });

  it('restores the child display when a still-rendered row becomes unavailable before its commit', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker searchable value="EUR"
      .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settle(picker);
    await filter(picker, 'dollar');
    const staleRow = combo(picker).shadowRoot!.querySelector<HTMLElement>('[part="option"][data-value="USD"]')!;
    let changes = 0;
    picker.addEventListener('lr-change', () => changes++);
    picker.currencies = ['EUR'];
    staleRow.click();
    expect(picker.value).to.equal('EUR');
    expect(combo(picker).value).to.equal('EUR');
    await settle(picker);
    expect(input(picker).value).to.equal('EUR');
    expect(changes).to.equal(0);
  });

  it('forwards native editing assistance and exposes native editing without changing selection', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker searchable value="EUR"
      autocomplete="off" inputmode="search" enterkeyhint="search" spellcheck="true" autocapitalize="characters"
      autocorrect="off" .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settle(picker);
    const native = input(picker);
    expect([native.getAttribute('autocomplete'), native.getAttribute('inputmode'), native.getAttribute('enterkeyhint'), native.spellcheck, native.getAttribute('autocapitalize'), native.getAttribute('autocorrect')])
      .to.deep.equal(['off', 'search', 'search', true, 'characters', 'off']);
    picker.removeAttribute('spellcheck');
    picker.removeAttribute('autocorrect');
    await settle(picker);
    expect(native.spellcheck).to.equal(false);
    expect(picker.autocorrect).to.equal(true);
    expect(native.getAttribute('autocorrect')).to.equal(null);
    native.value = 'USD';
    expect(picker.value).to.equal('EUR');
    native.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await settle(picker);
    expect(rowCodes(picker)).to.deep.equal(['USD']);
    expect(picker.value).to.equal('EUR');
  });

  it('resets an unchanged default while discarding the filter and preserving custom validity', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-currency-picker searchable name="currency" value=" eur "
      .currencies=${['EUR', 'USD']}></lr-currency-picker></form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settle(picker);
    picker.setCustomValidity('Choose an account');
    await filter(picker, 'dollar');
    form.reset();
    await settle(picker);
    expect(picker.value).to.equal('EUR');
    expect(input(picker).value).to.equal('EUR');
    expect(combo(picker).inputValue).to.equal('');
    expect(combo(picker).open).to.equal(false);
    expect(picker.validationMessage).to.equal('Choose an account');
    expect(new FormData(form).get('currency')).to.equal('EUR');
    picker.formStateRestoreCallback(' usd ', 'restore');
    await settle(picker);
    expect(picker.value).to.equal('USD');
    expect(input(picker).value).to.equal('USD');
  });

  it('retains focus, value, slots, external descriptions and validity across mode changes', async () => {
    const host = await fixture<HTMLDivElement>(html`<div><p id="currency-search-hint">Account choice</p>
      <lr-currency-picker value="EUR" aria-label="Billing currency" aria-describedby="currency-search-hint"
        .currencies=${['EUR', 'USD']}><span slot="label">Currency label</span><span slot="hint">Help</span></lr-currency-picker></div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settle(picker);
    picker.setCustomValidity('Not accepted');
    await focusByKeyboard(picker);
    picker.searchable = true;
    await settle(picker);
    await waitUntil(() => combo(picker).shadowRoot!.activeElement === input(picker));
    expect(input(picker).getAttribute('aria-label')).to.equal('Billing currency');
    expect(input(picker).ariaDescribedByElements?.map(element => element.textContent)).to.include('Account choice');
    expect(combo(picker).querySelector<HTMLSlotElement>('slot[slot="label"]')?.assignedElements()[0]?.textContent).to.equal('Currency label');
    await filter(picker, 'dollar');
    picker.searchable = false;
    await settle(picker);
    const anchor = resolveValidityAnchor(child(picker))!;
    await waitUntil(() => child(picker).shadowRoot!.activeElement === anchor);
    expect(picker.input === null).to.equal(true);
    expect(picker.value).to.equal('EUR');
    expect(picker.defaultValue).to.equal('EUR');
    expect(picker.validationMessage).to.equal('Not accepted');
    picker.searchable = true;
    await settle(picker);
    expect(combo(picker).inputValue).to.equal('');
    expect(input(picker).value).to.equal('EUR');
  });

  it('does not steal outside focus, and reconnects without stale query or popup state', async () => {
    const host = await fixture<HTMLDivElement>(html`<div><button>Other action</button><lr-currency-picker searchable
      value="EUR" .currencies=${['EUR', 'USD']}></lr-currency-picker></div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    const button = host.querySelector('button')!;
    await settle(picker);
    await filter(picker, 'dollar');
    picker.remove();
    host.append(picker);
    await settle(picker);
    expect(combo(picker).open).to.equal(false);
    expect(combo(picker).inputValue).to.equal('');
    expect(input(picker).value).to.equal('EUR');
    await focusByKeyboard(button);
    picker.searchable = false;
    await settle(picker);
    expect(document.activeElement === button).to.equal(true);
    picker.searchable = true;
    await settle(picker);
    expect(document.activeElement === button).to.equal(true);
  });

  it('keeps an untouched required field pristine when replacing its focused control', async () => {
    const picker = await fixture<LyraCurrencyPicker>(html`<lr-currency-picker required
      .currencies=${['EUR', 'USD']}></lr-currency-picker>`);
    await settle(picker);
    await focusByKeyboard(picker);
    expect(picker.matches(':state(user-invalid)')).to.equal(false);
    picker.searchable = true;
    await settle(picker);
    await waitUntil(() => combo(picker).shadowRoot!.activeElement === input(picker));
    expect(picker.matches(':state(user-invalid)')).to.equal(false);
    picker.searchable = false;
    await settle(picker);
    await waitUntil(() => child(picker).shadowRoot!.activeElement === resolveValidityAnchor(child(picker)));
    expect(picker.matches(':state(user-invalid)')).to.equal(false);
  });

  it('keeps existing public parts and the group heading styleable in both modes', async () => {
    const host = await fixture<HTMLDivElement>(html`<div>
      <style>lr-currency-picker::part(select-group-label) { letter-spacing: 3px; }
        lr-currency-picker::part(select-display-input) { font-style: italic; }
        lr-currency-picker::part(select-trigger) { border-radius: 7px; }</style>
      <lr-currency-picker value="EUR" .currencies=${[{ code: 'EUR', group: 'Accounts' }]}></lr-currency-picker>
    </div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    for (const searchable of [false, true, false]) {
      picker.searchable = searchable;
      await settle(picker);
      child(picker).open = true;
      await settle(picker);
      const root = child(picker).shadowRoot!;
      const group = root.querySelector<HTMLElement>('[part="group-label"]')!;
      const display = root.querySelector<HTMLElement>(searchable ? '[part="combobox-input"]' : '[part="display-input"]')!;
      const trigger = root.querySelector<HTMLElement>(searchable ? '[part="combobox"]' : '[part="trigger"]')!;
      const mode = searchable ? 'searchable' : 'compact';
      expect(getComputedStyle(group).letterSpacing, `${mode} group part`).to.equal('3px');
      expect(getComputedStyle(display).fontStyle, `${mode} display part`).to.equal('italic');
      expect(getComputedStyle(trigger).borderTopLeftRadius, `${mode} trigger part`).to.equal('7px');
    }
  });

  it('gates the filter with a disabled fieldset and restores real required validity focus', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><fieldset disabled><lr-currency-picker searchable required
      name="currency" .currencies=${['EUR', 'USD']}></lr-currency-picker></fieldset></form>`);
    const picker = form.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settle(picker);
    expect(input(picker).disabled).to.equal(true);
    expect(new FormData(form).has('currency')).to.equal(false);
    picker.click();
    expect(combo(picker).open).to.equal(false);
    form.querySelector('fieldset')!.disabled = false;
    await settle(picker);
    expect(picker.reportValidity()).to.equal(false);
    await waitUntil(() => combo(picker).shadowRoot!.activeElement === input(picker));
    expect(input(picker).getAttribute('aria-invalid')).to.equal('true');
    await filter(picker, 'EUR');
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'Enter' });
    await settle(picker);
    expect(picker.validity.valid).to.equal(true);
    expect(input(picker).getAttribute('aria-invalid')).to.equal('false');
    form.querySelector('fieldset')!.disabled = true;
    picker.click();
    expect(combo(picker).open).to.equal(false);
  });

  it('keeps populated grouped search accessible and bounded under narrow RTL allocation', async () => {
    const host = await fixture<HTMLDivElement>(html`<div dir="rtl" style="inline-size:280px;font-size:200%">
      <lr-currency-picker searchable label="Currency" .currencies=${[
        { code: 'EUR', label: 'A long account description that must wrap safely', group: 'Accounts' },
        { code: 'USD', group: 'Accounts' }, { code: 'JPY', group: 'Other' },
      ]}></lr-currency-picker></div>`);
    const picker = host.querySelector<LyraCurrencyPicker>('lr-currency-picker')!;
    await settle(picker);
    await focusByKeyboard(picker);
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => combo(picker).open);
    await settle(picker);
    const listbox = combo(picker).shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    await waitUntil(() => getComputedStyle(listbox).opacity === '1');
    expect(rowCodes(picker)).to.deep.equal(['EUR', 'USD', 'JPY']);
    expect(listbox.scrollWidth).to.be.at.most(listbox.clientWidth + 1);
    expect(getComputedStyle(input(picker)).direction).to.equal('rtl');
    expect(picker.getBoundingClientRect().width).to.be.at.most(281);
    await expect(picker).to.be.accessible();
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !combo(picker).open);
    expect(combo(picker).shadowRoot!.activeElement === input(picker)).to.equal(true);
  });
});
