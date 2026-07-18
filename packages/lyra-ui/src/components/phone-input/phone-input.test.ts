import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import {
  type LyraPhoneInput,
  type PhoneNumberAdapter,
  loadLibphonenumberAdapter,
} from './phone-input.js';
import './phone-input.js';

const adapter: PhoneNumberAdapter = {
  countries: [
    { code: 'LU', callingCode: '352' },
    { code: 'FR', callingCode: '33' },
  ],
  parse(input, country) {
    const digits = input.replace(/\D/g, '');
    if (!digits) return { status: 'empty' };
    if (digits.length < 6) return { status: 'incomplete', formatted: input };
    if (digits.endsWith('000000')) return { status: 'invalid', formatted: input };
    const callingCode = country === 'FR' ? '33' : '352';
    const national = digits.replace(new RegExp(`^${callingCode}`), '').replace(/^0/, '');
    return {
      status: 'valid',
      e164: `+${callingCode}${national}`,
      country,
      formatted: national.replace(/(\d{3})(?=\d)/g, '$1 '),
    };
  },
};

it('normalizes live user input to an E.164 form value through an injected adapter', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-phone-input
        name="phone"
        label="Phone number"
        default-country="LU"
        .adapter=${adapter}
      ></lyra-phone-input>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-phone-input') as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;
  const eventPromise = oneEvent(el, 'input');

  input.value = '621123456';
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  const event = (await eventPromise) as CustomEvent;

  expect(el.value).to.equal('+352621123456');
  expect(new FormData(form).get('phone')).to.equal('+352621123456');
  expect(input.value).to.equal('621 123 456');
  expect(event.detail).to.deep.include({
    value: '+352621123456',
    inputValue: '621 123 456',
    country: 'LU',
    valid: true,
  });
});

it('keeps an incomplete number editable while excluding it from the canonical form value', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-phone-input
        name="phone"
        label="Phone number"
        default-country="LU"
        .adapter=${adapter}
      ></lyra-phone-input>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-phone-input') as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  input.value = '621';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await el.updateComplete;

  expect(input.value).to.equal('621');
  expect(el.inputValue).to.equal('621');
  expect(el.value).to.equal('');
  expect(new FormData(form).get('phone')).to.equal('');
  expect(el.phoneStatus).to.equal('incomplete');
  expect(el.internals.validity.badInput).to.be.true;
});

it('distinguishes incomplete and invalid committed numbers in validity state', async () => {
  const el = (await fixture(html`
    <lyra-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  input.value = '123';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el.internals.validity.badInput).to.be.true;
  expect(el.internals.validity.typeMismatch).to.be.false;

  input.value = '000000';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el.internals.validity.badInput).to.be.false;
  expect(el.internals.validity.typeMismatch).to.be.true;
});

it('gives incomplete and invalid numbers distinct validation messages', async () => {
  const el = (await fixture(html`
    <lyra-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  input.value = '123';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el.internals.validationMessage).to.equal('This phone number is incomplete.');

  input.value = '000000';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el.internals.validationMessage).to.equal('The value is invalid.');
});

