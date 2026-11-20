import { expect } from '@open-wc/testing';
import { tag } from './prefix.js';
import type { FormOwnerValue } from './form-associated.js';

import '../components/lr-tool-param-form.js';
import '../components/lr-chat-composer.js';
import '../components/lr-model-select.js';
import '../components/lr-voice-picker.js';
import '../components/lr-graph-query-builder.js';
import '../components/lr-button.js';
import '../components/lr-checkbox-group.js';
import '../components/lr-checkbox.js';
import '../components/lr-code-editor.js';
import '../components/lr-color-picker.js';
import '../components/lr-combobox.js';
import '../components/lr-date-input.js';
import '../components/lr-emoji-picker.js';
import '../components/lr-input.js';
import '../components/lr-number-input.js';
import '../components/lr-time-input.js';
import '../components/lr-locale-picker.js';
import '../components/lr-otp-input.js';
import '../components/lr-phone-input.js';
import '../components/lr-radio.js';
import '../components/lr-radio-button.js';
import '../components/lr-radio-group.js';
import '../components/lr-rubric-form.js';
import '../components/lr-select.js';
import '../components/lr-slider.js';
import '../components/lr-switch.js';
import '../components/lr-textarea.js';
import '../components/lr-time-range.js';
import '../components/lr-token-input.js';
import '../components/lr-rating.js';
import '../components/lr-known-date.js';

interface FormOwnerControl extends HTMLElement {
  get form(): HTMLFormElement | null;
  set form(owner: FormOwnerValue);
  getForm(): HTMLFormElement | null;
}

// icon-button is deliberately absent: it is an action/link-only primitive with no
// `formAssociated`, `attachInternals()`, `form`, or `getForm()` -- see its own class doc comment
// ("This icon-only primitive is intentionally an action/link, not a form submitter. Use
// <lr-button circle type="submit|reset"> ... that component owns the complete native submitter
// contract."). It does not belong in this owner-contract list.
const FORM_CONTROL_NAMES = [
  'tool-param-form',
  'chat-composer',
  'model-select',
  'voice-picker',
  'graph-query-builder',
  'button',
  'checkbox-group',
  'checkbox',
  'code-editor',
  'color-picker',
  'combobox',
  'date-input',
  'emoji-picker',
  'input',
  'number-input',
  'time-input',
  'locale-picker',
  'otp-input',
  'phone-input',
  'radio',
  'radio-button',
  'radio-group',
  'rubric-form',
  'select',
  'slider',
  'switch',
  'textarea',
  'time-range',
  'token-input',
  'rating',
  'known-date',
] as const;

describe('shared form-owner contract', () => {
  for (const name of FORM_CONTROL_NAMES) {
    it(`${name} accepts an owner id while form/getForm() reads stay element-valued`, () => {
      const owner = document.createElement('form');
      owner.id = `owner-${name}`;
      const control = document.createElement(tag(name)) as FormOwnerControl;
      document.body.append(owner, control);
      try {
        control.form = owner.id;
        expect(control.getAttribute('form')).to.equal(owner.id);
        expect(control.form?.id).to.equal(owner.id);
        expect(control.getForm()?.id).to.equal(owner.id);

        control.form = null;
        expect(control.hasAttribute('form')).to.be.false;
        expect(control.form).to.equal(null);
        expect(control.getForm()).to.equal(null);
      } finally {
        control.remove();
        owner.remove();
      }
    });
  }
});

describe('verified label omissions', () => {
  // icon-button is deliberately absent: post-cd4f2d22 it is a plain LyraElement with no
  // `formAssociated`/`attachInternals()` (see the FORM_CONTROL_NAMES comment above), so it never
  // gets the browser's ElementInternals-backed `.labels` -- a bare HTMLElement has no such property
  // at all, which is exactly the TypeError this parametrized case used to hit.
  for (const name of ['button', 'radio', 'checkbox-group', 'token-input'] as const) {
    it(`${name} exposes its associated labels`, () => {
      const label = document.createElement('label');
      const control = document.createElement(tag(name)) as HTMLElement & { labels: NodeList };
      control.id = `labelled-${name}`;
      label.htmlFor = control.id;
      label.textContent = name;
      document.body.append(label, control);
      try {
        expect(control.labels.length).to.equal(1);
        expect((control.labels.item(0) as HTMLLabelElement | null)?.htmlFor).to.equal(control.id);
      } finally {
        control.remove();
        label.remove();
      }
    });
  }
});

// icon-button is no longer part of FORM_CONTROL_NAMES at all (see its comment above), so it does
// not need to be named in this exclusion filter any more; 'button'/'time-range' remain since they
// are still form-owner participants that just don't carry a settable customError/validity surface.
const VALUE_CONTROL_NAMES = FORM_CONTROL_NAMES.filter(
  (name) => !['button', 'time-range'].includes(name),
);

describe('shared validity contract', () => {
  for (const name of VALUE_CONTROL_NAMES) {
    it(`${name} reflects custom-error and emits one lr-invalid alias`, () => {
      const control = document.createElement(tag(name)) as HTMLElement & {
        customError: string | null;
        validity: ValidityState;
        checkValidity(): boolean;
      };
      document.body.append(control);
      try {
        let aliases = 0;
        let bubbles = false;
        let composed = false;
        control.addEventListener('lr-invalid', (event) => {
          aliases += 1;
          bubbles = event.bubbles;
          composed = event.composed;
        });

        control.customError = 'Rejected by contract test';
        expect(control.getAttribute('custom-error')).to.equal('Rejected by contract test');
        expect(control.validity.customError).to.be.true;
        expect(control.checkValidity()).to.be.false;
        expect(aliases).to.equal(1);
        expect(bubbles && composed).to.be.true;

        control.customError = null;
        expect(control.hasAttribute('custom-error')).to.be.false;
        expect(control.validity.customError).to.be.false;
      } finally {
        control.remove();
      }
    });
  }
});
