import { fixture, expect, html } from '@open-wc/testing';
import './token-input.js';
import type { LyraTokenInput } from './token-input.js';

it('adds and removes tokens with the keyboard', async () => {
  const el = (await fixture(html`<lyra-token-input></lyra-token-input>`)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'alpha'; input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.value).to.deep.equal(['alpha']);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
  expect(el.value).to.deep.equal([]);
});

it('is form-associated and validates required values', async () => {
  const el = (await fixture(html`<lyra-token-input required></lyra-token-input>`)) as LyraTokenInput;
  expect(el.checkValidity()).to.be.false;
  el.value = ['ready'];
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;
});

it('is accessible', async () => {
  const el = await fixture(html`<lyra-token-input label="Recipients"></lyra-token-input>`);
  await expect(el).to.be.accessible();
});

it('interpolates the remove button accessible name with the token label', async () => {
  const el = (await fixture(html`<lyra-token-input .value=${['alpha']}></lyra-token-input>`)) as LyraTokenInput;
  const removeBtn = el.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement;
  expect(removeBtn.getAttribute('aria-label')).to.equal('Remove alpha');
});

it('localizes the remove button accessible name via .strings', async () => {
  const el = (await fixture(
    html`<lyra-token-input .value=${['alpha']} .strings=${{ removeWithContext: 'Retirer {label}' }}></lyra-token-input>`,
  )) as LyraTokenInput;
  const removeBtn = el.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement;
  expect(removeBtn.getAttribute('aria-label')).to.equal('Retirer alpha');
});

it('renders label/hint/error content passed through named slots', async () => {
  const el = (await fixture(html`
    <lyra-token-input>
      <span slot="label">Recipients</span>
      <span slot="hint">Press enter to add</span>
      <span slot="error">Required</span>
    </lyra-token-input>
  `)) as LyraTokenInput;
  const labelPart = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(labelPart.hidden).to.be.false;
  expect(hintPart.hidden).to.be.false;
  expect(errorPart.hidden).to.be.false;
  const labelSlot = labelPart.querySelector('slot[name="label"]') as HTMLSlotElement;
  const hintSlot = hintPart.querySelector('slot[name="hint"]') as HTMLSlotElement;
  const errorSlot = errorPart.querySelector('slot[name="error"]') as HTMLSlotElement;
  expect((labelSlot.assignedElements()[0] as HTMLElement).textContent).to.equal('Recipients');
  expect((hintSlot.assignedElements()[0] as HTMLElement).textContent).to.equal('Press enter to add');
  expect((errorSlot.assignedElements()[0] as HTMLElement).textContent).to.equal('Required');
});

it('applies the label styling to the actual rendered form-control-label part', async () => {
  const el = (await fixture(html`<lyra-token-input label="Recipients"></lyra-token-input>`)) as LyraTokenInput;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label).fontWeight).to.equal('600');
});

it('cascades disabled state from an ancestor fieldset without mutating the disabled property', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lyra-token-input></lyra-token-input>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-token-input') as LyraTokenInput;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await el.updateComplete;
  expect(el.effectiveDisabled).to.be.false;

  fieldset.disabled = true;
  await el.updateComplete;
  expect(el.disabled, 'fieldset state must not mutate the public property').to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.disabled).to.be.true;

  fieldset.disabled = false;
  await el.updateComplete;
  expect(el.effectiveDisabled).to.be.false;
  expect(input.disabled).to.be.false;
});

it('submits under a programmatically assigned name in the same tick', async () => {
  const form = (await fixture(html`
    <form><lyra-token-input .value=${['alpha', 'beta']}></lyra-token-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-token-input') as LyraTokenInput;

  el.name = 'tags';
  expect(el.getAttribute('name')).to.equal('tags');
  expect(new FormData(form).getAll('tags')).to.deep.equal(['alpha', 'beta']);

  el.name = 'labels';
  const renamed = new FormData(form);
  expect(renamed.has('tags'), 'the old name must not still hold entries').to.be.false;
  expect(renamed.getAll('labels')).to.deep.equal(['alpha', 'beta']);

  el.name = '';
  expect(el.hasAttribute('name')).to.be.false;
  expect(el.name).to.equal('');
  expect(new FormData(form).has('labels')).to.be.false;

  el.setAttribute('name', 'from-attribute');
  expect(el.name).to.equal('from-attribute');
  expect(new FormData(form).getAll('from-attribute')).to.deep.equal(['alpha', 'beta']);
  el.removeAttribute('name');
  expect(el.name).to.equal('');
  expect(new FormData(form).has('from-attribute')).to.be.false;
});

it('updates validity synchronously when required changes, with no await', async () => {
  const el = (await fixture(html`<lyra-token-input></lyra-token-input>`)) as LyraTokenInput;
  expect(el.checkValidity()).to.be.true;

  el.required = true;
  expect(el.hasAttribute('required')).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.value = ['ready'];
  expect(el.checkValidity()).to.be.true;

  el.value = [];
  el.required = false;
  expect(el.checkValidity()).to.be.true;
});

it('applies and removes explicit disabled form state synchronously, with no await', async () => {
  const form = (await fixture(html`
    <form><lyra-token-input name="tags" .value=${['alpha']}></lyra-token-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-token-input') as LyraTokenInput;
  expect(new FormData(form).getAll('tags')).to.deep.equal(['alpha']);

  el.disabled = true;
  expect(el.hasAttribute('disabled'), 'the host attribute must be set synchronously').to.be.true;
  expect(el.effectiveDisabled).to.be.true;
  expect(new FormData(form).has('tags'), 'a disabled control must be omitted from FormData').to.be.false;

  el.disabled = false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(new FormData(form).getAll('tags')).to.deep.equal(['alpha']);
});

it('commits the draft on Tab without trapping focus for an extra keystroke', async () => {
  const el = (await fixture(html`<lyra-token-input></lyra-token-input>`)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'alpha';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  input.dispatchEvent(event);
  await el.updateComplete;
  expect(el.value).to.deep.equal(['alpha']);
  expect(event.defaultPrevented, 'Tab must not be prevented so native focus-advance still happens').to.be.false;
});
