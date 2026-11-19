import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraCountryPicker } from './country-picker.class.js';
import type { LyraCombobox } from '../combobox/combobox.class.js';
import type { LyraSelect } from '../select/select.class.js';
import { COUNTRY_CODES } from '../../../countries.js';
import './country-picker.js';

describe('<lr-country-picker>', () => {
  it('registers the combobox only once searchable is first enabled', async () => {
    const el = await fixture<LyraCountryPicker>(html`<lr-country-picker label="Country" value="LU"></lr-country-picker>`);
    expect(customElements.get('lr-combobox') === undefined, 'a plain picker never pays for the combobox').to.equal(true);
    el.searchable = true;
    await el.updateComplete;
    expect(customElements.get('lr-combobox') !== undefined).to.equal(true);
    const combo = el.shadowRoot!.querySelector<LyraCombobox>('lr-combobox')!;
    expect(combo !== null).to.equal(true);
    await combo.updateComplete;
    expect(el.input !== null).to.equal(true);
  });

  it('offers the pinned countries, names and decorative flags without a search field by default', async () => {
    const el = await fixture<LyraCountryPicker>(html`<lr-country-picker label="Country" value="LU"></lr-country-picker>`);
    el.click();
    await waitUntil(() => el.shadowRoot!.querySelectorAll('lr-option').length === 249);
    expect(COUNTRY_CODES.length).to.equal(249);
    expect(new Set(COUNTRY_CODES).size).to.equal(249);
    expect(COUNTRY_CODES.includes('LB')).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('lr-option').length).to.equal(249);
    expect(el.shadowRoot!.querySelector('lr-select > span[slot="start"] > [part="flag"]')?.textContent).to.equal('🇱🇺');
    expect(el.input === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('lr-select')?.getAttribute('aria-label')).to.equal(null);
    el.flags = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="flag"]').length).to.equal(0);
  });

  for (const searchable of [false, true]) {
    it(`themes invalid styling without overriding the ${searchable ? 'filter' : 'trigger'} open edge`, async () => {
      const el = await fixture<LyraCountryPicker>(html`<lr-country-picker required .searchable=${searchable}
        style="--lr-form-control-invalid-border-color: rgb(12, 34, 56);
          --lr-select-open-border-color: rgb(65, 43, 21);
          --lr-combobox-open-border-color: rgb(65, 43, 21)"></lr-country-picker>`);
      const child = el.shadowRoot!.querySelector<LyraSelect | LyraCombobox>('lr-select, lr-combobox')!;
      const trigger = child.shadowRoot!.querySelector<HTMLElement>(searchable ? '[part="combobox"]' : '[part="trigger"]')!;
      expect(el.reportValidity()).to.equal(false);
      await el.updateComplete;
      el.blur();
      await waitUntil(() => getComputedStyle(trigger).borderTopColor === 'rgb(12, 34, 56)');
      await focusByKeyboard(el);
      await waitUntil(() => getComputedStyle(trigger).borderTopColor !== 'rgb(12, 34, 56)');
      await child.show();
      await waitUntil(() => getComputedStyle(trigger).borderTopColor === 'rgb(65, 43, 21)');
    });

    it(`exposes popup requests, settled transitions, activation and clear in ${searchable ? 'search' : 'compact'} mode`, async () => {
      const el = await fixture<LyraCountryPicker>(html`<lr-country-picker clearable .searchable=${searchable}
        .countries=${['LU', 'FR']}></lr-country-picker>`);
      const child = el.shadowRoot!.querySelector<LyraSelect | LyraCombobox>('lr-select, lr-combobox')!;
      const events: string[] = [];
      for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
        el.addEventListener(name, () => events.push(name));
      }
      el.addEventListener('lr-show', event => event.preventDefault(), { once: true });
      await child.show();
      expect(child.open).to.equal(false);
      await child.show();
      const option = child.shadowRoot!.querySelector<HTMLElement>('[part~="option"]')!;
      const activated = oneEvent(el, 'lr-activate');
      const closed = oneEvent(el, 'lr-after-hide');
      option.click();
      expect((await activated).detail.value).to.equal('LU');
      await closed;
      expect(events).to.deep.equal(['lr-show', 'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
      const cleared = oneEvent(el, 'lr-clear');
      child.shadowRoot!.querySelector<HTMLElement>('[part~="clear-button"]')!.click();
      await cleared;
      expect(el.value).to.equal('');
    });

    it(`styles visible trigger and popup flags, then hides them in ${searchable ? 'search' : 'compact'} mode`, async () => {
      const host = await fixture<HTMLDivElement>(html`<div>
        <style>lr-country-picker::part(flag) { font-size: 31px; }
          lr-country-picker::part(select-display-input) { font-style: italic; }
          lr-country-picker::part(select-trigger) { border-radius: 7px; }</style>
        <lr-country-picker label="Country" value="LU" .searchable=${searchable}
          .countries=${['LU', 'FR']}></lr-country-picker>
      </div>`);
      const el = host.querySelector<LyraCountryPicker>('lr-country-picker')!;
      const child = el.shadowRoot!.querySelector<LyraSelect<false> | LyraCombobox<false>>('lr-select, lr-combobox')!;
      await child.updateComplete;
      child.open = true;
      await child.updateComplete;
      const popup = child.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
      const visibleFlags = () => [...child.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"] [part="flag"]')];
      await waitUntil(() => visibleFlags().length === 2 && getComputedStyle(popup).opacity === '1');
      const display = child.shadowRoot!.querySelector<HTMLElement>(searchable ? '[part="combobox-input"]' : '[part="display-input"]')!;
      const trigger = child.shadowRoot!.querySelector<HTMLElement>(searchable ? '[part="combobox"]' : '[part="trigger"]')!;
      expect(getComputedStyle(display).fontStyle, 'forwarded display part').to.equal('italic');
      const optionLabel = child.shadowRoot!.querySelector<HTMLElement>('[part="option-label"]')!;
      expect(getComputedStyle(optionLabel).unicodeBidi).to.equal('isolate');
      expect(getComputedStyle(trigger).borderTopLeftRadius, 'forwarded trigger part').to.equal('7px');
      expect(visibleFlags().map(flag => flag.textContent)).to.deep.equal(['🇱🇺', '🇫🇷']);
      expect(visibleFlags().every(flag => flag.getClientRects().length > 0)).to.equal(true);
      expect(visibleFlags().map(flag => getComputedStyle(flag).fontSize)).to.deep.equal(['31px', '31px']);
      expect(visibleFlags().every(flag => flag.getAttribute('aria-hidden') === 'true')).to.equal(true);
      const triggerFlag = child.querySelector<HTMLElement>(':scope > span[slot="start"] > [part="flag"]')!;
      expect(triggerFlag.getClientRects().length).to.be.greaterThan(0);
      expect(getComputedStyle(triggerFlag).fontSize).to.equal('31px');
      el.setAttribute('flags', 'false');
      await el.updateComplete;
      await waitUntil(() => visibleFlags().length === 0);
      expect(el.flags).to.equal(false);
      expect(el.shadowRoot!.querySelectorAll('[part="flag"]').length).to.equal(0);
      expect(child.open).to.equal(true);
      expect(child.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(2);
    });
  }

  it('normalizes markup, committed form data, dirty defaults, reset and restored state', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-country-picker name="country" value=" lu " required></lr-country-picker></form>`);
    const el = form.querySelector('lr-country-picker')!;
    expect(el.value).to.equal('LU');
    expect(new FormData(form).get('country')).to.equal('LU');
    el.value = ' fr ';
    expect(new FormData(form).get('country')).to.equal('FR');
    el.defaultValue = ' gb ';
    expect(el.value).to.equal('FR');
    form.reset();
    expect(el.value).to.equal('GB');
    el.formStateRestoreCallback(' lb ', 'restore');
    expect(el.value).to.equal('LB');
    el.value = 'unknown';
    expect(el.validity.customError).to.equal(true);
    el.setCustomValidity('Keep this error');
    form.reset();
    expect(el.validationMessage).to.equal('Keep this error');
  });

  it('filters country names and codes without changing the selected value or emitting selection events', async () => {
    const el = await fixture<LyraCountryPicker>(html`<lr-country-picker searchable label="Country" value="FR" .countries=${[
      { code: 'FR', group: 'Common' }, { code: 'GB', label: 'United Kingdom', group: 'All' }, { code: 'US', disabled: true },
    ]}></lr-country-picker>`);
    const child = el.shadowRoot!.querySelector<LyraCombobox<false>>('lr-combobox')!;
    await child.updateComplete;
    const events: string[] = [];
    const details: { value: string; previousValue: string }[] = [];
    for (const name of ['input', 'lr-input', 'change', 'lr-change']) el.addEventListener(name, () => events.push(name));
    el.addEventListener('lr-input', event => details.push(event.detail));
    el.addEventListener('lr-change', event => details.push(event.detail));
    const input = el.input!;
    input.value = 'king';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await waitUntil(() => child.shadowRoot!.querySelectorAll('[part~="option"]').length === 1);
    expect(child.shadowRoot!.querySelector('[part~="option"]')?.getAttribute('data-value')).to.equal('GB');
    expect(el.value).to.equal('FR');
    expect(events).to.deep.equal([]);
    const row = child.shadowRoot!.querySelector<HTMLElement>('[part~="option"]')!;
    row.click();
    expect(el.value).to.equal('GB');
    expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
    expect(details).to.deep.equal([
      { value: 'GB', previousValue: 'FR' }, { value: 'GB', previousValue: 'FR' },
    ]);
    await child.show();
    const repeated = oneEvent(el, 'lr-activate');
    child.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-value="GB"]')!.click();
    expect((await repeated).detail.value).to.equal('GB');
    expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  });

  it('uses localized naming and is accessible with populated options in a narrow RTL allocation', async () => {
    const el = await fixture<LyraCountryPicker>(html`<lr-country-picker dir="rtl" style="inline-size: 280px" .strings=${{ countryPickerLabel: 'Pays' }} .countries=${['LB', 'LU']} value="LB"></lr-country-picker>`);
    const child = el.shadowRoot!.querySelector('lr-select')!;
    await child.updateComplete;
    expect(child.getAttribute('aria-label')).to.equal('Pays');
    child.open = true;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('lr-option').length === 2);
    expect(el.shadowRoot!.querySelectorAll('lr-option').length).to.equal(2);
    expect(el.scrollWidth <= el.clientWidth).to.equal(true);
    child.open = true;
    await child.updateComplete;
    const listbox = child.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    // Axe must inspect the fully visible listbox, after its opacity transition.
    await waitUntil(() => listbox.getBoundingClientRect().height > 0 && getComputedStyle(listbox).opacity === '1');
    expect(child.shadowRoot!.querySelectorAll('[part~="option"]').length).to.equal(2);
    await expect(el).to.be.accessible();
  });
  it('badges a committed disabled country in the trigger, like the currency picker', async () => {
    const el = await fixture<LyraCountryPicker>(html`<lr-country-picker value="FR" .countries=${[{ code: 'FR', disabled: true }, 'DE']}></lr-country-picker>`);
    const badge = el.shadowRoot!.querySelector('lr-select > span[slot="end"]');
    expect(badge?.textContent?.trim()).to.equal('not in catalog');
  });

  for (const searchable of [false, true]) {
    it(`places the ${searchable ? 'searchable' : 'compact'} list with the select's absolute strategy until told otherwise`, async () => {
      const el = await fixture<LyraCountryPicker>(html`<lr-country-picker .searchable=${searchable} .countries=${['LU', 'FR']}></lr-country-picker>`);
      const child = el.shadowRoot!.querySelector<LyraSelect | LyraCombobox>(searchable ? 'lr-combobox' : 'lr-select')!;
      child.open = true;
      await child.updateComplete;
      const listbox = child.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
      await waitUntil(() => getComputedStyle(listbox).position === 'absolute', 'the default strategy never applied');
    });
  }
});

it('revalidates the selected value synchronously when replacing the catalog', async () => {
  const el = await fixture<LyraCountryPicker>(html`<lr-country-picker value="FR"></lr-country-picker>`);
  el.countries = [];
  expect(el.validity.customError).to.equal(true);
  const codes = ['FR'];
  el.countries = codes;
  codes.length = 0;
  expect(el.validity.valid).to.equal(true);
  expect(el.countries?.length).to.equal(1);
  el.countries = undefined;
  expect(el.validity.valid).to.equal(true);
});
