import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import type { LyraPhoneInput, LyraPhoneNumberAdapter } from './phone-input.js';
import './phone-input.js';

const adapter: LyraPhoneNumberAdapter = {
  countries: [{ code: 'LU', callingCode: '352' }, { code: 'FR', callingCode: '33' }],
  parse: (input) => ({ status: input === '12' ? 'incomplete' : input ? 'invalid' : 'empty', formatted: input }),
};
const mount = async () => fixture<LyraPhoneInput>(html`<lr-phone-input label="Phone" default-country="LU" .adapter=${adapter}></lr-phone-input>`);
const settle = async (el: LyraPhoneInput) => { await el.updateComplete; await aTimeout(0); await el.updateComplete; };

it('phone-input safely removes default-country without changing null readback', async () => {
  const el = await mount();
  el.setAttribute('default-country', 'FR');
  await settle(el);
  expect(el.country).to.equal('LU');
  el.removeAttribute('default-country');
  await settle(el);
  expect(el.defaultCountry).to.equal(null);
  expect(el.country).to.equal('LU');
  el.setAttribute('default-country', '');
  await settle(el);
  expect(el.defaultCountry).to.equal('');
  el.setAttribute('default-country', 'FR');
  await settle(el);
  expect(el.defaultCountry).to.equal('FR');
  el.country = '';
  await settle(el);
  expect(el.country).to.equal('FR');
});

for (const path of ['property', 'attribute'] as const) {
  it(`phone-input honors explicit country-label ${path} copy and restores localized omission`, async () => {
    const el = await mount();
    el.strings = { select: 'Choisir' };
    await settle(el);
    const country = el.shadowRoot!.querySelector('select')!;
    expect(el.countryLabel).to.equal('Select');
    expect(country.getAttribute('aria-label')).to.equal('Choisir');
    for (const text of ['Choose country', 'Select', '']) {
      if (path === 'property') el.countryLabel = text;
      else el.setAttribute('country-label', text);
      await settle(el);
      expect(country.getAttribute('aria-label')).to.equal(text);
    }
    el.setAttribute('country-label', 'Supplied');
    el.removeAttribute('country-label');
    await settle(el);
    expect(el.countryLabel).to.equal('Select');
    expect(country.getAttribute('aria-label')).to.equal('Choisir');
  });

  for (const [property, attribute, value, defaultText, key] of [
    ['incompleteText', 'incomplete-text', '12', 'This phone number is incomplete.', 'phoneInputIncomplete'],
    ['invalidText', 'invalid-text', 'invalid', 'The value is invalid.', 'valueInvalid'],
  ] as const) {
    it(`phone-input honors explicit ${attribute} ${path} messages while retaining native invalidity`, async () => {
      const el = await mount();
      el.strings = { [key]: 'Localized reason' };
      await settle(el);
      const input = el.input!;
      const edit = () => {
        input.value = value;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      };
      expect(el[property]).to.equal(defaultText);
      edit();
      expect(el.validationMessage).to.equal('Localized reason');
      for (const text of ['Caller reason', defaultText, '']) {
        if (path === 'property') el[property] = text;
        else el.setAttribute(attribute, text);
        await settle(el);
        edit();
        expect(el.validationMessage).to.equal(text || 'Localized reason');
        expect(el.validity.valid).to.equal(false);
        expect(el.validity[property === 'incompleteText' ? 'badInput' : 'typeMismatch']).to.equal(true);
      }
      el.setAttribute(attribute, 'Supplied');
      el.removeAttribute(attribute);
      await settle(el);
      edit();
      expect(el[property]).to.equal(defaultText);
      expect(el.validationMessage).to.equal('Localized reason');
    });
  }
}
