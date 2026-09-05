import '../components/conversation/model-select/model-select.js';
import '../components/conversation/voice-picker/voice-picker.js';
import type { LyraModelSelect } from '../components/conversation/model-select/model-select.js';
import type { LyraVoicePicker } from '../components/conversation/voice-picker/voice-picker.js';


import { fixture, expect, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { LyraInput } from '../components/forms/input/input.js';
import type { LyraTextarea } from '../components/forms/textarea/textarea.js';
import type { LyraOtpInput } from '../components/forms/otp-input/otp-input.js';
import '../components/forms/input/input.js';
import '../components/forms/input/number-input.js';
import '../components/forms/input/native-time-input.js';
import '../components/forms/textarea/textarea.js';
import '../components/forms/otp-input/otp-input.js';
import { tag } from './prefix.js';
import { FormAssociated } from './form-associated.js';
import { LyraElement } from './lyra-element.js';

type Control = LyraInput | LyraTextarea | LyraOtpInput;
const names = ['input', 'number-input', 'native-time-input', 'textarea', 'otp-input'] as const;
async function mount(name: typeof names[number], legend = false) {
  const form = await fixture<HTMLFormElement>(html`<form><fieldset><legend>First</legend><legend>Second</legend></fieldset><button type="button">Outside</button></form>`);
  const fieldset = form.querySelector('fieldset')!;
  const control = document.createElement(tag(name)) as Control;
  control.name = 'value';
  control.required = true;
  control.setAttribute('aria-label', 'Value');
  if (legend) fieldset.querySelector('legend')!.append(control);
  else fieldset.append(control);
  await control.updateComplete;
  const native = control.shadowRoot!.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
  const outside = form.querySelector('button')!;
  return { form, fieldset, control, native, outside };
}

for (const name of names) {
  it(`${name}: retains real fieldset disablement through same-task own transitions`, async () => {
    const { form, fieldset, control, native, outside } = await mount(name);
    const events: string[] = [];
    for (const type of ['input', 'change', 'lr-input', 'lr-change']) control.addEventListener(type, () => events.push(type));
    control.disabled = true;
    fieldset.disabled = true;
    control.disabled = false;
    expect(control.disabled, 'own state remains false').to.be.false;
    expect(control.hasAttribute('disabled'), 'own attribute remains absent').to.be.false;
    expect(control.matches(':disabled'), 'native FACE state').to.be.true;
    expect(control.effectiveDisabled, 'same-task effective state').to.be.true;
    expect(control.willValidate, 'barred immediately').to.be.false;
    expect(control.validity.valueMissing, 'no intrinsic violation while barred').to.be.false;
    expect(new FormData(form).has('value'), 'omitted from submission').to.be.false;
    await control.updateComplete;
    expect(native.disabled, 'native editing surface is disabled').to.be.true;
    outside.focus();
    control.focus();
    expect(control.shadowRoot!.activeElement?.tagName ?? '', 'host focus is inert').to.equal('');
    await sendKeys({ type: '7' });
    expect(control.value, 'native typing cannot edit').to.equal('');
    expect(native.value).to.equal('');
    expect(events).to.deep.equal([]);
    fieldset.disabled = false;
    expect(control.effectiveDisabled, 'fieldset release works').to.be.false;
    expect(control.checkValidity(), 'required validation resumes').to.be.false;
    await control.updateComplete;
    expect(native.disabled).to.be.false;
    expect(new FormData(form).get('value')).to.equal('');
  });

  it(`${name}: native keyboard editing remains blocked after mixed disablement`, async () => {
    const { fieldset, control, native, outside } = await mount(name);
    control.value = name === 'native-time-input' ? '12:30' : '12';
    await control.updateComplete;
    const original = control.value;
    control.disabled = true;
    fieldset.disabled = true;
    control.disabled = false;
    await control.updateComplete;
    outside.focus();
    control.focus();
    if (name === 'native-time-input') await sendKeys({ press: 'ArrowUp' });
    else await sendKeys({ type: '7' });
    expect(control.value, 'disabled native edit leaves the value intact').to.equal(original);
    expect(native.value).to.equal(original);
    expect(native.disabled).to.be.true;
    fieldset.disabled = false;
    await control.updateComplete;
    control.focus();
    expect(control.shadowRoot!.activeElement === native).to.be.true;
    if (name === 'native-time-input') await sendKeys({ press: 'ArrowUp' });
    else await sendKeys({ type: '7' });
    if (name === 'native-time-input') {
      // Some native time widgets do not edit on ArrowUp. Compare this engine's real input.
      const reference = document.createElement('input');
      reference.type = 'time';
      reference.value = original;
      document.body.append(reference);
      try {
        reference.focus();
        await sendKeys({ press: 'ArrowUp' });
        expect(control.value, 'enabled time editing matches the native widget').to.equal(reference.value);
      } finally {
        reference.remove();
      }
    } else {
      expect(control.value, 'enabled native editing remains available').not.to.equal(original);
    }
  });

  it(`${name}: preserves the first-legend exception and explicit own state`, async () => {
    const { form, fieldset, control, native } = await mount(name, true);
    control.disabled = true;
    fieldset.disabled = true;
    control.disabled = false;
    expect(control.effectiveDisabled).to.be.false;
    expect(control.matches(':disabled')).to.be.false;
    expect(control.willValidate).to.be.true;
    expect(control.checkValidity()).to.be.false;
    expect(new FormData(form).has('value')).to.be.true;
    await control.updateComplete;
    expect(native.disabled).to.be.false;
    control.focus();
    expect(control.shadowRoot!.activeElement === native).to.be.true;
    control.disabled = true;
    fieldset.disabled = false;
    expect(control.disabled).to.be.true;
    expect(control.effectiveDisabled).to.be.true;
    expect(new FormData(form).has('value')).to.be.false;
    control.disabled = false;
    expect(control.effectiveDisabled).to.be.false;
    await control.updateComplete;
    expect(native.disabled).to.be.false;
  });

  it(`${name}: observes later same-task fieldset edges and second-legend cascading`, async () => {
    const { form, fieldset, control, native } = await mount(name);
    fieldset.querySelectorAll('legend')[1]!.append(control);
    await control.updateComplete;
    control.disabled = true;
    control.disabled = false;
    fieldset.disabled = true;
    expect(control.effectiveDisabled).to.be.true;
    expect(control.checkValidity()).to.be.true;
    expect(new FormData(form).has('value')).to.be.false;
    await control.updateComplete;
    expect(native.disabled).to.be.true;
    fieldset.disabled = false;
    expect(control.effectiveDisabled).to.be.false;
    expect(control.checkValidity()).to.be.false;
    await control.updateComplete;
    expect(native.disabled).to.be.false;
  });
}

class EchoControl extends FormAssociated(LyraElement) {
  override render() { return html``; }
}
customElements.define(tag('disabled-echo-control'), EchoControl);
for (const route of ['toggleAttribute', 'setAttribute/removeAttribute'] as const) {
  it(`shared helper: own ${route} edges request exactly one update each`, async () => {
    const control = await fixture<EchoControl>(html`<lr-disabled-echo-control></lr-disabled-echo-control>`);
    const original = control.requestUpdate;
    let requests = 0;
    control.requestUpdate = function (...args: Parameters<typeof original>) {
      requests++;
      return original.apply(this, args);
    };
    try {
      if (route === 'toggleAttribute') control.toggleAttribute('disabled', true);
      else control.setAttribute('disabled', '');
      expect(control.effectiveDisabled).to.be.true;
      expect(requests).to.equal(1);
      if (route === 'toggleAttribute') control.toggleAttribute('disabled', false);
      else control.removeAttribute('disabled');
      expect(control.effectiveDisabled).to.be.false;
      expect(requests).to.equal(2);
    } finally {
      control.requestUpdate = original;
    }
  });
}

for (const tag of ['lr-model-select', 'lr-voice-picker']) {
  for (const legacy of [false, true]) {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape']) {
      it(`keeps ${legacy ? 'legacy' : 'modern'} composing ${key} in the actual ${tag} catalog input`, async () => {
        const picker = await fixture<LyraModelSelect | LyraVoicePicker>(`<${tag} allow-custom></${tag}>`);
        picker.catalog = [{ id: 'alpha', label: 'Alpha' }, { id: 'beta', label: 'Beta' }];
        picker.value = 'alpha';
        await picker.updateComplete;
        const input = picker.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
        input.focus();
        input.value = key === 'Enter' ? 'Custom draft' : '';
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        await picker.updateComplete;
        expect(picker.open).to.be.true;
        const active = input.getAttribute('aria-activedescendant');
        let changes = 0;
        picker.addEventListener('lr-change', () => changes++);
        const event = new KeyboardEvent('keydown', {
          key, isComposing: !legacy, keyCode: legacy ? 229 : 0,
          bubbles: true, composed: true, cancelable: true,
        });
        input.dispatchEvent(event);
        await picker.updateComplete;
        expect(event.defaultPrevented).to.be.false;
        expect(picker.open).to.be.true;
        expect(picker.value).to.equal('alpha');
        expect(changes).to.equal(0);
        expect(picker.shadowRoot!.activeElement === input).to.be.true;
        expect(input.getAttribute('aria-activedescendant')).to.equal(active);
        if (key === 'Enter' || key === 'Escape') {
          input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
          await picker.updateComplete;
          expect(picker.open).to.be.false;
          expect(picker.value).to.equal(key === 'Enter' ? 'Custom draft' : 'alpha');
          expect(changes).to.equal(key === 'Enter' ? 1 : 0);
        }
      });
    }
  }
}
