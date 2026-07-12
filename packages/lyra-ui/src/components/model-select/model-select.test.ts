import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './model-select.js';
import type { LyraModelSelect } from './model-select.js';

const CATALOG = ['llama3.1', 'mistral', 'qwen2.5-coder'];
const OBJECT_CATALOG = [
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
];

function trigger(el: LyraModelSelect): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}
function input(el: LyraModelSelect): HTMLInputElement {
  return el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
}
function rows(el: LyraModelSelect): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

// -- Mode selection ---------------------------------------------------------

it('renders a closed dropdown (trigger button) when catalog is non-empty and allow-custom is unset', async () => {
  const el = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
  expect(trigger(el)).to.exist;
  expect(el.shadowRoot!.querySelector('[part="combobox-input"]')).to.be.null;
});

it('renders a free-text input when catalog is empty/undefined', async () => {
  const el = (await fixture(html`<lyra-model-select></lyra-model-select>`)) as LyraModelSelect;
  expect(input(el)).to.exist;
  expect(el.shadowRoot!.querySelector('[part="trigger"]')).to.be.null;
});

it('renders a free-text input when allow-custom is set, even with a non-empty catalog', async () => {
  const el = (await fixture(
    html`<lyra-model-select allow-custom .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  expect(input(el)).to.exist;
  expect(el.shadowRoot!.querySelector('[part="trigger"]')).to.be.null;
});

it('treats each string in a plain string[] catalog as both id and label', async () => {
  const el = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
  expect(rows(el)[0].textContent).to.contain('llama3.1');
});

it('renders id/label object catalog rows by their label', async () => {
  const el = (await fixture(
    html`<lyra-model-select .catalog=${OBJECT_CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
  expect(rows(el)[0].textContent).to.contain('GPT-4.1');
  expect(rows(el)[0].dataset.value).to.equal('gpt-4.1');
});

// -- Closed-dropdown mode -----------------------------------------------

it('opens the closed dropdown by clicking the trigger and selects an option, emitting lyra-change', async () => {
  const el = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  let detail: { value: string; inCatalog: boolean } | undefined;
  el.addEventListener('lyra-change', (e) => (detail = (e as CustomEvent).detail));
  setTimeout(() => rows(el)[1].click());
  await oneEvent(el, 'lyra-change');
  expect(el.value).to.equal('mistral');
  expect(el.open).to.be.false;
  expect(detail).to.deep.equal({ value: 'mistral', inCatalog: true });
});

it('navigates the closed dropdown with ArrowDown and commits with Enter', async () => {
  const el = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
  const btn = trigger(el);
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await oneEvent(el, 'lyra-change');
  expect(el.value).to.equal('llama3.1');
});

it('jumps to the last row with End and commits it', async () => {
  const el = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  await el.updateComplete;
  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await oneEvent(el, 'lyra-change');
  expect(el.value).to.equal('qwen2.5-coder');
});

it('closes the closed dropdown on Escape without changing the value', async () => {
  const el = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
  const btn = trigger(el);
  el.value = 'mistral';
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.value).to.equal('mistral');
});

it('shows a synthetic, distinctly-marked row for a stale value not present in the catalog', async () => {
  const el = (await fixture(
    html`<lyra-model-select value="ancient-model" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;

  const all = rows(el);
  expect(all.length).to.equal(4);
  const synthetic = all[all.length - 1];
  expect(synthetic.dataset.value).to.equal('ancient-model');
  expect(synthetic.hasAttribute('data-synthetic')).to.be.true;
  expect(synthetic.querySelector('[part="option-badge"]')).to.exist;
  // The trigger label still shows the stale value's text, unmarked.
  expect(trigger(el).textContent).to.contain('ancient-model');
});

it('does not append a synthetic row when catalog is empty, even for a set value', async () => {
  const el = (await fixture(html`<lyra-model-select value="anything"></lyra-model-select>`)) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
  expect(rows(el).length).to.equal(0);
});

// -- Free-text mode -------------------------------------------------------

it('filters suggestions by id/label substring, case-insensitively, as the user types', async () => {
  const el = (await fixture(
    html`<lyra-model-select allow-custom .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = 'QWEN';
  inp.dispatchEvent(new Event('input'));
  await el.updateComplete;

  const visible = rows(el);
  expect(visible.length).to.equal(1);
  expect(visible[0].textContent).to.contain('qwen2.5-coder');
});

it('commits a highlighted suggestion with Enter, emitting lyra-change with inCatalog true', async () => {
  const el = (await fixture(
    html`<lyra-model-select allow-custom .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  await el.updateComplete;
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;

  let detail: { value: string; inCatalog: boolean } | undefined;
  el.addEventListener('lyra-change', (e) => (detail = (e as CustomEvent).detail));
  setTimeout(() =>
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'lyra-change');
  expect(el.value).to.equal('llama3.1');
  expect(detail).to.deep.equal({ value: 'llama3.1', inCatalog: true });
});

it('commits raw typed text not in the catalog when allow-custom is set, with inCatalog false', async () => {
  const el = (await fixture(
    html`<lyra-model-select allow-custom .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = 'my-custom-model';
  inp.dispatchEvent(new Event('input'));
  await el.updateComplete;

  let detail: { value: string; inCatalog: boolean } | undefined;
  el.addEventListener('lyra-change', (e) => (detail = (e as CustomEvent).detail));
  setTimeout(() =>
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'lyra-change');
  expect(el.value).to.equal('my-custom-model');
  expect(detail).to.deep.equal({ value: 'my-custom-model', inCatalog: false });
});

it('commits arbitrary typed text when there is no catalog at all', async () => {
  const el = (await fixture(html`<lyra-model-select></lyra-model-select>`)) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = 'whatever-i-want';
  inp.dispatchEvent(new Event('input'));
  await el.updateComplete;

  setTimeout(() =>
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'lyra-change');
  expect(el.value).to.equal('whatever-i-want');
});

it('reverts typed text back to the current value on Escape, without committing', async () => {
  const el = (await fixture(
    html`<lyra-model-select allow-custom value="mistral" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  await el.updateComplete;
  inp.value = 'something-else-entirely';
  inp.dispatchEvent(new Event('input'));
  await el.updateComplete;
  expect(el.open).to.be.true;

  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.value).to.equal('mistral');
  expect(input(el).value).to.equal('mistral');
});

it('shows a synthetic suggestion for a stale value in free-text mode', async () => {
  const el = (await fixture(
    html`<lyra-model-select allow-custom value="ancient-model" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  await el.updateComplete;

  const all = rows(el);
  const synthetic = Array.from(all).find((r) => r.dataset.value === 'ancient-model');
  expect(synthetic).to.exist;
  expect(synthetic!.hasAttribute('data-synthetic')).to.be.true;
});

// -- Form participation -----------------------------------------------------

it('participates in a form: value reflects in FormData on submit', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-model-select name="model" .catalog=${CATALOG}></lyra-model-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-model-select') as LyraModelSelect;
  el.value = 'mistral';
  await el.updateComplete;
  expect(new FormData(form).get('model')).to.equal('mistral');
});

it('blocks a required, empty model-select from submitting the form', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-model-select name="model" required .catalog=${CATALOG}></lyra-model-select>
    </form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it('allows a required model-select to submit once a value is set', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-model-select name="model" required .catalog=${CATALOG}></lyra-model-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-model-select') as LyraModelSelect;
  el.value = 'mistral';
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('restores the declared default value (initial value attribute) on form.reset()', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-model-select name="model" value="llama3.1" .catalog=${CATALOG}></lyra-model-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-model-select') as LyraModelSelect;
  await el.updateComplete;
  el.value = 'mistral';
  await el.updateComplete;
  form.reset();
  expect(el.value).to.equal('llama3.1');
});

it('temporarily disables both modes through a fieldset without overwriting author state', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lyra-model-select name="model" value="mistral" .catalog=${CATALOG}></lyra-model-select>
        <lyra-model-select name="custom-model" value="custom" allow-custom .catalog=${CATALOG}></lyra-model-select>
        <lyra-model-select name="always-disabled" value="llama3.1" disabled .catalog=${CATALOG}></lyra-model-select>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-model-select') as LyraModelSelect;
  const freeText = form.querySelector('[name="custom-model"]') as LyraModelSelect;
  const explicitlyDisabled = form.querySelector('[name="always-disabled"]') as LyraModelSelect;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await Promise.all([el.updateComplete, freeText.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(new FormData(form).get('model')).to.equal('mistral');
  expect(new FormData(form).get('custom-model')).to.equal('custom');
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  fieldset.disabled = true;
  await Promise.all([el.updateComplete, freeText.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled, 'fieldset state must not mutate the public property').to.be.false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(freeText.effectiveDisabled).to.be.true;
  expect(trigger(el).disabled).to.be.true;
  expect(input(freeText).disabled).to.be.true;
  expect(el.open, 'disabling an open control closes its interactive popup').to.be.false;
  expect(getComputedStyle(trigger(el)).cursor).to.equal('not-allowed');
  expect(new FormData(form).get('model')).to.equal(null);
  expect(new FormData(form).get('custom-model')).to.equal(null);

  fieldset.disabled = false;
  await Promise.all([el.updateComplete, freeText.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(freeText.effectiveDisabled).to.be.false;
  expect(trigger(el).disabled).to.be.false;
  expect(input(freeText).disabled).to.be.false;
  expect(new FormData(form).get('model')).to.equal('mistral');
  expect(new FormData(form).get('custom-model')).to.equal('custom');

  expect(explicitlyDisabled.disabled, 'an explicit disabled state survives the fieldset cycle').to.be.true;
  expect(explicitlyDisabled.effectiveDisabled).to.be.true;
  expect(new FormData(form).get('always-disabled')).to.equal(null);
});

// -- Misc --------------------------------------------------------------

it('renders the provider badge when provider is set', async () => {
  const el = (await fixture(
    html`<lyra-model-select provider="ollama" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  expect(el.shadowRoot!.querySelector('[part="provider-badge"]')!.textContent).to.equal('ollama');
});

it('closes the popup on a pointerdown outside the element', async () => {
  const el = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('does not open when disabled', async () => {
  const el = (await fixture(
    html`<lyra-model-select disabled .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

// -- Accessibility -------------------------------------------------------

it('is accessible (closed dropdown, default and open)', async () => {
  const el = (await fixture(
    html`<lyra-model-select placeholder="Pick a model" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  await expect(el).to.be.accessible();

  el.open = true;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible (free-text mode, default and open)', async () => {
  const el = (await fixture(
    html`<lyra-model-select placeholder="Type a model" allow-custom .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  await expect(el).to.be.accessible();

  el.open = true;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
