import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraElement } from './lyra-element.js';
import { getLyraLocale, LYRA_DEFAULT_STRINGS, registerLyraLocale, setLyraLocale } from './localization.js';
import { tag } from './prefix.js';
import '../components/lr-checkbox.js';
import '../components/lr-switch.js';
import '../components/lr-radio-group.js';
import '../components/lr-otp-input.js';
import '../components/lr-code-editor.js';
import '../components/lr-country-picker.js';
import '../components/lr-input.js';
import '../components/lr-number-input.js';
import '../components/lr-native-time-input.js';
import '../components/lr-date-input.js';
import '../components/lr-time-input.js';
import '../components/lr-phone-input.js';
import '../components/lr-textarea.js';
import '../components/lr-emoji-picker.js';
import '../components/lr-known-date.js';
import '../components/lr-chat-composer.js';
import '../components/lr-button.js';
import '../components/lr-checkbox-group.js';
import '../components/lr-combobox.js';
import '../components/lr-file-input.js';
import '../components/lr-graph-query-builder.js';
import '../components/lr-locale-picker.js';
import '../components/lr-model-select.js';
import '../components/lr-radio.js';
import '../components/lr-rating.js';
import '../components/lr-rubric-form.js';
import '../components/lr-select.js';
import '../components/lr-signature-pad.js';
import '../components/lr-slider.js';
import '../components/lr-time-range.js';
import '../components/lr-token-input.js';
import '../components/lr-tool-param-form.js';
import '../components/lr-voice-picker.js';

interface ValidityControl extends LyraElement {
  readonly validity: ValidityState;
  readonly validationMessage: string;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setCustomValidity(message: string): void;
}

const CONTROLS = [
  'button', 'checkbox-group', 'combobox', 'file-input', 'graph-query-builder',
  'locale-picker', 'model-select', 'radio', 'rating', 'rubric-form', 'select',
  'signature-pad', 'slider', 'time-range', 'token-input', 'tool-param-form', 'voice-picker',
] as const;

describe('custom validity clearing at JavaScript value boundaries', () => {
  for (const name of CONTROLS) {
    it(`${name} clears nullish consumer errors without replacing its intrinsic validity`, async () => {
      const control = document.createElement(tag(name)) as ValidityControl;
      if (name === 'button') control.setAttribute('type', 'submit');
      if (name === 'locale-picker') Reflect.set(control, 'withoutFlags', true);
      document.body.append(control);
      try {
        await control.updateComplete;
        const intrinsicValid = control.validity.valid;
        const intrinsicMessage = control.validationMessage;
        for (const value of [null, undefined]) {
          control.setCustomValidity('Rejected by consumer');
          expect(control.validity.customError).to.equal(true);
          expect(control.validationMessage).to.equal('Rejected by consumer');
          Reflect.apply(control.setCustomValidity, control, [value]);
          expect(control.validity.customError).to.equal(false);
          expect(control.validity.valid).to.equal(intrinsicValid);
          expect(control.validationMessage).to.equal(intrinsicMessage);
        }
      } finally { control.remove(); }
    });
  }
});

describe('form error presentation', () => {
  for (const name of [
    'input', 'number-input', 'native-time-input', 'date-input', 'time-input',
    'phone-input', 'textarea', 'chat-composer', 'known-date',
  ]) {
    it(`${name} preserves pristine presentation during a direct static validity check`, async () => {
      const form = await fixture<HTMLFormElement>(html`<form></form>`);
      const control = document.createElement(tag(name)) as ValidityControl;
      control.setAttribute('required', '');
      form.append(control);
      await control.updateComplete;
      const owners = [...control.shadowRoot!.querySelectorAll('[aria-invalid]')];
      expect(owners.length).to.be.greaterThan(0);
      let invalidEvents = 0;
      control.addEventListener('invalid', event => { invalidEvents++; event.preventDefault(); });
      expect(control.checkValidity()).to.equal(false);
      await control.updateComplete;
      expect(invalidEvents).to.equal(1);
      expect(owners.every(owner => owner.getAttribute('aria-invalid') === 'false')).to.equal(true);
      expect(control.hasAttribute('data-invalid')).to.equal(false);
      expect(control.matches(':state(user-invalid)')).to.equal(false);
      expect(control.reportValidity()).to.equal(false);
      await control.updateComplete;
      expect(owners.every(owner => owner.getAttribute('aria-invalid') === 'true')).to.equal(true);
      form.reset();
      await control.updateComplete;
      expect(owners.every(owner => owner.getAttribute('aria-invalid') === 'false')).to.equal(true);
      form.requestSubmit();
      await control.updateComplete;
      expect(owners.every(owner => owner.getAttribute('aria-invalid') === 'true')).to.equal(true);
    });
  }

  for (const name of [
    'select', 'locale-picker', 'phone-input', 'token-input', 'emoji-picker',
    'signature-pad', 'known-date', 'model-select', 'voice-picker',
  ]) {
    it(`${name} exposes both error sources while preserving native validity`, async () => {
      const wrapper = await fixture<HTMLElement>(html`<div></div>`);
      const control = document.createElement(tag(name)) as ValidityControl;
      if (name === 'locale-picker') Reflect.set(control, 'withoutFlags', true);
      wrapper.append(control);
      await control.updateComplete;
      const allMarked = (value: string): boolean => {
        const owners = [...control.shadowRoot!.querySelectorAll('[aria-invalid]')];
        return owners.length > 0 && owners.every(owner => owner.getAttribute('aria-invalid') === value);
      };
      expect(allMarked('false')).to.equal(true);
      control.setAttribute('error-text', 'Review your entry.');
      await control.updateComplete;
      expect(allMarked('true')).to.equal(true);
      expect(control.checkValidity()).to.equal(true);
      if (name === 'model-select' || name === 'voice-picker') {
        Reflect.set(control, 'catalog', ['Choice']);
        await control.updateComplete;
        const trigger = control.shadowRoot!.querySelector('[part="trigger"]')!;
        expect(trigger.getAttribute('aria-invalid')).to.equal('true');
        Reflect.set(control, 'catalog', []);
        await control.updateComplete;
      }
      control.removeAttribute('error-text');
      await control.updateComplete;
      expect(allMarked('false')).to.equal(true);
      const error = document.createElement('span');
      error.slot = 'error';
      error.textContent = 'Review your entry.';
      control.append(error);
      await waitUntil(() => allMarked('true'));
      expect(control.validity.valid).to.equal(true);
      expect(control.matches(':state(invalid)')).to.equal(false);
      error.remove();
      await waitUntil(() => allMarked('false'));
    });
  }
});

