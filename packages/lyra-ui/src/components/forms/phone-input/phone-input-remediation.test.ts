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
    el.strings = { countryPickerLabel: 'Choisir' };
    await settle(el);
    const country = el.shadowRoot!.querySelector('select')!;
    expect(el.countryLabel).to.equal('Country');
    expect(country.getAttribute('aria-label')).to.equal('Choisir');
    for (const text of ['Choose country', 'Country', '']) {
      if (path === 'property') el.countryLabel = text;
      else el.setAttribute('country-label', text);
      await settle(el);
      expect(country.getAttribute('aria-label')).to.equal(text);
    }
    el.setAttribute('country-label', 'Supplied');
    el.removeAttribute('country-label');
    await settle(el);
    expect(el.countryLabel).to.equal('Country');
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

it('phone-input formats each country name once per catalog and locale, not on every keystroke', async () => {
  const countries = Array.from({ length: 200 }, (_, index) => ({
    code: String.fromCharCode(65 + Math.floor(index / 26), 65 + (index % 26)),
    callingCode: String(1 + (index % 900)),
  }));
  const el = await fixture<LyraPhoneInput>(html`<lr-phone-input .countries=${countries}></lr-phone-input>`);
  await settle(el);
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
  const original = Intl.DisplayNames.prototype.of;
  let calls = 0;
  Intl.DisplayNames.prototype.of = function (...args: Parameters<typeof original>) {
    calls += 1;
    return original.apply(this, args);
  };
  try {
    for (const text of ['5', '55', '555']) {
      input.value = text;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      await el.updateComplete;
    }
  } finally {
    Intl.DisplayNames.prototype.of = original;
  }
  expect(el.inputValue).to.equal('555');
  expect(el.shadowRoot!.querySelectorAll('[part="country-select"] option').length).to.equal(200);
  expect(calls, 'Intl.DisplayNames#of calls across three keystrokes').to.equal(0);
});

describe('phone-input IME composition', () => {
  // Formats full-width digits to ASCII, the way a real adapter normalizes IME output.
  const formatting: LyraPhoneNumberAdapter = {
    countries: [{ code: 'JP', callingCode: '81' }],
    parse: (input) => ({ status: input ? 'incomplete' : 'empty', formatted: input.normalize('NFKC') }),
  };
  const compose = (input: HTMLInputElement, text: string) => {
    input.value = text;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, isComposing: true, data: text }));
  };

  for (const finalInput of ['none', 'after', 'before'] as const) {
    it(`leaves composing text alone and commits once at the end of composition (final input: ${finalInput})`, async () => {
      const el = await fixture<LyraPhoneInput>(html`<lr-phone-input .adapter=${formatting}></lr-phone-input>`);
      await settle(el);
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
      const lrInputs: string[] = [];
      el.addEventListener('lr-input', (event) => lrInputs.push((event as CustomEvent<{ inputValue: string }>).detail.inputValue));
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, composed: true }));
      compose(input, '０');
      compose(input, '０９');
      expect(input.value, 'the composing text is not rewritten').to.equal('０９');
      expect(lrInputs).to.deep.equal([]);
      const final = () => input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: '０９' }));
      if (finalInput === 'before') final();
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '０９' }));
      if (finalInput === 'after') final();
      await el.updateComplete;
      expect(input.value).to.equal('09');
      expect(el.inputValue).to.equal('09');
      expect(lrInputs).to.deep.equal(['09']);
    });
  }
});

it('phone-input renders label, hint and error text before their slotted content and describes error before hint', async () => {
  const el = await fixture<LyraPhoneInput>(html`
    <lr-phone-input label="Phone" hint="Mobile preferred" error-text="Required for delivery" .adapter=${adapter}>
      <span slot="label">(work)</span>
      <span slot="hint">We never call after 8pm.</span>
      <span slot="error">See the policy.</span>
    </lr-phone-input>
  `);
  await settle(el);
  const part = (name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
  const shown = (name: string) => {
    const slot = part(name).querySelector('slot') as HTMLSlotElement;
    return `${part(name).textContent!.trim()}|${slot.assignedElements().map((node) => node.textContent).join('')}`;
  };
  expect([shown('form-control-label'), shown('hint'), shown('error')]).to.deep.equal([
    'Phone|(work)',
    'Mobile preferred|We never call after 8pm.',
    'Required for delivery|See the policy.',
  ]);
  expect(el.input!.getAttribute('aria-describedby')!.split(/\s+/)).to.deep.equal([part('error').id, part('hint').id]);
});

it('phone-input honors the with-label and with-hint SSR presence hints', async () => {
  const el = await fixture<LyraPhoneInput>(html`<lr-phone-input with-label with-hint></lr-phone-input>`);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="form-control-label"]')!.hasAttribute('hidden')).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="hint"]')!.hasAttribute('hidden')).to.equal(false);
});

it('phone-input leaves validation text to error-text, keeps the resting border, and never writes host aria-invalid', async () => {
  const el = await fixture<LyraPhoneInput>(html`<lr-phone-input required label="Phone" .adapter=${adapter}></lr-phone-input>`);
  await settle(el);
  const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[part="input-wrapper"]')!;
  const resting = getComputedStyle(wrapper).borderTopColor;
  el.reportValidity();
  await settle(el);
  expect(el.hasAttribute('data-invalid')).to.equal(true);
  expect(el.hasAttribute('aria-invalid'), 'the telephone input owns aria-invalid').to.equal(false);
  expect(el.input!.getAttribute('aria-invalid')).to.equal('true');
  expect(el.shadowRoot!.querySelector('[part="error"]')!.hasAttribute('hidden'), 'no automatic message').to.equal(true);
  expect(getComputedStyle(wrapper).borderTopColor, 'no default danger edge').to.equal(resting);
});
