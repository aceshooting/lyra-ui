import { expect, fixture } from '@open-wc/testing';
import '../lr-button.js';
import '../lr-checkbox-group.js';
import '../lr-combobox.js';
import '../lr-option.js';
import '../lr-locale-picker.js';
import '../lr-rubric-form.js';
import '../lr-select.js';
import '../lr-slider.js';
import '../lr-time-range.js';
import '../lr-token-input.js';

type Host = HTMLElement & {
  updateComplete: Promise<unknown>;
  validity: ValidityState;
  validationMessage: string;
  setCustomValidity(message: string | null | undefined): void;
};

// A JavaScript caller (or a framework binding an unset value) can pass a nullish message. These
// controls treat that as clearing the custom error rather than storing the text "null".
const cases: ReadonlyArray<readonly [string, string]> = [
  ['lr-button', '<lr-button name="action" value="go">Go</lr-button>'],
  ['lr-checkbox-group', '<lr-checkbox-group label="Toppings"></lr-checkbox-group>'],
  ['lr-combobox', '<lr-combobox label="Fruit"><lr-option value="a">Apple</lr-option></lr-combobox>'],
  ['lr-locale-picker', '<lr-locale-picker label="Language" without-flags></lr-locale-picker>'],
  ['lr-rubric-form', '<lr-rubric-form name="answers"></lr-rubric-form>'],
  ['lr-select', '<lr-select label="Fruit"><lr-option value="a">Apple</lr-option></lr-select>'],
  ['lr-slider', '<lr-slider aria-label="Level"></lr-slider>'],
  ['lr-time-range', '<lr-time-range aria-label="Hours"></lr-time-range>'],
  ['lr-token-input', '<lr-token-input label="Tags"></lr-token-input>'],
];

for (const [name, markup] of cases) {
  it(`${name} clears its custom error when given a nullish message`, async () => {
    const el = (await fixture<HTMLElement>(markup)) as Host;
    await el.updateComplete;

    el.setCustomValidity('Pick something else');
    await el.updateComplete;
    expect(el.validity.customError, 'custom error applied').to.equal(true);

    el.setCustomValidity(null);
    await el.updateComplete;
    expect(el.validity.customError, 'null clears it').to.equal(false);
    expect(el.validationMessage).to.not.equal('null');

    el.setCustomValidity('Pick something else');
    el.setCustomValidity(undefined);
    await el.updateComplete;
    expect(el.validity.customError, 'undefined clears it').to.equal(false);
  });
}
