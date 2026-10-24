import { expect } from '@open-wc/testing';
import type { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';
import '../components/lr-button.js';
import '../components/lr-checkbox-group.js';
import '../components/lr-combobox.js';
import '../components/lr-file-input.js';
import '../components/lr-graph-query-builder.js';
import '../components/lr-locale-picker.js';
import '../components/lr-model-select.js';
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
  setCustomValidity(message: string): void;
}

const CONTROLS = [
  'button', 'checkbox-group', 'combobox', 'file-input', 'graph-query-builder',
  'locale-picker', 'model-select', 'rating', 'rubric-form', 'select',
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
