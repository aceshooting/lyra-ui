import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { expectValidAriaRules } from '../../../../test/aria-rules.js';
import './select.js';
import '../color-picker/color-picker.js';
import type { LyraSelect } from './select.js';
import type { LyraColorPicker } from '../color-picker/color-picker.js';

function descriptions(control: HTMLElement): string {
  const elements = control.ariaDescribedByElements ??
    (control.getAttribute('aria-describedby')?.match(/\S+/g) ?? []).map((id) =>
      (control.getRootNode() as ShadowRoot).getElementById(id));
  return elements.map((element) => element?.textContent ?? '').join(' ');
}

it('renders the unregistered English required cue on the color button', async () => {
  const picker = await fixture<LyraColorPicker>(html`<lr-color-picker
    label="Accent" locale="en" required
  ></lr-color-picker>`);
  const trigger = picker.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
  expect(descriptions(trigger)).to.include('This field is required.');
});

it('renders the unregistered English required cue on the single-option button', async () => {
  const picker = await fixture<LyraSelect>(html`<lr-select
    label="Choice" locale="en" required auto-commit-single-option
  ><lr-option value="one">One</lr-option></lr-select>`);
  const trigger = picker.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
  expect(trigger.getAttribute('role')).to.equal('button');
  expect(descriptions(trigger)).to.include('This field is required.');
});

it('describes required color selection on its button and preserves the editable required state', async () => {
  const container = await fixture<HTMLFormElement>(html`<form>
    <span id="color-guidance">External color guidance</span>
    <lr-color-picker label="Accent" required hint="Color hint" error-text="Color error"
      aria-describedby="color-guidance" .strings=${{ fieldRequired: 'Choose a required color.' }}
    ></lr-color-picker>
  </form>`);
  const picker = container.querySelector<LyraColorPicker>('lr-color-picker')!;
  await picker.updateComplete;
  const trigger = picker.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
  await expectValidAriaRules(picker, ['aria-allowed-attr']);
  expect(trigger.hasAttribute('aria-required')).to.equal(false);
  expect(descriptions(trigger)).to.include('Choose a required color.').and.include('Color hint').and.include('Color error');
  if ('ariaDescribedByElements' in trigger) expect(descriptions(trigger)).to.include('External color guidance');
  expect(picker.validity.valueMissing).to.equal(true);
  picker.open = true;
  await picker.updateComplete;
  expect(picker.shadowRoot!.querySelector('[part="input"]')!.getAttribute('aria-required')).to.equal('true');
  picker.value = '#ff0000';
  await picker.updateComplete;
  expect(picker.validity.valueMissing).to.equal(false);
  container.reset();
  await picker.updateComplete;
  expect(picker.validity.valueMissing).to.equal(true);
  picker.required = false;
  await picker.updateComplete;
  expect(descriptions(trigger)).not.to.include('Choose a required color.');
  expect(picker.shadowRoot!.querySelector('[part="input"]')!.getAttribute('aria-required')).to.equal('false');
  picker.required = true;
  picker.inline = true;
  await picker.updateComplete;
  expect(picker.shadowRoot!.querySelector('[part="trigger"]') === null).to.equal(true);
  expect(picker.shadowRoot!.querySelector('[part="input"]')!.getAttribute('aria-required')).to.equal('true');
});

it('keeps required information as an opted-in single-option select changes semantic modes', async () => {
  const container = await fixture<HTMLFormElement>(html`<form>
    <span id="selection-guidance">External selection guidance</span>
    <lr-select label="Choice" required auto-commit-single-option hint="Choice hint" error-text="Choice error"
      aria-describedby="selection-guidance" .strings=${{ fieldRequired: 'Choose a required option.' }}
    ><lr-option value="one">One</lr-option></lr-select>
  </form>`);
  const picker = container.querySelector<LyraSelect>('lr-select')!;
  await picker.updateComplete;
  const trigger = picker.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
  expect(trigger.getAttribute('role')).to.equal('button');
  await expectValidAriaRules(picker, ['aria-allowed-attr']);
  expect(trigger.hasAttribute('aria-required')).to.equal(false);
  expect(descriptions(trigger)).to.include('Choose a required option.').and.include('Choice hint').and.include('Choice error');
  if ('ariaDescribedByElements' in trigger) expect(descriptions(trigger)).to.include('External selection guidance');
  expect(picker.validity.valueMissing).to.equal(true);
  trigger.click();
  await picker.updateComplete;
  expect(picker.value).to.equal('one');
  expect(picker.validity.valueMissing).to.equal(false);
  container.reset();
  await picker.updateComplete;
  expect(picker.validity.valueMissing).to.equal(true);
  const second = document.createElement('lr-option');
  second.value = 'two';
  second.textContent = 'Two';
  picker.append(second);
  await waitUntil(() => trigger.getAttribute('role') === 'combobox');
  expect(trigger.getAttribute('aria-required')).to.equal('true');
  expect(descriptions(trigger)).not.to.include('Choose a required option.');
  second.remove();
  await waitUntil(() => trigger.getAttribute('role') === 'button');
  expect(descriptions(trigger)).to.include('Choose a required option.');
  picker.autoCommitSingleOption = false;
  await picker.updateComplete;
  expect(trigger.getAttribute('role')).to.equal('combobox');
  expect(trigger.getAttribute('aria-required')).to.equal('true');
  expect(descriptions(trigger)).not.to.include('Choose a required option.');
  picker.autoCommitSingleOption = true;
  picker.required = false;
  await picker.updateComplete;
  expect(trigger.getAttribute('role')).to.equal('button');
  expect(trigger.hasAttribute('aria-required')).to.equal(false);
  expect(descriptions(trigger)).not.to.include('Choose a required option.');
});
