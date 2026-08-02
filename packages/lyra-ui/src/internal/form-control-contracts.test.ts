import { expect } from '@open-wc/testing';
import { tag } from './prefix.js';
import type { FormOwnerValue } from './form-associated.js';

import '../components/agent-tools/tool-param-form/tool-param-form.js';
import '../components/conversation/chat-composer/chat-composer.js';
import '../components/conversation/model-select/model-select.js';
import '../components/conversation/voice-picker/voice-picker.js';
import '../components/data/graph-query-builder/graph-query-builder.js';
import '../components/forms/button/button.js';
import '../components/forms/checkbox-group/checkbox-group.js';
import '../components/forms/checkbox/checkbox.js';
import '../components/forms/code-editor/code-editor.js';
import '../components/forms/color-picker/color-picker.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/date-picker/date-input.js';
import '../components/forms/emoji-picker/emoji-picker.js';
import '../components/forms/icon-button/icon-button.js';
import '../components/forms/input/input.js';
import '../components/forms/input/number-input.js';
import '../components/forms/input/time-input.js';
import '../components/forms/locale-picker/locale-picker.js';
import '../components/forms/otp-input/otp-input.js';
import '../components/forms/phone-input/phone-input.js';
import '../components/forms/radio/radio.js';
import '../components/forms/radio/radio-button.js';
import '../components/forms/radio/radio-group.js';
import '../components/forms/rubric-form/rubric-form.js';
import '../components/forms/select/select.js';
import '../components/forms/slider/slider.js';
import '../components/forms/switch/switch.js';
import '../components/forms/textarea/textarea.js';
import '../components/forms/time-range/time-range.js';
import '../components/forms/token-input/token-input.js';
import '../components/overlays/rating/rating.js';
import '../components/utility/known-date/known-date.js';

interface FormOwnerControl extends HTMLElement {
  get form(): HTMLFormElement | null;
  set form(owner: FormOwnerValue);
  getForm(): HTMLFormElement | null;
}

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
  'icon-button',
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
  for (const name of ['button', 'icon-button', 'radio', 'checkbox-group', 'token-input'] as const) {
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

const VALUE_CONTROL_NAMES = FORM_CONTROL_NAMES.filter(
  (name) => !['button', 'icon-button', 'time-range'].includes(name),
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
