import { expect, fixture, html } from '@open-wc/testing';
import type { LitElement } from 'lit';
import { tag, defineElement } from './prefix.js';
import { FormControlController } from './form-control-controller.js';
import { LyraElement } from './lyra-element.js';
import { VALIDITY_ANCHOR } from './anchored-validity.js';
import { LyraCheckbox } from '../components/forms/checkbox/checkbox.js';
import '../components/forms/switch/switch.js';
import '../components/forms/radio/radio.js';
import '../components/forms/radio/radio-group.js';
import '../components/forms/checkbox-group/checkbox-group.js';
import '../components/forms/select/select.js';
import '../components/forms/combobox/combobox.js';
import '../components/forms/locale-picker/locale-picker.js';
import '../components/forms/token-input/token-input.js';
import '../components/forms/slider/slider.js';
import '../components/forms/time-range/time-range.js';
import '../components/forms/rubric-form/rubric-form.js';
import '../components/forms/button/button.js';
import '../components/forms/input/input.js';
import '../components/overlays/rating/rating.js';
import '../components/media/file-input/file-input.js';
import '../components/conversation/model-select/model-select.js';
import '../components/conversation/voice-picker/voice-picker.js';
import '../components/agent-tools/tool-param-form/tool-param-form.js';
import '../components/data/graph-query-builder/graph-query-builder.js';

interface Control extends LitElement {
  name: string | null;
  disabled: boolean;
  readonly effectiveDisabled: boolean;
  readonly form: HTMLFormElement | null;
  readonly validationMessage: string;
  readonly validity: ValidityState;
  checkValidity(): boolean;
  setCustomValidity(message: string): void;
}

const controls = [
  'checkbox', 'switch', 'radio', 'radio-group', 'checkbox-group', 'select', 'combobox',
  'locale-picker', 'token-input', 'slider', 'time-range', 'rubric-form', 'button',
  'rating', 'file-input', 'model-select', 'voice-picker', 'tool-param-form',
  'graph-query-builder', 'input',
] as const;

for (const name of controls) {
  it(`${name} preserves custom errors, silent validation and synchronous disabled/name state`, async () => {
    const form = await fixture<HTMLFormElement>(html`<form><fieldset></fieldset></form>`);
    const fieldset = form.querySelector('fieldset')!;
    const control = document.createElement(tag(name)) as unknown as Control;
    fieldset.append(control);
    await control.updateComplete;
    control.name = 'entry';
    expect(control.getAttribute('name')).to.equal('entry');
    expect(control.form === form).to.equal(true);
    let aliases = 0;
    control.addEventListener('lr-invalid', (event) => { aliases++; event.preventDefault(); });
    control.setCustomValidity('Review this value');
    expect(control.checkValidity()).to.equal(false);
    expect(aliases).to.equal(1);
    expect(control.matches(':state(user-invalid)')).to.equal(false);
    form.reset();
    expect(control.validationMessage).to.equal('Review this value');
    control.disabled = true;
    expect(control.effectiveDisabled).to.equal(true);
    if (name === 'button') expect(control.matches(':state(disabled)')).to.equal(true);
    expect(control.checkValidity()).to.equal(true);
    fieldset.disabled = true;
    control.disabled = false;
    expect(control.hasAttribute('disabled')).to.equal(false);
    expect(control.effectiveDisabled).to.equal(true);
    expect(control.checkValidity()).to.equal(true);
    fieldset.disabled = false;
    expect(control.effectiveDisabled).to.equal(false);
    control.setAttribute('disabled', '');
    expect(control.effectiveDisabled).to.equal(true);
    control.removeAttribute('disabled');
    expect(control.effectiveDisabled).to.equal(false);
    control.setCustomValidity('');
    expect(control.validity.customError).to.equal(false);
    control.name = '';
    expect(control.hasAttribute('name')).to.equal(false);
  });
}

it('preserves native toggleAttribute behavior while ignoring disabled-reaction echoes', async () => {
  const control = await fixture<LyraCheckbox>(html`<lr-checkbox required></lr-checkbox>`);
  const internals = control as unknown as { updateValidity(): void };
  const original = internals.updateValidity;
  let updates = 0;
  internals.updateValidity = function () { updates++; original.call(this); };
  try {
    control.toggleAttribute('disabled');
    const disableUpdates = updates;
    expect(control.disabled).to.equal(true);
    expect(disableUpdates).to.equal(1);
    control.toggleAttribute('disabled');
    expect(control.disabled).to.equal(false);
    expect(updates - disableUpdates).to.equal(1);
    expect(control.validity.valueMissing).to.equal(true);
    control.setAttribute('DISABLED', '');
    expect(control.disabled).to.equal(true);
    control.removeAttribute('DISABLED');
    expect(control.disabled).to.equal(false);
    expect(control.effectiveDisabled).to.equal(false);
    expect(control.toggleAttribute('data-example')).to.equal(true);
    expect(control.toggleAttribute('data-example')).to.equal(false);
  } finally {
    internals.updateValidity = original;
  }
});

