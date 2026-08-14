import { expect, fixture, html } from '@open-wc/testing';
import { LyraButton } from './button/button.class.js';
import { LyraCheckbox } from './checkbox/checkbox.class.js';
import { LyraColorPicker } from './color-picker/color-picker.class.js';
import { LyraInput } from './input/input.js';
import { LyraNumberInput } from './input/number-input.class.js';
import { LyraTimeInput } from './input/time-input.class.js';
import { LyraOtpInput } from './otp-input/otp-input.class.js';
import { LyraRadio } from './radio/radio.class.js';
import { LyraRadioGroup } from './radio/radio-group.class.js';
import { LyraSelect } from './select/select.class.js';
import { LyraSlider } from './slider/slider.class.js';
import { LyraSwitch } from './switch/switch.class.js';
import { LyraTextarea } from './textarea/textarea.class.js';

const formControlConstructors = [
  ['lr-button', LyraButton],
  ['lr-checkbox', LyraCheckbox],
  ['lr-color-picker', LyraColorPicker],
  ['lr-input', LyraInput],
  ['lr-number-input', LyraNumberInput],
  ['lr-time-input', LyraTimeInput],
  ['lr-otp-input', LyraOtpInput],
  ['lr-radio', LyraRadio],
  ['lr-radio-group', LyraRadioGroup],
  ['lr-select', LyraSelect],
  ['lr-slider', LyraSlider],
  ['lr-switch', LyraSwitch],
  ['lr-textarea', LyraTextarea],
] as const;

const invalidControl = {
  validity: {
    valueMissing: true,
    valid: false,
  } as ValidityState,
  validationMessage: 'Complete this field',
};

describe('mirrored static form validators', () => {
  for (const [tagName, constructor] of formControlConstructors) {
    it(`${tagName} exposes a fresh, callable validator catalog`, () => {
      const validators = constructor.validators;
      const validator = validators[0]!;

      expect(validators).not.to.equal(constructor.validators);
      expect(validator.observedAttributes).to.include('disabled');
      expect(validator.checkValidity).to.be.a('function');
      expect(validator.checkValidity(invalidControl as never)).to.deep.equal({
        isValid: false,
        message: 'Complete this field',
        invalidKeys: ['valueMissing'],
      });
    });
  }

  it('projects a live control validity state through the public catalog', async () => {
    const input = await fixture<LyraInput>(html`<lr-input required></lr-input>`);
    const validator = LyraInput.validators[0]!;

    expect(validator.checkValidity(input).invalidKeys).to.deep.equal(['valueMissing']);

    input.value = 'complete';
    await input.updateComplete;

    expect(validator.checkValidity(input)).to.deep.equal({
      isValid: true,
      message: '',
      invalidKeys: [],
    });
  });
});
