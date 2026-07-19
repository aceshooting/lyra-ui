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
      <lr-phone-input
        name="phone"
        label="Phone number"
        default-country="LU"
        .adapter=${adapter}
      ></lr-phone-input>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
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
      <lr-phone-input
        name="phone"
        label="Phone number"
        default-country="LU"
        .adapter=${adapter}
      ></lr-phone-input>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
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
    <lr-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
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
    <lr-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
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
    <lr-phone-input label="Phone number" value="+352 621 123 456"></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;

  expect(el.value).to.equal('+352621123456');
  expect(el.input!.value).to.equal('+352 621 123 456');
  expect(el.checkValidity()).to.be.true;
});

it('keeps programmatic value changes silent', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
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
    <lr-phone-input
      label="Téléphone"
      locale="fr"
      default-country="LU"
      .adapter=${adapter}
    ></lr-phone-input>
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
    <lr-phone-input
      label="Mobile"
      hint="Include the area code"
      error-text="That number cannot be used"
      country-label="Calling country"
    ></lr-phone-input>
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
    <lr-phone-input aria-label="Account mobile" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  expect(el.input!.getAttribute('aria-label')).to.equal('Account mobile');
});

it('gives a host aria-label precedence over phone-label, label, and placeholder defaults', async () => {
  const el = (await fixture(html`
    <lr-phone-input
      aria-label="Account mobile"
      phone-label="Telephone"
      label="Mobile"
      placeholder="621 123 456"
      .adapter=${adapter}
    ></lr-phone-input>
  `)) as LyraPhoneInput;

  expect(el.input!.getAttribute('aria-label')).to.equal('Account mobile');
});