it('keeps checked defaults and submitted tokens independent through reset', async () => {
  const form = await fixture<HTMLFormElement>(html`<form>
    <lr-checkbox name="accepted" value="yes" checked></lr-checkbox>
  </form>`);
  const checkbox = form.querySelector<LyraCheckbox>(tag('checkbox'))!;
  await checkbox.updateComplete;
  checkbox.checked = false;
  expect(new FormData(form).has('accepted')).to.equal(false);
  checkbox.value = 'confirmed';
  form.reset();
  expect(checkbox.checked).to.equal(true);
  expect(new FormData(form).get('accepted')).to.equal('confirmed');
});

class FallbackCheckbox extends LyraCheckbox {
  override attachInternals(): ElementInternals {
    throw new DOMException('Unavailable', 'NotSupportedError');
  }
}
defineElement('form-core-fallback-checkbox', FallbackCheckbox);

it('constructs safely with unavailable native internals and retains custom validity', async () => {
  const control = await fixture<FallbackCheckbox>(html`<lr-form-core-fallback-checkbox></lr-form-core-fallback-checkbox>`);
  control.setCustomValidity('Review this value');
  expect(control.validity.customError).to.equal(true);
  expect(control.validationMessage).to.equal('Review this value');
  control.formResetCallback();
  expect(control.validationMessage).to.equal('Review this value');
  control.setCustomValidity('');
  expect(control.validity.customError).to.equal(false);
});

class NativeConstraintControl extends LyraElement {
  static formAssociated = true;
  static override properties = { pattern: {} };
  pattern = '.*';
  readonly toggleArgumentCounts: number[] = [];
  override toggleAttribute(...args: Parameters<HTMLElement['toggleAttribute']>): boolean {
    this.toggleArgumentCounts.push(args.length);
    return super.toggleAttribute(...args);
  }
  private readonly validation = new FormControlController(this);
  [VALIDITY_ANCHOR](): HTMLElement | null { return this.renderRoot.querySelector('input'); }
  setCustomValidity(message: string): void { this.validation.setCustomValidity(message); }
  checkValidity(): boolean {
    return this.validation.checkValidity(() => {
      const input = this.renderRoot.querySelector('input')!;
      this.validation.setValidity(
        input.validity.valid ? {} : { patternMismatch: input.validity.patternMismatch },
        input.validationMessage,
      );
    });
  }
  override render() { return html`<input pattern=${this.pattern} value="abc">`; }
}
defineElement('form-core-native-constraint', NativeConstraintControl);

it('flushes changed native constraints before synchronous validation', async () => {
  const control = await fixture<NativeConstraintControl>(html`<lr-form-core-native-constraint></lr-form-core-native-constraint>`);
  expect(control.checkValidity()).to.equal(true);
  control.pattern = '[0-9]+';
  expect(control.checkValidity()).to.equal(false);
  control.pattern = '[a-z]+';
  expect(control.checkValidity()).to.equal(true);
});

it('honors the first legend exception when own disabled state changes', async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`<fieldset disabled>
    <legend><lr-checkbox></lr-checkbox></legend>
    <lr-checkbox></lr-checkbox>
  </fieldset>`);
  const [legend, ordinary] = [...fieldset.querySelectorAll<LyraCheckbox>(tag('checkbox'))];
  await Promise.all([legend!.updateComplete, ordinary!.updateComplete]);
  for (const control of [legend!, ordinary!]) {
    control.disabled = true;
    control.disabled = false;
  }
  expect(legend!.effectiveDisabled).to.equal(false);
  expect(ordinary!.effectiveDisabled).to.equal(true);
});

it('preserves toggleAttribute argument counts through a subclass override', async () => {
  const control = await fixture<NativeConstraintControl>(html`<lr-form-core-native-constraint></lr-form-core-native-constraint>`);
  control.toggleArgumentCounts.length = 0;
  expect(control.toggleAttribute('data-example')).to.equal(true);
  expect(control.toggleAttribute('data-example')).to.equal(false);
  control.toggleAttribute('data-example', undefined);
  control.toggleAttribute('data-example', true);
  expect(control.toggleArgumentCounts).to.deep.equal([1, 1, 2, 2]);
});
