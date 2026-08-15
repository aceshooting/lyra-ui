import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import {
  type LyraPhoneInput,
  type LyraPhoneNumberAdapter,
  loadLibphonenumberAdapter,
} from './phone-input.js';
import './phone-input.js';
import '../button/button.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { styles } from './phone-input.styles.js';

const adapter: LyraPhoneNumberAdapter = {
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

it('inherits public row geometry from an ancestor across size and pill fallbacks', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-phone-input-padding-block: 7px; --lr-phone-input-font-size: 18px; --lr-phone-input-flag-size: 22px; --lr-phone-input-glyph-size: 20px; --lr-phone-input-gap: 13px; --lr-phone-input-radius: 17px; --lr-phone-input-control-min-height: 49px">
      <lr-phone-input size="2xs" pill flags default-country="LU" .adapter=${adapter}></lr-phone-input>
    </div>
  `);
  const el = wrapper.querySelector('lr-phone-input') as LyraPhoneInput;
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  const trigger = el.shadowRoot!.querySelector('[part="country-trigger"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLElement;
  const computed = getComputedStyle(row);
  expect(computed.minBlockSize).to.equal('49px');
  expect(computed.borderTopLeftRadius).to.equal('17px');
  expect(getComputedStyle(input).paddingTop).to.equal('7px');
  expect(getComputedStyle(input).fontSize).to.equal('18px');
  expect(getComputedStyle(trigger).gap).to.equal('13px');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="flag"]') as HTMLElement).fontSize).to.equal('22px');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="expand-icon"]') as HTMLElement).fontSize).to.equal('20px');
});

it("restores its nonempty native and validation defaults after attribute removal", async () => {
  const el = (await fixture(html`
    <lr-phone-input
      size="xl"
      country-label="Country"
      incomplete-text="Incomplete"
      invalid-text="Invalid"
      autocomplete="off"
      inputmode="numeric"
    ></lr-phone-input>
  `)) as LyraPhoneInput;
  for (const name of [
    "size",
    "country-label",
    "incomplete-text",
    "invalid-text",
    "autocomplete",
    "inputmode",
  ]) {
    el.removeAttribute(name);
  }
  await el.updateComplete;
  expect(el.size).to.equal("m");
  expect(el.countryLabel).to.equal("Select");
  expect(el.incompleteText).to.equal("This phone number is incomplete.");
  expect(el.invalidText).to.equal("The value is invalid.");
  expect(el.autocomplete).to.equal("tel");
  expect(el.inputmode).to.equal("tel");
});

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
  const eventPromise = Promise.all([oneEvent(el, 'input'), oneEvent(el, 'lr-input')]);

  input.value = '621123456';
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  const [nativeEvent, event] = await eventPromise;

  expect(el.value).to.equal('+352621123456');
  expect(new FormData(form).get('phone')).to.equal('+352621123456');
  expect(input.value).to.equal('621 123 456');
  expect(nativeEvent instanceof InputEvent).to.be.true;
  expect(event.detail).to.deep.include({
    value: '+352621123456',
    inputValue: '621 123 456',
    country: 'LU',
    valid: true,
  });
});

it('reconciles country, visible selection, canonical value, and FormData when countries are replaced', async () => {
  const form = (await fixture(html`
    <form>
      <lr-phone-input name="phone" default-country="LU" .adapter=${adapter}></lr-phone-input>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
  el.countries = [
    { code: 'LU', callingCode: '352' },
    { code: 'FR', callingCode: '33' },
  ];
  el.value = '+352621123456';
  await el.updateComplete;
  expect(el.country).to.equal('LU');

  el.countries = [{ code: 'FR', callingCode: '33' }];
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;
  expect(el.country).to.equal('FR');
  expect(select.value).to.equal('FR');
  expect(el.value).to.equal('+33621123456');
  expect(new FormData(form).get('phone')).to.equal('+33621123456');

  el.countries = [];
  el.adapter = undefined;
  await el.updateComplete;
  expect(el.country).to.equal('');
});