it('exposes selection and range-editing APIs while keeping editable and form values synchronized', async () => {
  const form = (await fixture(html`
    <form><lr-phone-input name="phone" value="+352621123456"></lr-phone-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;

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
    <lr-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
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
    <lr-phone-input label="Phone number"></lr-phone-input>
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
    <lr-phone-input label="Phone number" .adapter=${adapter}></lr-phone-input>
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
        <lr-phone-input
          name="phone"
          label="Phone number"
          required
          value="+352621123456"
          default-country="LU"
          .adapter=${adapter}
        ></lr-phone-input>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const fieldset = form.querySelector('fieldset')!;
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
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
      <lr-phone-input
        name="phone"
        label="Phone number"
        required
        default-country="LU"
        .adapter=${adapter}
      ></lr-phone-input>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button')!;
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
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
  const el = (await fixture(html`<lr-phone-input></lr-phone-input>`)) as LyraPhoneInput;
  await el.updateComplete;
  expect(el.input!.spellcheck).to.be.true;
});

it('forwards spellcheck=false, autocapitalize, and autocorrect onto the internal telephone input', async () => {
  const el = (await fixture(html`
    <lr-phone-input spellcheck="false" autocapitalize="off" autocorrect="off"></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;
  expect(input.spellcheck).to.be.false;
  expect(input.getAttribute('autocapitalize')).to.equal('off');
  expect(input.getAttribute('autocorrect')).to.equal('off');
});

it('uses string overrides for the country-select label and both validation messages', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
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
    <lr-phone-input
      label="Phone number"
      default-country="LU"
      country-label="Calling country"
      incomplete-text="Keep typing"
      invalid-text="Not a number"
      .adapter=${adapter}
    ></lr-phone-input>
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
    <lr-phone-input
      label="Phone number"
      hint="Include the country code"
      default-country="LU"
      .adapter=${adapter}
    ></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('treats an empty string as empty and infers a missing phone from length or dial-like punctuation, via a fake libphonenumber-compatible module', async () => {
  const loaded = await loadLibphonenumberAdapter(async () => ({
    getCountries: () => ['LU'],
    getCountryCallingCode: () => '352',
    parsePhoneNumberFromString: () => undefined,
    validatePhoneNumberLength: (input: string) => (input === '619' ? 'TOO_SHORT' : undefined),
  }));

  expect(loaded.parse('')).to.deep.equal({ status: 'empty' });
  // No country argument at all -- exercises the country-less lookup path.
  expect(loaded.parse('619')).to.deep.include({ status: 'incomplete', formatted: '619' });
  // Dial-like punctuation with no length verdict still reads as incomplete.
  expect(loaded.parse('+1')).to.deep.include({ status: 'incomplete', formatted: '+1' });
  // Letters are neither TOO_SHORT nor dial-like, so the input reads as invalid.
  expect(loaded.parse('abc')).to.deep.include({ status: 'invalid', formatted: 'abc' });
});

it('formats a "+"-prefixed match internationally, falls back to the passed-in country when libphonenumber omits one, and separates TOO_SHORT/impossible/plain-invalid outcomes', async () => {
  const phones: Record<
    string,
    { number: string; country?: string; valid: boolean; possible: boolean; national: string; international: string }
  > = {
    '+352621123456': {
      number: '+352621123456',
      valid: true,
      possible: true,
      national: '621 123 456',
      international: '+352 621 123 456',
    },
    '000111': { number: '+352000111', valid: false, possible: true, national: '000 111', international: '+352 000 111' },
    '222333': {
      number: '+352222333',
      country: 'FR',
      valid: false,
      possible: false,
      national: '222 333',
      international: '+352 222 333',
    },
    '444555': {
      number: '+352444555',
      country: 'FR',
      valid: false,
      possible: true,
      national: '444 555',
      international: '+352 444 555',
    },
  };
  const lengths: Record<string, string | undefined> = { '000111': 'TOO_SHORT', '444555': 'TOO_LONG' };

  const loaded = await loadLibphonenumberAdapter(async () => ({
    getCountries: () => ['LU'],
    getCountryCallingCode: () => '352',
    parsePhoneNumberFromString: (input: string) => {
      const p = phones[input];
      if (!p) return undefined;
      return {
        number: p.number,
        country: p.country,
        isValid: () => p.valid,
        isPossible: () => p.possible,
        formatNational: () => p.national,
        formatInternational: () => p.international,
      };
    },
    validatePhoneNumberLength: (input: string) => lengths[input],
  }));

  // "+"-prefixed valid input formats internationally and, lacking its own
  // country, falls back to the country that was passed in.
  expect(loaded.parse('+352621123456', 'LU')).to.deep.include({
    status: 'valid',
    formatted: '+352 621 123 456',
    country: 'LU',
  });
  // A TOO_SHORT length verdict wins over isPossible(), and the missing
  // country again falls back to the one passed in.
  expect(loaded.parse('000111', 'LU')).to.deep.include({ status: 'incomplete', country: 'LU' });
  // No length verdict and an impossible number reads as incomplete; the
  // parsed phone's own country takes precedence over the one passed in.
  expect(loaded.parse('222333', 'LU')).to.deep.include({ status: 'incomplete', country: 'FR' });
  // A length verdict that isn't TOO_SHORT overrides isPossible() and reads
  // as invalid outright.
  expect(loaded.parse('444555', 'LU')).to.deep.include({ status: 'invalid', country: 'FR' });
});

it('falls back to dial-like/letters heuristics for status when no adapter is supplied', async () => {
  const el = (await fixture(html`<lr-phone-input label="Phone number"></lr-phone-input>`)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  input.value = '621 123 456';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  expect(el.phoneStatus).to.equal('incomplete');

  input.value = 'call me';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  expect(el.phoneStatus).to.equal('invalid');

  input.value = '';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  expect(el.phoneStatus).to.equal('empty');
  expect(el.value).to.equal('');
});

it("lands the caret at the reformatted string's end when the reformat removes more digits than the caret had counted", async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  // All 12 digits are before the caret, but the adapter strips the 3-digit
  // calling-code prefix, so the reformatted string only has 9 digits left --
  // `indexAfterDigits` runs out of digits to count and falls back to the
  // string's end.
  input.value = '352621123456';
  input.setSelectionRange(12, 12);
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await el.updateComplete;

  expect(input.value).to.equal('621 123 456');
  expect(input.selectionStart).to.equal(11);
});

it('keeps the caret at the very start when no digits precede it, even after a reformat', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  input.value = '621123456';
  input.setSelectionRange(0, 0);
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await el.updateComplete;

  expect(input.value).to.equal('621 123 456');
  expect(input.selectionStart).to.equal(0);
});

it('lets an explicit countries list take precedence over the adapter, applies custom labels, and skips malformed or duplicate codes', async () => {
  const el = (await fixture(html`
    <lr-phone-input
      label="Phone number"
      .adapter=${adapter}
      .countries=${[
        { code: 'lu', callingCode: '352', label: 'Luxembourg (custom)' },
        { code: 'LU', callingCode: '352' },
        { code: 'usa', callingCode: '1' },
        { code: 'FR', callingCode: '33' },
      ]}
    ></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;
  const optionValues = [...select.options].map((option) => option.value);
  const optionText = [...select.options].map((option) => option.textContent);

  // The adapter's own [LU, FR] list would have rendered plain "Luxembourg"
  // for LU -- seeing the custom label proves `.countries` won the tie, not
  // `.adapter.countries`.
  expect(optionText).to.include('Luxembourg (custom) (+352)');
  // Normalizes to uppercase, then drops the exact duplicate and the
  // 3-letter code that fails the 2-letter region format.
  expect(optionValues).to.deep.equal(['LU', 'FR']);
});

it('synthesizes a single country row from default-country when no countries or adapter are supplied', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" default-country="LU"></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;

  expect(select.options.length).to.equal(1);
  expect(select.options[0]!.value).to.equal('LU');
  // The synthesized row has no calling code, so the "+NN" prefix span is
  // omitted entirely rather than rendering an empty "+".
  expect(el.shadowRoot!.querySelector('[part="calling-code"]')).to.not.exist;
});

it('falls back to the raw code when Intl.DisplayNames rejects a malformed synthesized country code', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" default-country="LUX"></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;

  // "LUX" isn't a well-formed 2-letter region subtag, so
  // `Intl.DisplayNames.prototype.of` throws and `countryName()` falls back
  // to the raw (synthesized, unfiltered) code.
  expect(select.options[0]!.textContent).to.include('LUX');
});

it('falls back to the raw code if Intl.DisplayNames.prototype.of ever returns a nullish value', async () => {
  const original = Intl.DisplayNames.prototype.of;
  Intl.DisplayNames.prototype.of = function (this: Intl.DisplayNames, code: string) {
    return code === 'LU' ? (undefined as unknown as string) : original.call(this, code);
  };
  try {
    const el = (await fixture(html`
      <lr-phone-input label="Phone number" default-country="LU"></lr-phone-input>
    `)) as LyraPhoneInput;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;

    // `getDisplayNames(...).of('LU')` was stubbed to return `undefined`; the
    // `?? row.code` fallback in `countryName()` must still resolve to 'LU'
    // rather than rendering "undefined".
    expect(select.options[0]!.textContent).to.equal('LU');
  } finally {
    Intl.DisplayNames.prototype.of = original;
  }
});

it('normalizes a nullish country assignment to the empty string instead of throwing', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;

  el.country = 'FR';
  expect(el.country).to.equal('FR');

  el.country = null as unknown as string;
  await el.updateComplete;
  // With the explicit assignment cleared back to nullish, `country` falls
  // through to `default-country` again.
  expect(el.country).to.equal('LU');
});

it('normalizes a nullish value assignment to the empty string instead of throwing', async () => {
  const el = (await fixture(html`<lr-phone-input label="Phone number"></lr-phone-input>`)) as LyraPhoneInput;

  el.value = null as unknown as string;
  await el.updateComplete;

  expect(el.value).to.equal('');
  expect(el.phoneStatus).to.equal('empty');
});

it('coerces an adapter result claiming "valid" status without a proper E.164 value into invalid', async () => {
  const badAdapter: PhoneNumberAdapter = {
    parse: (input) => ({ status: 'valid', formatted: input === '123' ? 'nope' : undefined, country: 'LU' }),
  };
  const el = (await fixture(
    html`<lr-phone-input label="Phone number" .adapter=${badAdapter}></lr-phone-input>`,
  )) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  input.value = '123';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  expect(el.phoneStatus).to.equal('invalid');
  expect(el.value).to.equal('');
  expect(el.inputValue).to.equal('nope');

  // No `formatted` from the adapter at all -- falls back to the raw input
  // text rather than surfacing `undefined`.
  input.value = '456';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  expect(el.phoneStatus).to.equal('invalid');
  expect(el.inputValue).to.equal('456');
});

it('falls back to the no-adapter heuristic when the adapter throws', async () => {
  const throwingAdapter: PhoneNumberAdapter = {
    parse: () => {
      throw new Error('adapter exploded');
    },
  };
  const el = (await fixture(
    html`<lr-phone-input label="Phone number" .adapter=${throwingAdapter}></lr-phone-input>`,
  )) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  input.value = '+352621123456';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));

  expect(el.phoneStatus).to.equal('valid');
  expect(el.value).to.equal('+352621123456');
});

it('leaves selection getters and setters as safe no-ops before the internal input has rendered', () => {
  const el = document.createElement('lr-phone-input') as LyraPhoneInput;

  expect(el.selectionStart).to.be.null;
  expect(el.selectionEnd).to.be.null;
  expect(el.selectionDirection).to.not.exist;
  expect(() => {
    el.selectionStart = 3;
    el.selectionEnd = 5;
    el.selectionDirection = 'forward';
  }).not.to.throw();
});

it('sets the internal input\'s selectionDirection, including resetting a nullish value to "none"', async () => {
  const el = (await fixture(
    html`<lr-phone-input label="Phone number" value="+352621123456"></lr-phone-input>`,
  )) as LyraPhoneInput;
  await el.updateComplete;

  el.selectionDirection = 'backward';
  expect(el.input!.selectionDirection).to.equal('backward');

  // Chromium's own `selectionDirection` setter normalizes an explicit
  // "none" write back to "forward" on readback (verified directly against
  // `HTMLInputElement`, independent of this component) -- the assertion
  // here is on the write not throwing and reaching the native setter at
  // all, not on a specific readback value the browser doesn't actually
  // preserve.
  expect(() => {
    el.selectionDirection = null;
  }).not.to.throw();
});

it('tolerates a null selectionStart when computing caret position, both while typing and via setRangeText', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;
  // Shadow the native accessor on this one instance only -- some browsers
  // and non-text input types return `null` from `selectionStart`; simulate
  // that defensively rather than relying on it happening naturally for
  // `type="tel"` in this test's browser.
  Object.defineProperty(input, 'selectionStart', { configurable: true, get: () => null });

  input.value = '621123456';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await el.updateComplete;
  expect(el.value).to.equal('+352621123456');

  expect(() => el.setRangeText('9')).not.to.throw();
  expect(el.inputValue).to.include('9');
});

it('reacts to label, hint, and country-prefix slot content added after first render', async () => {
  const el = (await fixture(html`<lr-phone-input></lr-phone-input>`)) as LyraPhoneInput;
  await el.updateComplete;
  const labelPart = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const prefixPart = el.shadowRoot!.querySelector('[part="country-prefix"]') as HTMLElement;
  expect(labelPart.hidden).to.be.true;
  expect(hintPart.hidden).to.be.true;
  expect(prefixPart.hidden).to.be.true;

  const labelSlot = el.shadowRoot!.querySelector('slot[name="label"]') as HTMLSlotElement;
  const labelChange = oneEvent(labelSlot, 'slotchange');
  const labelSpan = document.createElement('span');
  labelSpan.slot = 'label';
  labelSpan.textContent = 'Mobile';
  el.append(labelSpan);
  await labelChange;
  await el.updateComplete;
  expect(labelPart.hidden).to.be.false;

  const hintSlot = el.shadowRoot!.querySelector('slot[name="hint"]') as HTMLSlotElement;
  const hintChange = oneEvent(hintSlot, 'slotchange');
  const hintSpan = document.createElement('span');
  hintSpan.slot = 'hint';
  hintSpan.textContent = 'Include the country code';
  el.append(hintSpan);
  await hintChange;
  await el.updateComplete;
  expect(hintPart.hidden).to.be.false;

  const prefixSlot = el.shadowRoot!.querySelector('slot[name="country-prefix"]') as HTMLSlotElement;
  const prefixChange = oneEvent(prefixSlot, 'slotchange');
  const prefixSpan = document.createElement('span');
  prefixSpan.slot = 'country-prefix';
  prefixSpan.textContent = 'flag';
  el.append(prefixSpan);
  await prefixChange;
  await el.updateComplete;
  expect(prefixPart.hidden).to.be.false;
});

it('exposes focus() and blur() methods that delegate to the internal telephone input', async () => {
  const el = (await fixture(html`<lr-phone-input label="Phone number"></lr-phone-input>`)) as LyraPhoneInput;
  await el.updateComplete;

  const focusPromise = oneEvent(el, 'focus');
  el.focus();
  await focusPromise;
  expect(el.shadowRoot!.activeElement).to.equal(el.input);

  const blurPromise = oneEvent(el, 'blur');
  el.blur();
  await blurPromise;
});

it('setRangeText is a no-op before the internal input has rendered', () => {
  const el = document.createElement('lr-phone-input') as LyraPhoneInput;
  expect(() => el.setRangeText('9')).not.to.throw();
});

it('supports the single-argument setRangeText overload', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;

  input.value = '621123456';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await el.updateComplete;
  input.setSelectionRange(input.value.length, input.value.length);

  el.setRangeText('7');
  await el.updateComplete;

  expect(el.inputValue).to.equal(input.value);
  expect(el.inputValue.replace(/\D/g, '')).to.equal('6211234567');
  expect(el.phoneStatus).to.equal('valid');
});

it('resets to the first available country from the adapter when no default-country is set', async () => {
  const form = (await fixture(html`
    <form><lr-phone-input name="phone" .adapter=${adapter}></lr-phone-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
  await el.updateComplete;

  el.country = 'FR';
  await el.updateComplete;
  expect(el.country).to.equal('FR');

  form.reset();
  await el.updateComplete;
  expect(el.country).to.equal('LU');
});

it('resets to an empty country when neither default-country nor any country list is available', async () => {
  const form = (await fixture(html`
    <form><lr-phone-input name="phone"></lr-phone-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
  await el.updateComplete;

  form.reset();
  await el.updateComplete;
  expect(el.country).to.equal('');
});