it('supports international E.164 values without an adapter as a graceful fallback', async () => {
  const el = (await fixture(html`
    <lyra-phone-input label="Phone number" value="+352 621 123 456"></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;

  expect(el.value).to.equal('+352621123456');
  expect(el.input!.value).to.equal('+352 621 123 456');
  expect(el.checkValidity()).to.be.true;
});

it('keeps programmatic value changes silent', async () => {
  const el = (await fixture(html`
    <lyra-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lyra-phone-input>
  `)) as LyraPhoneInput;
  let inputEvents = 0;
  let changeEvents = 0;
  el.addEventListener('input', () => inputEvents++);
  el.addEventListener('change', () => changeEvents++);

  el.value = '+352621123456';
  await el.updateComplete;

  expect(inputEvents).to.equal(0);
  expect(changeEvents).to.equal(0);
  expect(el.value).to.equal('+352621123456');
});

it('renders localized country names and updates the selected country', async () => {
  const el = (await fixture(html`
    <lyra-phone-input
      label="Téléphone"
      locale="fr"
      default-country="LU"
      .adapter=${adapter}
    ></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;
  const optionText = [...select.options].map((option) => option.textContent);
  expect(el.country).to.equal('LU');
  expect(optionText).to.include(`${new Intl.DisplayNames(['fr'], { type: 'region' }).of('FR')} (+33)`);

  select.value = 'FR';
  const eventPromise = oneEvent(el, 'change');
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await eventPromise;
  expect(el.country).to.equal('FR');
});

it('projects label, hint, and error chrome and names the actual native controls', async () => {
  const el = (await fixture(html`
    <lyra-phone-input
      label="Mobile"
      hint="Include the area code"
      error-text="That number cannot be used"
      country-label="Calling country"
    ></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;
  const descriptionIds = input.getAttribute('aria-describedby')!.split(' ');

  expect(input.getAttribute('aria-label')).to.equal('Mobile');
  expect(select.getAttribute('aria-label')).to.equal('Calling country');
  expect(descriptionIds).to.include(el.shadowRoot!.querySelector('[part="hint"]')!.id);
  expect(descriptionIds).to.include(el.shadowRoot!.querySelector('[part="error"]')!.id);
});

it('allows a host aria-label to name the internal telephone input', async () => {
  const el = (await fixture(html`
    <lyra-phone-input aria-label="Account mobile" .adapter=${adapter}></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  expect(el.input!.getAttribute('aria-label')).to.equal('Account mobile');
});

it('gives a host aria-label precedence over phone-label, label, and placeholder defaults', async () => {
  const el = (await fixture(html`
    <lyra-phone-input
      aria-label="Account mobile"
      phone-label="Telephone"
      label="Mobile"
      placeholder="621 123 456"
      .adapter=${adapter}
    ></lyra-phone-input>
  `)) as LyraPhoneInput;

  expect(el.input!.getAttribute('aria-label')).to.equal('Account mobile');
});

it('exposes selection and range-editing APIs while keeping editable and form values synchronized', async () => {
  const form = (await fixture(html`
    <form><lyra-phone-input name="phone" value="+352621123456"></lyra-phone-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-phone-input') as LyraPhoneInput;

  el.setSelectionRange(4, 7, 'forward');
  expect(el.selectionStart).to.equal(4);
  expect(el.selectionEnd).to.equal(7);
  expect(el.selectionDirection).to.equal('forward');

  el.selectionStart = 1;
  el.selectionEnd = 4;
  expect(el.input!.selectionStart).to.equal(1);
  expect(el.input!.selectionEnd).to.equal(4);

  el.setRangeText('+33123456789', 0, el.inputValue.length, 'end');
  expect(el.inputValue).to.equal('+33123456789');
  expect(el.value).to.equal('+33123456789');
  expect(new FormData(form).get('phone')).to.equal('+33123456789');

  el.select();
  expect(el.selectionStart).to.equal(0);
  expect(el.selectionEnd).to.equal(el.inputValue.length);
});

it('keeps the caret at the same digit offset across a mid-string edit instead of jumping to the end', async () => {
  const el = (await fixture(html`
    <lyra-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  input.value = '621123456';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await el.updateComplete;
  expect(input.value).to.equal('621 123 456');

  // Insert a digit between the 4th and 5th characters of "123" ("621 1|23 456"),
  // exactly as the browser would after a real keystroke: the new character is
  // already present in `.value` and the caret already sits right after it.
  input.value = '621 1' + '9' + '23 456';
  input.setSelectionRange(6, 6);
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await el.updateComplete;

  // Reformatted around the new digit ("6211923456" grouped in 3s) rather than
  // left as the raw un-formatted string.
  expect(input.value).to.equal('621 192 345 6');
  // The 5th digit typed so far was the inserted "9" -- the caret must land
  // right after it in the reformatted string, not at the string's end.
  expect(input.selectionStart).to.equal(6);
  expect(input.selectionEnd).to.equal(6);
});

it('leaves a same-string reformat (the no-adapter fallback path) untouched, including the caret', async () => {
  const el = (await fixture(html`
    <lyra-phone-input label="Phone number"></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  input.value = '+352 621 123';
  input.setSelectionRange(6, 6);
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await el.updateComplete;

  expect(input.value).to.equal('+352 621 123');
  expect(input.selectionStart).to.equal(6);
});

it('bridges focus and blur from the shadow input to host-observable events', async () => {
  const el = (await fixture(html`
    <lyra-phone-input label="Phone number" .adapter=${adapter}></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;

  const focusPromise = oneEvent(el, 'focus');
  el.input!.dispatchEvent(new FocusEvent('focus'));
  await focusPromise;

  const blurPromise = oneEvent(el, 'blur');
  el.input!.dispatchEvent(new FocusEvent('blur'));
  await blurPromise;
});

it('participates in required validation, disabled fieldsets, and form reset', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lyra-phone-input
          name="phone"
          label="Phone number"
          required
          value="+352621123456"
          default-country="LU"
          .adapter=${adapter}
        ></lyra-phone-input>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const fieldset = form.querySelector('fieldset')!;
  const el = form.querySelector('lyra-phone-input') as LyraPhoneInput;
  await el.updateComplete;

  el.input!.value = '';
  el.input!.dispatchEvent(new InputEvent('input', { bubbles: true }));
  expect(form.checkValidity()).to.be.false;

  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('+352621123456');

  fieldset.disabled = true;
  await el.updateComplete;
  expect(el.input!.disabled).to.be.true;
});

it('anchors native validation feedback on the telephone input rather than the country selector', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before</button>
      <lyra-phone-input
        name="phone"
        label="Phone number"
        required
        default-country="LU"
        .adapter=${adapter}
      ></lyra-phone-input>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button')!;
  const el = form.querySelector('lyra-phone-input') as LyraPhoneInput;
  await el.updateComplete;
  sentinel.focus();

  expect(el.reportValidity()).to.be.false;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('input');
});

it('loads a libphonenumber-compatible module only when explicitly requested', async () => {
  let loads = 0;
  const loaded = await loadLibphonenumberAdapter(async () => {
    loads += 1;
    return {
      getCountries: () => ['LU'],
      getCountryCallingCode: () => '352',
      parsePhoneNumberFromString: () => ({
        number: '+352621123456',
        country: 'LU',
        isValid: () => true,
        isPossible: () => true,
        formatNational: () => '621 123 456',
        formatInternational: () => '+352 621 123 456',
      }),
    };
  });

  expect(loads).to.equal(1);
  expect(loaded.countries).to.deep.equal([{ code: 'LU', callingCode: '352' }]);
  expect(loaded.parse('621123456', 'LU')).to.deep.include({
    status: 'valid',
    e164: '+352621123456',
    country: 'LU',
  });
});

it('adapts the real libphonenumber-js package, not just a hand-written fake shape', async () => {
  const loaded = await loadLibphonenumberAdapter(() => import('libphonenumber-js/min'));

  expect(loaded.countries.length).to.be.greaterThan(100);
  expect(loaded.countries).to.deep.include({ code: 'LU', callingCode: '352' });
  expect(loaded.parse('621123456', 'LU')).to.deep.include({
    status: 'valid',
    e164: '+352621123456',
    country: 'LU',
  });
  expect(loaded.parse('123', 'LU').status).to.equal('incomplete');
});

it('spellcheck defaults to true on the internal telephone input', async () => {
  const el = (await fixture(html`<lyra-phone-input></lyra-phone-input>`)) as LyraPhoneInput;
  await el.updateComplete;
  expect(el.input!.spellcheck).to.be.true;
});

it('forwards spellcheck=false, autocapitalize, and autocorrect onto the internal telephone input', async () => {
  const el = (await fixture(html`
    <lyra-phone-input spellcheck="false" autocapitalize="off" autocorrect="off"></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;
  expect(input.spellcheck).to.be.false;
  expect(input.getAttribute('autocapitalize')).to.equal('off');
  expect(input.getAttribute('autocorrect')).to.equal('off');
});

it('uses string overrides for the country-select label and both validation messages', async () => {
  const el = (await fixture(html`
    <lyra-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lyra-phone-input>
  `)) as LyraPhoneInput;
  el.strings = {
    select: 'Choisir',
    phoneInputIncomplete: 'Numéro incomplet.',
    valueInvalid: 'Numéro invalide.',
  };
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;
  const input = el.input!;

  expect(select.getAttribute('aria-label')).to.equal('Choisir');

  input.value = '123';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el.internals.validationMessage).to.equal('Numéro incomplet.');

  input.value = '000000';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el.internals.validationMessage).to.equal('Numéro invalide.');
});

it('passes non-default country-label, incomplete-text, and invalid-text attributes through verbatim', async () => {
  // A consumer-supplied non-default value must pass through verbatim -- the localize()
  // fallback is only reached while each property still holds its documented default.
  const el = (await fixture(html`
    <lyra-phone-input
      label="Phone number"
      default-country="LU"
      country-label="Calling country"
      incomplete-text="Keep typing"
      invalid-text="Not a number"
      .adapter=${adapter}
    ></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;
  const input = el.input!;

  expect(select.getAttribute('aria-label')).to.equal('Calling country');

  input.value = '123';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el.internals.validationMessage).to.equal('Keep typing');

  input.value = '000000';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el.internals.validationMessage).to.equal('Not a number');
});

it('is accessible', async () => {
  const el = (await fixture(html`
    <lyra-phone-input
      label="Phone number"
      hint="Include the country code"
      default-country="LU"
      .adapter=${adapter}
    ></lyra-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
