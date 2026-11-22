import { expect, fixture, html } from '@open-wc/testing';
import { tag } from './prefix.js';
import '../components/lr-input.js';
import '../components/lr-number-input.js';
import '../components/lr-native-time-input.js';
import '../components/lr-date-input.js';
import '../components/lr-time-input.js';
import '../components/lr-phone-input.js';
import '../components/lr-textarea.js';
import '../components/lr-chat-composer.js';
import '../components/lr-known-date.js';
import '../components/lr-code-editor.js';
import '../components/lr-color-picker.js';
import '../components/lr-emoji-picker.js';
import '../components/lr-currency-picker.js';
import '../components/lr-unit-picker.js';
import '../components/lr-time-zone-picker.js';

interface RequiredControl extends HTMLElement {
  required: boolean;
  updateComplete: Promise<unknown>;
  reportValidity(): boolean;
}

// Every control below documents the six validity states with `@cssstate`; this pins that each one
// really publishes them, so the manifest (and the migrate-wa `[data-user-invalid]` rewrite that
// reads it) cannot drift from runtime behaviour.
const CONTROLS = [
  'input', 'number-input', 'native-time-input', 'date-input', 'time-input', 'phone-input',
  'textarea', 'chat-composer', 'known-date', 'code-editor', 'color-picker', 'emoji-picker',
  'currency-picker', 'unit-picker', 'time-zone-picker',
];

const states = (el: Element) =>
  ['required', 'optional', 'valid', 'invalid', 'user-valid', 'user-invalid'].filter(name =>
    el.matches(`:state(${name})`));

describe('validity custom states on form controls', () => {
  for (const name of CONTROLS) {
    it(`${name} publishes required/invalid pristine and user-invalid after interaction`, async () => {
      const form = await fixture<HTMLFormElement>(html`<form></form>`);
      const control = document.createElement(tag(name)) as RequiredControl;
      form.append(control);
      await control.updateComplete;
      expect(states(control)).to.include('optional');
      expect(states(control)).to.not.include('required');
      control.required = true;
      await control.updateComplete;
      expect(states(control).join()).to.equal('required,invalid');
      expect(control.reportValidity()).to.equal(false);
      await control.updateComplete;
      expect(states(control).join()).to.equal('required,invalid,user-invalid');
    });
  }
});
