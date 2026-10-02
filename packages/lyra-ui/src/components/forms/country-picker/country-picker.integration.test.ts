import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resolveValidityAnchor } from '../../../internal/anchored-validity.js';
import type { LyraCountryPicker } from './country-picker.class.js';
import type { LyraCombobox } from '../combobox/combobox.class.js';
import type { LyraSelect } from '../select/select.class.js';
import './country-picker.js';

function control(el: LyraCountryPicker): LyraCombobox<false> | LyraSelect<false> {
  return el.shadowRoot!.querySelector<LyraCombobox<false> | LyraSelect<false>>('lr-combobox,lr-select')!;
}
async function settle(el: LyraCountryPicker): Promise<void> {
  await el.updateComplete;
  await control(el).updateComplete;
  await el.updateComplete;
  await control(el).updateComplete;
}
async function filter(el: LyraCountryPicker, text: string): Promise<void> {
  el.input!.value = text;
  el.input!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  await settle(el);
}

describe('international picker form and filtering integration', () => {
  it('removes a null reset default without erasing a dirty committed value', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-country-picker name="country" value="FR" .countries=${['FR', 'GB']}></lr-country-picker></form>`);
    const el = form.querySelector('lr-country-picker')!;
    el.value = 'GB';
    el.defaultValue = null;
    await settle(el);
    expect(el.hasAttribute('value')).to.equal(false);
    expect(el.defaultValue).to.equal('');
    expect(el.value).to.equal('GB');
    expect(new FormData(form).get('country')).to.equal('GB');
    form.reset();
    expect(el.value).to.equal('');
    expect(new FormData(form).get('country')).to.equal('');
  });

  it('keeps an empty searchable field empty, filters without committing and commits by keyboard', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-country-picker name="country" searchable required label="Country" .countries=${['FR', 'GB', 'US']}></lr-country-picker></form>`);
    const el = form.querySelector('lr-country-picker')!;
    await settle(el);
    expect(el.input!.value).to.equal('');
    expect(new FormData(form).getAll('country')).to.deep.equal(['']);
    expect(el.validity.valueMissing).to.equal(true);
    await focusByKeyboard(el);
    await sendKeys({ type: 'kingdom' });
    await settle(el);
    expect(el.value).to.equal('');
    expect(new FormData(form).getAll('country')).to.deep.equal(['']);
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'Enter' });
    expect(el.value).to.equal('GB');
    expect(new FormData(form).getAll('country')).to.deep.equal(['GB']);
  });

  it('contains unmatched query edits and localizes no-match guidance', async () => {
    const el = await fixture<LyraCountryPicker>(html`<lr-country-picker searchable label="Country" .countries=${['FR']} .strings=${{ noMatches: 'Aucun résultat' }} value="FR"></lr-country-picker>`);
    await settle(el);
    const names: string[] = [];
    for (const name of ['input', 'lr-input', 'lr-filter', 'change', 'lr-change']) el.addEventListener(name, () => names.push(name));
    await filter(el, 'no-such-country');
    expect(control(el).shadowRoot!.textContent).to.contain('Aucun résultat');
    expect(el.value).to.equal('FR');
    expect(names).to.deep.equal([]);
    await focusByKeyboard(el);
    await sendKeys({ press: 'Enter' });
    expect(el.value).to.equal('FR');
  });

  it('resets and reconnects without preserving an unfinished filter or changing the reset default', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-country-picker searchable label="Country" value="FR" .countries=${['FR', 'GB']}></lr-country-picker></form>`);
    const el = form.querySelector('lr-country-picker')!;
    await settle(el);
    await filter(el, 'kingdom');
    form.reset();
    await settle(el);
    expect(el.value).to.equal('FR');
    expect(control(el).open).to.equal(false);
    expect(el.input!.value).to.equal('France');
    await filter(el, 'kingdom');
    el.remove();
    form.append(el);
    await settle(el);
    expect(control(el).open).to.equal(false);
    expect(el.value).to.equal('FR');
    expect(el.input!.value).to.equal('France');
  });

  it('changes search mode without changing value/default/error or allowing an old child commit', async () => {
    const el = await fixture<LyraCountryPicker>(html`<lr-country-picker searchable label="Country" value="FR" .countries=${['FR', 'GB']}></lr-country-picker>`);
    await settle(el);
    const old = control(el);
    el.setCustomValidity('App error');
    await filter(el, 'kingdom');
    el.searchable = false;
    await settle(el);
    expect(el.input === null).to.equal(true);
    expect(el.value).to.equal('FR');
    expect(el.defaultValue).to.equal('FR');
    expect(el.validationMessage).to.equal('App error');
    old.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: { value: 'GB' } }));
    expect(el.value).to.equal('FR');
    el.searchable = true;
    await settle(el);
    expect(el.input!.value).to.equal('France');
  });

  it('forwards naming, descriptions and editing assistance through the composed field', async () => {
    const container = await fixture<HTMLDivElement>(html`<div><span id="country-label">Destination country</span><span id="country-note">For delivery</span>
      <lr-country-picker searchable aria-labelledby="country-label" aria-describedby="country-note" autocomplete="off" inputmode="search" enterkeyhint="search" spellcheck="true" autocapitalize="words" autocorrect="off" .countries=${['FR', 'GB']}></lr-country-picker></div>`);
    const el = container.querySelector('lr-country-picker')!;
    await settle(el);
    const anchor = resolveValidityAnchor(el)!;
    expect(anchor.localName).to.equal('input');
    expect(anchor.ariaLabelledByElements?.map((element) => element.textContent)).to.include('Destination country');
    expect(anchor.ariaDescribedByElements?.map((element) => element.textContent)).to.include('For delivery');
    expect(el.input!.getAttribute('inputmode')).to.equal('search');
    expect(el.input!.getAttribute('enterkeyhint')).to.equal('search');
    expect(el.input!.getAttribute('spellcheck')).to.equal('true');
    expect(el.input!.getAttribute('autocapitalize')).to.equal('words');
    expect(el.input!.getAttribute('autocorrect')).to.equal('off');
    el.accessibleLabel = 'Preferred country';
    await settle(el);
    expect(anchor.getAttribute('aria-label')).to.equal('Preferred country');
    expect(anchor.ariaDescribedByElements?.map((element) => element.textContent)).to.include('For delivery');
    await expect(el).to.be.accessible();
  });

  it('honors disabled fieldsets synchronously and projects one outer form owner', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><fieldset><lr-country-picker searchable name="country" label="Country" value="FR" .countries=${['FR', 'GB']}></lr-country-picker></fieldset></form>`);
    const el = form.querySelector('lr-country-picker')!;
    await settle(el);
    expect(new FormData(form).getAll('country')).to.deep.equal(['FR']);
    form.querySelector('fieldset')!.disabled = true;
    control(el).dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true, detail: { value: 'GB' } }));
    expect(el.value).to.equal('FR');
    expect(new FormData(form).getAll('country')).to.deep.equal([]);
    await settle(el);
    el.click();
    expect(control(el).open).to.equal(false);
    form.querySelector('fieldset')!.disabled = false;
    await waitUntil(() => !el.effectiveDisabled);
    expect(new FormData(form).getAll('country')).to.deep.equal(['FR']);
  });
});