it('uses one valid catalog country for every initial projection and parser call', async () => {
  const parsedCountries: Array<string | undefined> = [];
  const localAdapter: LyraPhoneNumberAdapter = {
    countries: adapter.countries,
    parse(input, country) {
      parsedCountries.push(country);
      return { status: 'valid', e164: '+33621123456', formatted: input, country: 'LU' };
    },
  };
  const el = await fixture<LyraPhoneInput>(html`
    <lr-phone-input
      country="LU"
      default-country="LU"
      .countries=${[{ code: 'FR', callingCode: '33' }]}
      .adapter=${localAdapter}
    ></lr-phone-input>
  `);
  el.value = '621123456';
  await el.updateComplete;

  const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="country-select"]')!;
  expect(el.country).to.equal('FR');
  expect(select.value).to.equal('FR');
  expect(el.shadowRoot!.querySelector('[part="country-code"]')!.textContent!.trim()).to.equal('FR');
  expect(el.shadowRoot!.querySelector('[part="calling-code"]')!.textContent!.trim()).to.equal('+33');
  expect(parsedCountries.at(-1)).to.equal('FR');
  expect(el.country, 'an out-of-catalog detected country cannot split the projection').to.equal('FR');
});

it('treats an explicitly empty countries catalog as authoritative over adapter metadata', async () => {
  const parsedCountries: Array<string | undefined> = [];
  const localAdapter: LyraPhoneNumberAdapter = {
    countries: adapter.countries,
    parse(_input, country) {
      parsedCountries.push(country);
      return { status: 'incomplete' };
    },
  };
  const el = await fixture<LyraPhoneInput>(html`
    <lr-phone-input
      default-country="LU"
      .countries=${[]}
      .adapter=${localAdapter}
    ></lr-phone-input>
  `);
  el.value = '123';
  await el.updateComplete;

  const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="country-select"]')!;
  expect(el.country).to.equal('');
  expect(select.disabled).to.be.true;
  expect([...select.options].map((option) => option.value)).to.deep.equal(['']);
  expect(el.shadowRoot!.querySelector('[part="calling-code"]') === null).to.be.true;
  expect(parsedCountries.at(-1)).to.equal(undefined);
});

it('owns frozen snapshots of explicit and adapter-provided country catalogs', async () => {
  const explicit = [{ code: 'LU', callingCode: '352', label: 'Luxembourg' }];
  const automatic = [{ code: 'FR', callingCode: '33', label: 'France' }];
  const localAdapter: LyraPhoneNumberAdapter = {
    countries: automatic,
    parse: () => ({ status: 'empty' }),
  };
  const el = await fixture<LyraPhoneInput>(html`
    <lr-phone-input .countries=${explicit} .adapter=${localAdapter}></lr-phone-input>
  `);
  explicit[0]!.label = 'Forged';
  explicit.push({ code: 'DE', callingCode: '49', label: 'Germany' });
  automatic[0]!.label = 'Forged adapter';
  expect(el.countries).to.deep.equal([{ code: 'LU', callingCode: '352', label: 'Luxembourg' }]);
  expect(Object.isFrozen(el.countries)).to.be.true;
  expect(Object.isFrozen(el.countries![0])).to.be.true;

  el.countries = undefined;
  await el.updateComplete;
  const options = [...el.shadowRoot!.querySelectorAll<HTMLOptionElement>('[part="country-select"] option')];
  expect(options.map((option) => option.value)).to.deep.equal(['FR']);
  expect(options[0]!.textContent).to.contain('France');
});