describe('localized required validation messages', () => {
  const cases = [
    ['phone-input', 'fieldRequired'], ['select', 'selectValueMissing'], ['checkbox', 'checkboxRequired'],
    ['date-input', 'fieldRequired'], ['combobox', 'comboboxRequired'], ['switch', 'switchRequired'],
    ['time-input', 'fieldRequired'], ['textarea', 'fieldRequired'], ['code-editor', 'fieldRequired'],
    ['known-date', 'fieldRequired'], ['chat-composer', 'fieldRequired'], ['otp-input', 'fieldRequired'],
    ['checkbox-group', 'checkboxGroupRequired'], ['radio-group', 'radioRequired'],
    ['signature-pad', 'fieldRequired'], ['token-input', 'tokenInputRequired'],
    ['model-select', 'modelSelectRequired'], ['voice-picker', 'voicePickerRequired'],
    ['file-input', 'fieldRequired'], ['rating', 'fieldRequired'], ['country-picker', 'fieldRequired'],
    ['emoji-picker', 'fieldRequired'], ['button', 'fieldRequired'],
  ] as const;

  const locale = 'fr-x-validity';
  const translation = 'Veuillez remplir ce champ.';
  before(() => {
    const messages = { ...LYRA_DEFAULT_STRINGS };
    for (const [, key] of cases) messages[key] = translation;
    registerLyraLocale(locale, messages);
  });

  for (const [name] of cases) {
    it(`${name} updates its required message with the inherited locale and preserves custom errors`, async () => {
      const wrapper = await fixture<HTMLElement>(html`<div lang="en"></div>`);
      const control = document.createElement(tag(name)) as ValidityControl;
      if (name === 'button') control.setAttribute('type', 'submit');
      control.setAttribute('required', '');
      wrapper.append(control);
      await control.updateComplete;
      expect(control.validity.valueMissing).to.equal(true);
      const english = control.validationMessage;
      expect(english).not.to.equal(translation);
      let invalidEvents = 0;
      control.addEventListener('invalid', () => invalidEvents++);
      control.addEventListener('lr-invalid', () => invalidEvents++);
      wrapper.lang = locale;
      await waitUntil(() => control.validationMessage === translation);
      expect(control.validity.valueMissing).to.equal(true);
      control.setCustomValidity('Server message');
      wrapper.lang = 'en';
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      await control.updateComplete;
      expect(control.validationMessage).to.equal('Server message');
      expect(control.validity.customError).to.equal(true);
      control.setCustomValidity('');
      expect(control.validationMessage).to.equal(english);
      expect(control.validity.valueMissing).to.equal(true);
      expect(control.matches(':state(user-invalid)')).to.equal(false);
      expect(control.hasAttribute('data-invalid')).to.equal(false);
      expect(invalidEvents).to.equal(0);
    });
  }
});

it('updates an empty required select when the page locale or current catalog changes', async () => {
  const previousLocale = getLyraLocale();
  const locale = 'fr-x-page-check';
  try {
    setLyraLocale('en');
    registerLyraLocale(locale, { ...LYRA_DEFAULT_STRINGS, selectValueMissing: 'Choisissez une option.' });
    const control = await fixture<ValidityControl>(html`<lr-select required></lr-select>`);
    setLyraLocale(locale);
    await waitUntil(() => control.validationMessage === 'Choisissez une option.');
    registerLyraLocale(locale, { ...LYRA_DEFAULT_STRINGS, selectValueMissing: 'Choisissez un élément.' });
    await waitUntil(() => control.validationMessage === 'Choisissez un élément.');
    expect(control.validity.valueMissing).to.equal(true);
    expect(control.matches(':state(user-invalid)')).to.equal(false);
  } finally {
    setLyraLocale(previousLocale);
  }
});
