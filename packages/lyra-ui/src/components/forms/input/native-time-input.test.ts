import { fixture, expect, html } from '@open-wc/testing';
import './native-time-input.js';
import { LyraNativeTimeInput } from './native-time-input.class.js';

const nativeInput = (el: LyraNativeTimeInput): HTMLInputElement => el.shadowRoot!.querySelector('input')!;

it('preserves the Lyra 7 browser-native time control under lr-native-time-input', async () => {
  const el = await fixture<LyraNativeTimeInput>(
    html`<lr-native-time-input label="Start time" min="09:00" max="17:00" value="09:30"></lr-native-time-input>`,
  );
  expect(nativeInput(el).type).to.equal('time');
  expect(nativeInput(el).getAttribute('min')).to.equal('09:00');
  expect(nativeInput(el).getAttribute('max')).to.equal('17:00');
  expect(el.value).to.equal('09:30');
  await expect(el).to.be.accessible();
});

it('keeps seconds-precision bounds and native constraint validation', async () => {
  const el = await fixture<LyraNativeTimeInput>(
    html`<lr-native-time-input min="09:00:30" max="17:00" step="1"></lr-native-time-input>`,
  );
  expect(nativeInput(el).getAttribute('min')).to.equal('09:00:30');
  el.value = '08:00';
  expect(el.checkValidity()).to.equal(false);
});

for (const [value, invalidKey] of [
  ['', 'valueMissing'], ['08:59', 'rangeUnderflow'], ['17:01', 'rangeOverflow'], ['09:01', 'stepMismatch'],
] as const) {
  it(`exposes ${invalidKey} and its recovery through the public validator catalog`, async () => {
    const el = await fixture<LyraNativeTimeInput>(html`<lr-native-time-input label="Start time"
      required min="09:00" max="17:00" step="300" .value=${value}></lr-native-time-input>`);
    const catalog = LyraNativeTimeInput.validators;
    expect(catalog.length).to.equal(1);
    expect(catalog[0]!.observedAttributes).to.include.members(['required', 'value', 'min', 'max', 'step']);
    const invalid = catalog[0]!.checkValidity(el);
    expect(invalid.isValid).to.equal(false);
    expect(invalid.invalidKeys).to.include(invalidKey);
    expect(invalid.message).to.equal(el.validationMessage).and.not.to.equal('');
    el.value = '09:30';
    expect(catalog[0]!.checkValidity(el)).to.deep.equal({ isValid: true, message: '', invalidKeys: [] });
    el.setCustomValidity('Choose a free appointment');
    expect(catalog[0]!.checkValidity(el)).to.deep.equal({
      isValid: false, message: 'Choose a free appointment', invalidKeys: ['customError'],
    });
    el.setCustomValidity('');
    expect(catalog[0]!.checkValidity(el).isValid).to.equal(true);
    catalog.length = 0;
    expect(LyraNativeTimeInput.validators.length).to.equal(1);
  });
}