it('suppresses host click/focus in the same task that fieldset disablement starts', async () => {
  const form = (await fixture(html`
    <form><fieldset><lr-phone-input></lr-phone-input></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const input = el.shadowRoot!.querySelector('input[part="input"]') as HTMLInputElement;
  let clicks = 0;
  input.addEventListener('click', () => clicks++);

  el.click();
  expect(clicks).to.equal(1);
  fieldset.disabled = true;
  el.click();
  el.focus();
  expect(clicks).to.equal(1);
  expect(el.shadowRoot!.activeElement === null).to.be.true;
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
  const error = el.shadowRoot!.querySelector('[part="error"]')!;
  expect(descriptionIds).to.include(error.id);
  expect(error.getAttribute('role')).to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]').length).to.equal(0);
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

it('relays focus and blur once as native FocusEvents with relatedTarget and aliases', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;

  const outside = document.createElement('button');
  const focusPromise = Promise.all([oneEvent(el, 'focus'), oneEvent(el, 'lr-focus')]);
  el.input!.dispatchEvent(new FocusEvent('focus', { relatedTarget: outside }));
  const [focus] = await focusPromise;
  expect(focus instanceof FocusEvent).to.be.true;
  expect(focus.relatedTarget === outside).to.be.true;

  const blurPromise = Promise.all([oneEvent(el, 'blur'), oneEvent(el, 'lr-blur')]);
  el.input!.dispatchEvent(new FocusEvent('blur', { relatedTarget: outside }));
  const [blur] = await blurPromise;
  expect(blur instanceof FocusEvent).to.be.true;
  expect(blur.relatedTarget === outside).to.be.true;
});

it('does not mark touched from a blur caused by the control itself becoming disabled', async () => {
  // Regression test: disabling a focused native form control forces
  // the browser to blur it -- plain platform behavior, nothing to do with custom elements. That is
  // not a real user interaction, so it must not mark the field touched; unconditionally doing so
  // could reenter an in-flight Lit update and trip Lit's dev-mode "scheduled an update after an
  // update completed" warning.
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;

  el.input!.focus();
  // Never chai-compare DOM nodes directly (hangs the whole file) -- compare identity as a plain
  // boolean instead.
  expect(
    el.shadowRoot!.activeElement === el.input,
    'the telephone input must be focused before disabling it',
  ).to.be.true;

  el.disabled = true;
  await el.updateComplete;
  await aTimeout(0);

  expect(
    (el as unknown as { touched: boolean }).touched,
    'a disable-forced blur must not mark touched',
  ).to.equal(false);
});

it('still marks touched from a real blur that is not caused by disabling', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;

  el.input!.focus();
  el.input!.blur();
  await el.updateComplete;

  expect(
    (el as unknown as { touched: boolean }).touched,
    'a genuine blur must still mark touched',
  ).to.equal(true);
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

it('dims the input-wrapper part via the :disabled pseudo-class when disabled only through an ancestor fieldset', async () => {
  // effectiveDisabled correctly gates the country select/telephone input
  // underneath even when disabled purely by fieldset cascading, but that
  // alone doesn't prove the *visual* treatment follows -- the wrapper's
  // opacity/cursor styling is keyed off a CSS selector (:host(:disabled)),
  // not effectiveDisabled, so it needs its own assertion. Mirrors
  // lr-chat-composer's identical fieldset/computed-style coverage.
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-phone-input name="phone" label="Phone number" default-country="LU" .adapter=${adapter}></lr-phone-input>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
  await el.updateComplete;
  const wrapper = el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;

  expect(el.disabled).to.be.false;
  expect(el.input!.disabled).to.be.true;
  expect(getComputedStyle(wrapper).opacity).to.equal('0.5');
  expect(getComputedStyle(wrapper).cursor).to.equal('not-allowed');
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
  expect(Object.isFrozen(loaded.countries)).to.be.true;
  expect(Object.isFrozen(loaded.countries?.[0])).to.be.true;
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
  expect(Object.isFrozen(loaded.countries)).to.be.true;
  expect(Object.isFrozen(loaded.countries?.[0])).to.be.true;
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

it('defaults to size "m" and reflects a size attribute', async () => {
  const defaultEl = (await fixture(html`<lr-phone-input></lr-phone-input>`)) as LyraPhoneInput;
  expect(defaultEl.size).to.equal('m');
  const el = (await fixture(html`<lr-phone-input size="s"></lr-phone-input>`)) as LyraPhoneInput;
  expect(el.getAttribute('size')).to.equal('s');
  expect(el.size).to.equal('s');
});

it("matches lr-input's own row height at every shared size tier", async () => {
  const expected: Record<string, string> = {
    '2xs': '20px',
    xs: '24px',
    s: '30px',
    m: '40px',
    l: '48px',
    xl: '56px',
  };
  for (const [size, px] of Object.entries(expected)) {
    const el = await fixture(html`<lr-phone-input size=${size}></lr-phone-input>`);
    const wrapper = el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
    expect(getComputedStyle(wrapper).minBlockSize, `size=${size}`).to.equal(px);
  }
});

it('keeps country-selector rows on the shared hit-floor-aware height ladder', async () => {
  const expected: Record<string, number> = { '2xs': 42, xs: 42, s: 42, m: 42, l: 48, xl: 56 };
  for (const [size, height] of Object.entries(expected)) {
    const el = await fixture(html`<lr-phone-input size=${size}></lr-phone-input>`);
    const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[part="input-wrapper"]')!;
    expect(wrapper.getBoundingClientRect().height, `size=${size}`).to.equal(height);
  }
});

it('accepts the Web Awesome size spellings, rendering small/medium/large as s/m/l', async () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['small', 's'],
    ['medium', 'm'],
    ['large', 'l'],
  ];
  const row = (el: Element) => el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  for (const [alias, step] of pairs) {
    const aliasEl = await fixture(html`<lr-phone-input size=${alias}></lr-phone-input>`);
    const stepEl = await fixture(html`<lr-phone-input size=${step}></lr-phone-input>`);
    expect(getComputedStyle(row(aliasEl)).minBlockSize, `min-block-size for ${alias}`).to.equal(
      getComputedStyle(row(stepEl)).minBlockSize,
    );
    expect(getComputedStyle(row(aliasEl)).fontSize, `font-size for ${alias}`).to.equal(
      getComputedStyle(row(stepEl)).fontSize,
    );
    expect(row(aliasEl).getBoundingClientRect().height, `laid-out height for ${alias}`).to.equal(
      row(stepEl).getBoundingClientRect().height,
    );
  }
});

it('rounds the field to a pill without a ::part() rule', async () => {
  const plain = (await fixture(html`<lr-phone-input></lr-phone-input>`)) as LyraPhoneInput;
  const pill = (await fixture(html`<lr-phone-input pill></lr-phone-input>`)) as LyraPhoneInput;
  const radius = (el: LyraPhoneInput) =>
    Number.parseFloat(
      getComputedStyle(el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement)
        .borderStartStartRadius,
    );
  expect(pill.pill).to.be.true;
  expect(pill.getAttribute('pill')).to.equal('');
  expect(radius(pill)).to.be.greaterThan(radius(plain));
});

it('scales the flag and expand glyphs with the phone-input size tier', async () => {
  const small = (await fixture(html`
    <lr-phone-input size="2xs" flags default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  const large = (await fixture(html`
    <lr-phone-input size="xl" flags default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await customElements.whenDefined('lr-flag');
  expect(
    parseFloat(getComputedStyle(large.shadowRoot!.querySelector('[part="flag"]')!).fontSize),
  ).to.be.greaterThan(
    parseFloat(getComputedStyle(small.shadowRoot!.querySelector('[part="flag"]')!).fontSize),
  );
  expect(
    parseFloat(getComputedStyle(large.shadowRoot!.querySelector('[part="expand-icon"]')!).fontSize),
  ).to.be.greaterThan(
    parseFloat(getComputedStyle(small.shadowRoot!.querySelector('[part="expand-icon"]')!).fontSize),
  );
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

it('names the telephone input even with no label, phone-label, aria-label or placeholder set', async () => {
  const el = (await fixture(html`<lr-phone-input></lr-phone-input>`)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input[type="tel"]') as HTMLInputElement;
  expect((input.getAttribute('aria-label') ?? '').length > 0).to.equal(true);
  await expect(el).to.be.accessible();
});

it('lets every explicit label source outrank the generic fallback name', async () => {
  const el = (await fixture(html`<lr-phone-input></lr-phone-input>`)) as LyraPhoneInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input[type="tel"]') as HTMLInputElement;
  const fallback = input.getAttribute('aria-label');

  el.placeholder = '+352 …';
  await el.updateComplete;
  expect(input.getAttribute('aria-label')).to.equal('+352 …');
  el.label = 'Mobile';
  await el.updateComplete;
  expect(input.getAttribute('aria-label')).to.equal('Mobile');
  el.phoneLabel = 'Work number';
  await el.updateComplete;
  expect(input.getAttribute('aria-label')).to.equal('Work number');
  el.accessibleLabel = 'Contact number';
  await el.updateComplete;
  expect(input.getAttribute('aria-label')).to.equal('Contact number');
  el.accessibleLabel = '';
  await el.updateComplete;
  expect(input.getAttribute('aria-label'), 'an explicitly empty host label still wins').to.equal('');

  // Clearing every source falls back to the same localized name again, never to no name at all.
  el.accessibleLabel = null;
  el.phoneLabel = '';
  el.label = '';
  el.placeholder = '';
  await el.updateComplete;
  expect(input.getAttribute('aria-label')).to.equal(fallback);
});

it('routes the fallback name through registerLyraLocale rather than a hardcoded literal', async () => {
  const el = (await fixture(html`<lr-phone-input></lr-phone-input>`)) as LyraPhoneInput;
  el.strings = { phoneInputLabel: 'Téléphone' };
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input[type="tel"]') as HTMLInputElement;
  expect(input.getAttribute('aria-label')).to.equal('Téléphone');
});

it('treats an empty string as empty and infers a missing phone from length or dial-like punctuation, via a fake libphonenumber-compatible module', async () => {
  const loaded = await loadLibphonenumberAdapter(async () => ({
    getCountries: () => ['LU'],
    getCountryCallingCode: () => '352',
    parsePhoneNumberFromString: () => undefined,
    validatePhoneNumberLength: (input: string) =>
      input === '619' ? 'TOO_SHORT' : undefined,
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
    { number: string; country?: string; valid: boolean; possible: boolean; national: string; international: string;
    }
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

it('keeps an empty automatic catalog empty when no adapter metadata is available', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" default-country="LU"></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;

  expect(el.country).to.equal('');
  expect(select.disabled).to.be.true;
  expect([...select.options].map((option) => option.value)).to.deep.equal(['']);
  expect(el.shadowRoot!.querySelector('[part="calling-code"]') == null).to.be.true;
});

it('rejects malformed catalog rows and hostile getters without aborting the remaining catalog', async () => {
  const hostile = {} as { code: string; callingCode: string };
  Object.defineProperty(hostile, 'code', {
    get() {
      throw new Error('hostile code getter');
    },
  });
  const el = (await fixture(html`
    <lr-phone-input
      label="Phone number"
      .countries=${[
        { code: 'LU' },
        hostile,
        { code: 'FR', callingCode: 'not-a-code' },
        { code: 'be', callingCode: '+32' },
      ] as unknown as Array<{ code: string; callingCode: string }>}
    ></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;

  expect([...select.options].map((option) => option.value)).to.deep.equal(['BE']);
  expect(el.country).to.equal('BE');
  expect(el.shadowRoot!.querySelector('[part="calling-code"]')!.textContent!.trim()).to.equal('+32');
});

it('falls back to the raw code if Intl.DisplayNames.prototype.of ever returns a nullish value', async () => {
  const original = Intl.DisplayNames.prototype.of;
  Intl.DisplayNames.prototype.of = function (this: Intl.DisplayNames, code: string) {
    return code === 'LU' ? (undefined as unknown as string) : original.call(this, code);
  };
  try {
    const el = (await fixture(html`
      <lr-phone-input
        label="Phone number"
        default-country="LU"
        .countries=${[{ code: 'LU', callingCode: '352' }]}
      ></lr-phone-input>
    `)) as LyraPhoneInput;
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;

    // `getDisplayNames(...).of('LU')` was stubbed to return `undefined`; the
    // `?? row.code` fallback in `countryName()` must still resolve to 'LU'
    // rather than rendering "undefined".
    expect(select.options[0]!.textContent).to.equal('LU (+352)');
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
  const badAdapter = {
    parse: (input) => ({ status: 'valid', formatted: input === '123' ? 'nope' : undefined, country: 'LU' }),
  } as unknown as LyraPhoneNumberAdapter;
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

it('fails closed when an adapter throws instead of accepting a value through the fallback parser', async () => {
  const throwingAdapter: LyraPhoneNumberAdapter = {
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

  expect(el.phoneStatus).to.equal('invalid');
  expect(el.value).to.equal('');
  expect(el.validity.typeMismatch).to.be.true;
});

it('fails closed on unknown discriminators and hostile parse-result getters', async () => {
  const results: unknown[] = [
    { status: 'mystery', e164: '+352621123456' },
    Object.defineProperty({}, 'status', {
      get() {
        throw new Error('hostile status getter');
      },
    }),
  ];
  const badAdapter = {
    parse: () => results.shift(),
  } as unknown as LyraPhoneNumberAdapter;
  const el = await fixture<LyraPhoneInput>(html`
    <lr-phone-input required .adapter=${badAdapter}></lr-phone-input>
  `);

  for (const inputValue of ['123', '456']) {
    el.input!.value = inputValue;
    el.input!.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(el.phoneStatus).to.equal('invalid');
    expect(el.value).to.equal('');
    expect(el.validity.typeMismatch).to.be.true;
  }
});

it('forwards readonly/autofocus to the telephone input and locks every user mutation', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-phone-input
        name="phone"
        readonly
        autofocus
        required
        default-country="LU"
        .adapter=${adapter}
        value="+352621123456"
      ></lr-phone-input>
    </form>
  `);
  const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
  await el.updateComplete;
  const input = el.input!;
  const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="country-select"]')!;
  expect(input.readOnly).to.be.true;
  expect(input.autofocus).to.be.true;
  expect(select.disabled, 'the country selector has no native readonly mode').to.be.true;
  expect(el.validity.valid, 'readonly bars constraint validation').to.be.true;
  expect(new FormData(form).get('phone')).to.equal('+352621123456');

  const originalValue = el.value;
  const originalCountry = el.country;
  input.value = '000000';
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  select.value = 'FR';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el.value).to.equal(originalValue);
  expect(el.country).to.equal(originalCountry);
  el.focus();
  expect(el.shadowRoot!.activeElement === input, 'readonly remains focusable/copyable').to.be.true;
});

it('encodes a non-color forced-colors affordance for country hover and press', () => {
  const css = styles.cssText;
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  expect(forced).to.include("[part='country-select']:not(:disabled):hover + [part='country-trigger']");
  expect(forced).to.match(/hover[^}]*outline-style:\s*dashed/s);
  expect(forced).to.match(/active[^}]*outline-style:\s*solid/s);
  expect(forced).to.include('Highlight');
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
  expect(el.shadowRoot!.activeElement === el.input).to.equal(true);

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

it('renders a compact decorative country trigger that mirrors the selection without repeating the calling code', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Mobile" default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="country-trigger"]')!;
  expect(trigger.getAttribute('aria-hidden')).to.equal('true');
  expect(trigger.querySelector('[part="country-code"]')!.textContent!.trim()).to.equal('LU');
  expect(Boolean(trigger.querySelector('[part="expand-icon"] svg'))).to.equal(true);
  // The calling code renders exactly once, in its own part beside the trigger.
  expect(trigger.textContent).to.not.include('+352');
  expect(el.shadowRoot!.querySelector('[part="calling-code"]')!.textContent!.trim()).to.equal('+352');
  // The invisible native select stays the real, accessibly named control over the trigger.
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;
  expect(Boolean(select.getAttribute('aria-label'))).to.equal(true);

  select.value = 'FR';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await el.updateComplete;
  expect(trigger.querySelector('[part="country-code"]')!.textContent!.trim()).to.equal('FR');
});

it('layers the invisible native select exactly over the visible trigger', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Mobile" default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const select = el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement;
  const trigger = el.shadowRoot!.querySelector('[part="country-trigger"]') as HTMLElement;
  const selectStyle = getComputedStyle(select);
  expect(selectStyle.opacity).to.equal('0');
  expect(selectStyle.position).to.equal('absolute');
  expect(selectStyle.cursor).to.equal('pointer');
  // The trigger sizes the region; the select must cover it edge to edge so every visible pixel
  // of the trigger is really a click on the native control.
  const selectBox = select.getBoundingClientRect();
  const triggerBox = trigger.getBoundingClientRect();
  expect(selectBox.left).to.be.closeTo(triggerBox.left, 1);
  expect(selectBox.right).to.be.closeTo(triggerBox.right, 1);
  expect(selectBox.top).to.be.closeTo(triggerBox.top, 1);
  expect(selectBox.bottom).to.be.closeTo(triggerBox.bottom, 1);
  expect(triggerBox.width).to.be.greaterThan(0);
});

it('shows the localized selector label as a quiet placeholder in the trigger when no countries exist', async () => {
  const el = (await fixture(html`<lr-phone-input label="Mobile"></lr-phone-input>`)) as LyraPhoneInput;
  await el.updateComplete;
  const code = el.shadowRoot!.querySelector('[part="country-code"]')!;
  expect(code.hasAttribute('data-placeholder')).to.equal(true);
  expect(code.textContent!.trim()).to.equal('Select');
  expect((el.shadowRoot!.querySelector('[part="country-select"]') as HTMLSelectElement).disabled).to.equal(true);
});

it('renders no flag markup while flags stays off', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Mobile" default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="flag"]') === null).to.equal(true);
});

it('flags renders a decorative compact lr-flag for the selection and keeps it in sync with country changes', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Mobile" flags default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const flag = el.shadowRoot!.querySelector('[part="flag"]')!;
  expect(flag.tagName.toLowerCase()).to.equal('lr-flag');
  expect(flag.getAttribute('country')).to.equal('LU');
  expect(flag.getAttribute('fidelity')).to.equal('compact');
  // Decorative: the country name is already announced by the native select.
  expect(flag.getAttribute('aria-label')).to.equal('');
  // Enabling flags lazily registers the element definition itself.
  await customElements.whenDefined('lr-flag');

  el.country = 'FR';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="flag"]')!.getAttribute('country')).to.equal('FR');
});

it('flags without any selectable country renders no flag element', async () => {
  const el = (await fixture(html`<lr-phone-input label="Mobile" flags></lr-phone-input>`)) as LyraPhoneInput;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="flag"]') === null).to.equal(true);
});

it('is accessible with flags enabled', async () => {
  const el = (await fixture(html`
    <lr-phone-input
      label="Phone number"
      hint="Include the country code"
      flags
      default-country="LU"
      .adapter=${adapter}
    ></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  await customElements.whenDefined('lr-flag');
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

// The country cell's press target is the invisible native <select> stretched over the visible
// trigger, so its pressed rule has to hang off that select's own :active -- a `[part='country-
// trigger']:active` rule would never match, because that div is not the element being activated.
// Driven through the real pointer for exactly that reason: only a rendered assertion can tell a
// live pressed state from a plausible-looking dead selector. Colour STRINGS are compared, never
// elements -- a DOM node as chai's actual/expected hangs the whole file.
it('tints the country trigger while the invisible select over it is hovered, and deepens it while pressed', async () => {
  const el = (await fixture(
    html`<lr-phone-input
      default-country="LU"
      style="--lr-transition-fast: 0s"
      .adapter=${adapter}
    ></lr-phone-input>`,
  )) as LyraPhoneInput;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="country-trigger"]') as HTMLElement;
  const rect = trigger.getBoundingClientRect();
  const centre: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];
  const rest = getComputedStyle(trigger).backgroundColor;
  try {
    await sendMouse({ type: 'move', position: centre });
    await waitUntil(
      () => getComputedStyle(trigger).backgroundColor !== rest,
      'country trigger hover paint must settle',
    );
    const hovered = getComputedStyle(trigger).backgroundColor;
    await sendMouse({ type: 'down' });
    await waitUntil(
      () => getComputedStyle(trigger).backgroundColor !== hovered,
      'country trigger pressed paint must settle',
    );
    const pressed = getComputedStyle(trigger).backgroundColor;
    await sendMouse({ type: 'up' });
    expect(hovered, 'hover must tint the resting background').to.not.equal(rest);
    expect(pressed, 'pressed must be visibly stronger than hover, not identical to it').to.not.equal(hovered);
  } finally {
    await resetMouse();
  }
});

describe('lr-phone-input implicit form submission', () => {
  const enterOn = (el: LyraPhoneInput, init: KeyboardEventInit = {}) =>
    (el.shadowRoot!.querySelector('input[part="input"]') as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true, ...init }),
    );

  it('submits the ancestor form when Enter is pressed in the telephone field', async () => {
    const form = (await fixture(html`
      <form><lr-phone-input name="tel" value="+35226123456" label="Phone"></lr-phone-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    enterOn(el);
    expect(submits).to.equal(1);
  });

  it('submits the ElementInternals form owner when the control is outside that form', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <form id="external-phone-form"></form>
        <lr-phone-input
          form="external-phone-form"
          name="tel"
          value="+35226123456"
          label="Phone"
        ></lr-phone-input>
      </div>
    `);
    const form = wrapper.querySelector('form')!;
    const el = wrapper.querySelector('lr-phone-input') as LyraPhoneInput;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });

    expect(el.form === form).to.be.true;
    enterOn(el);
    expect(submits).to.equal(1);
  });

  it('submits through an lr-button submitter, which requestSubmit() itself would reject', async () => {
    const form = (await fixture(html`
      <form>
        <lr-phone-input name="tel" value="+35226123456" label="Phone"></lr-phone-input>
        <lr-button type="submit" name="action" value="save">Go</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
    await el.updateComplete;
    let submits = 0;
    let submitterName = '';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submits += 1;
      submitterName = ((e as SubmitEvent).submitter as HTMLButtonElement | null)?.name ?? '';
    });
    enterOn(el);
    expect(submits).to.equal(1);
    expect(submitterName, 'the lr-button was the submitter').to.equal('action');
  });

  it("runs the form's constraint validation, so an unparseable number blocks submission", async () => {
    const form = (await fixture(html`
      <form><lr-phone-input name="tel" value="not a number" label="Phone"></lr-phone-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    expect(el.checkValidity(), 'an unparseable number is invalid').to.be.false;
    enterOn(el);
    expect(submits).to.equal(0);
  });

  it('never submits while disabled, on a held modifier, during IME composition, or after a veto', async () => {
    const form = (await fixture(html`
      <form><lr-phone-input name="tel" value="+35226123456" label="Phone"></lr-phone-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-phone-input') as LyraPhoneInput;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    enterOn(el, { shiftKey: true });
    enterOn(el, { ctrlKey: true });
    enterOn(el, { altKey: true });
    enterOn(el, { metaKey: true });
    enterOn(el, { isComposing: true });
    expect(submits).to.equal(0);

    // Capture on the host runs before the internal input's own listener.
    const veto = (e: Event): void => e.preventDefault();
    el.addEventListener('keydown', veto, true);
    enterOn(el);
    el.removeEventListener('keydown', veto, true);
    expect(submits).to.equal(0);

    el.disabled = true;
    await el.updateComplete;
    enterOn(el);
    expect(submits, 'a disabled control never submits').to.equal(0);

    el.disabled = false;
    await el.updateComplete;
    enterOn(el);
    expect(submits, 'a bare Enter still submits').to.equal(1);
  });
});

it('emits a cancelable lr-invalid alias and forwards its cancellation to the native invalid event', async () => {
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" required default-country="LU" .adapter=${adapter}></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  const aliases: CustomEvent[] = [];
  el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0].bubbles && aliases[0].composed).to.be.true;
  expect(aliases[0].cancelable).to.be.true;

  // Cancelling the alias must cancel the native `invalid` it aliases, or an app rendering its own
  // error banner cannot suppress the browser's validation bubble alongside it. The host's alias
  // listener is installed in the constructor, so it runs before the recorder registered here.
  el.addEventListener('lr-invalid', (event) => event.preventDefault());
  const natives: Event[] = [];
  el.addEventListener('invalid', (event) => natives.push(event));
  expect(el.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.true;
});

it('bars constraint validation while disabled or fieldset-disabled', async () => {
  // A native <input required disabled> matches neither :valid nor :invalid; this control used to
  // report valueMissing regardless, painting every disabled required field with the documented
  // :state(user-invalid) error styling.
  const el = (await fixture(html`
    <lr-phone-input label="Phone number" required default-country="LU" .adapter=${adapter} disabled></lr-phone-input>
  `)) as LyraPhoneInput;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'disabled + required').to.be.false;
  expect(el.validity.valid).to.be.true;
  expect(el.matches(':state(invalid)'), 'disabled must not be :state(invalid)').to.be.false;
  el.reportValidity();
  expect(el.matches(':state(user-invalid)'), 'disabled must not be :state(user-invalid)').to.be.false;

  el.disabled = false;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'enabled again').to.be.true;

  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-phone-input label="Nested" name="nested" required default-country="LU"></lr-phone-input>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const nested = form.querySelector('lr-phone-input') as LyraPhoneInput;
  await nested.updateComplete;
  expect(nested.disabled, 'a fieldset never mutates the control own disabled').to.be.false;
  expect(nested.validity.valueMissing, 'fieldset-disabled + required').to.be.false;
  expect(nested.matches(':state(invalid)')).to.be.false;
});
