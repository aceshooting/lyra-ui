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

it('localizes the synthetic-row "not in catalog" badge via this.localize(), not hardcoded English', async () => {
  const el = (await fixture(
    html`<lyra-model-select
      value="ancient-model"
      .catalog=${CATALOG}
      .strings=${{ notInCatalog: 'absent du catalogue' }}
    ></lyra-model-select>`,
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
  const synthetic = rows(el)[rows(el).length - 1];
  expect(synthetic.querySelector('[part="option-badge"]')!.textContent).to.equal('absent du catalogue');
});

it('defaults to English "not in catalog" when no strings override is set', async () => {
  const el = (await fixture(
    html`<lyra-model-select value="ancient-model" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
  const synthetic = rows(el)[rows(el).length - 1];
  expect(synthetic.querySelector('[part="option-badge"]')!.textContent).to.equal('not in catalog');
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

it('is present in FormData as "" when never touched, like a native <input>', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-model-select name="model" .catalog=${CATALOG}></lyra-model-select>
    </form>
  `)) as HTMLFormElement;
  const fd = new FormData(form);
  expect(fd.has('model')).to.be.true;
  expect(fd.get('model')).to.equal('');
});

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

it('updates disabled form participation synchronously without awaiting a Lit update', async () => {
  const form = (await fixture(html`
    <form><lyra-model-select name="model" .catalog=${CATALOG}></lyra-model-select></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-model-select') as LyraModelSelect;
  el.value = 'mistral';
  expect(new FormData(form).get('model')).to.equal('mistral');

  el.disabled = true;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(new FormData(form).has('model')).to.be.false;

  el.disabled = false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(new FormData(form).get('model')).to.equal('mistral');
});

it('submits under a programmatically assigned name in the same tick', async () => {
  const form = (await fixture(html`
    <form><lyra-model-select value="mistral" .catalog=${CATALOG}></lyra-model-select></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-model-select') as LyraModelSelect;

  el.name = 'first';
  expect(el.getAttribute('name')).to.equal('first');
  expect(new FormData(form).get('first')).to.equal('mistral');

  el.name = 'second';
  const renamed = new FormData(form);
  expect(renamed.has('first')).to.be.false;
  expect(renamed.get('second')).to.equal('mistral');

  el.name = '';
  expect(el.hasAttribute('name')).to.be.false;
  expect(el.name).to.equal('');
  expect(new FormData(form).has('second')).to.be.false;

  el.setAttribute('name', 'from-attribute');
  expect(el.name).to.equal('from-attribute');
  expect(new FormData(form).get('from-attribute')).to.equal('mistral');
  el.removeAttribute('name');
  expect(el.name).to.equal('');
  expect(new FormData(form).has('from-attribute')).to.be.false;
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

it('rebinds the validity focus anchor when switching from trigger to free-text mode', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before model select</button>
      <lyra-model-select name="model" required .catalog=${CATALOG}></lyra-model-select>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button') as HTMLButtonElement;
  const el = form.querySelector('lyra-model-select') as LyraModelSelect;
  let submitCount = 0;
  form.addEventListener('submit', (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lyra-model-select');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');

  el.allowCustom = true;
  await el.updateComplete;
  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lyra-model-select');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('combobox-input');
});

it('updates dynamic required validity synchronously without awaiting a Lit update', async () => {
  const form = (await fixture(html`
    <form><lyra-model-select name="model" .catalog=${CATALOG}></lyra-model-select></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-model-select') as LyraModelSelect;
  expect(el.checkValidity()).to.be.true;

  el.required = true;
  expect(el.hasAttribute('required')).to.be.true;
  expect(el.checkValidity()).to.be.false;
  expect(form.checkValidity()).to.be.false;

  el.required = false;
  expect(el.hasAttribute('required')).to.be.false;
  expect(el.checkValidity()).to.be.true;
  expect(form.checkValidity()).to.be.true;
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

it('re-binds positioning after a disconnect+reconnect while open, ending up closed rather than half-open with no listeners', async () => {
  const el = (await fixture(html`<lyra-model-select open .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  // `disconnectedCallback()` resets `open` to `false` -- asserting that
  // directly is what actually distinguishes the fix from the pre-fix bug
  // (a stranded, unclosable, unpositioned listbox with no outside-pointerdown
  // listener re-attached).
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

// -- Label -----------------------------------------------------------------

it('renders a visible form-control-label element once label is set', async () => {
  const el = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
  const labelEl = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLLabelElement;
  expect(labelEl.hidden, 'hidden by default when label is unset').to.be.true;

  el.label = 'Model';
  await el.updateComplete;
  expect(labelEl.hidden).to.be.false;
  expect(labelEl.textContent).to.equal('Model');
  expect(labelEl.htmlFor, 'label should be paired with the trigger via for/id').to.equal(trigger(el).id);
});

it('renders the visible label in free-text mode too, paired with the combobox input', async () => {
  const el = (await fixture(html`<lyra-model-select label="Model"></lyra-model-select>`)) as LyraModelSelect;
  const labelEl = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLLabelElement;
  expect(labelEl.hidden).to.be.false;
  expect(labelEl.textContent).to.equal('Model');
  expect(labelEl.htmlFor).to.equal(input(el).id);
});

it('derives the accessible name from label when set, omitting the redundant aria-label', async () => {
  const el = (await fixture(
    html`<lyra-model-select label="Model" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  expect(trigger(el).hasAttribute('aria-label'), 'aria-label is unnecessary once a visible label exists').to.be
    .false;
});

it('prefers an explicit host aria-label over label, same precedence as lyra-select', async () => {
  const el = (await fixture(
    html`<lyra-model-select aria-label="Sort order" label="Model" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  expect(trigger(el).getAttribute('aria-label')).to.equal('Sort order');
});

it('preserves the exact aria-label/placeholder/"Model" fallback chain when label is unset', async () => {
  const withAriaLabel = (await fixture(
    html`<lyra-model-select aria-label="Sort order" placeholder="Choose…" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  expect(trigger(withAriaLabel).getAttribute('aria-label')).to.equal('Sort order');

  const withPlaceholder = (await fixture(
    html`<lyra-model-select placeholder="Choose…" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  expect(trigger(withPlaceholder).getAttribute('aria-label')).to.equal('Choose…');

  const bare = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
  expect(trigger(bare).getAttribute('aria-label')).to.equal('Model');
});

it('is accessible with a visible label set', async () => {
  const el = (await fixture(
    html`<lyra-model-select label="Model" .catalog=${CATALOG}></lyra-model-select>`,
  )) as LyraModelSelect;
  await expect(el).to.be.accessible();
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

// -- Hint/error chrome -------------------------------------------------------

describe('hint/error chrome', () => {
  it('renders no hint/error chrome when hint/errorText are unset (today\'s exact bare output, closed dropdown mode)', async () => {
    const el = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.true;
    expect(error.hidden).to.be.true;
  });

  it('renders no hint/error chrome when hint/errorText are unset (free-text mode)', async () => {
    const el = (await fixture(html`<lyra-model-select></lyra-model-select>`)) as LyraModelSelect;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.true;
    expect(error.hidden).to.be.true;
  });

  it('renders hint/errorText text and un-hides the matching parts (closed dropdown mode)', async () => {
    const el = (await fixture(
      html`<lyra-model-select hint="Pick a model" error-text="Required" .catalog=${CATALOG}></lyra-model-select>`,
    )) as LyraModelSelect;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(hint.textContent).to.contain('Pick a model');
    expect(error.hidden).to.be.false;
    expect(error.textContent).to.contain('Required');
  });

  it('renders hint/errorText text and un-hides the matching parts (free-text mode)', async () => {
    const el = (await fixture(
      html`<lyra-model-select
        allow-custom
        hint="Pick a model"
        error-text="Required"
        .catalog=${CATALOG}
      ></lyra-model-select>`,
    )) as LyraModelSelect;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(hint.textContent).to.contain('Pick a model');
    expect(error.hidden).to.be.false;
    expect(error.textContent).to.contain('Required');
  });

  it('renders slotted hint/error content and un-hides the matching parts', async () => {
    const el = (await fixture(html`
      <lyra-model-select .catalog=${CATALOG}>
        <span slot="hint">Custom hint</span>
        <span slot="error">Custom error</span>
      </lyra-model-select>
    `)) as LyraModelSelect;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(error.hidden).to.be.false;
  });

  it('wires aria-describedby on the trigger to the rendered hint/error ids', async () => {
    const el = (await fixture(
      html`<lyra-model-select hint="Pick a model" error-text="Required" .catalog=${CATALOG}></lyra-model-select>`,
    )) as LyraModelSelect;
    const describedBy = trigger(el).getAttribute('aria-describedby') ?? '';
    expect(describedBy).to.contain('error');
    expect(describedBy).to.contain('hint');
  });

  it('wires aria-describedby on the combobox input to the rendered hint/error ids', async () => {
    const el = (await fixture(
      html`<lyra-model-select allow-custom hint="Pick a model" error-text="Required"></lyra-model-select>`,
    )) as LyraModelSelect;
    const describedBy = input(el).getAttribute('aria-describedby') ?? '';
    expect(describedBy).to.contain('error');
    expect(describedBy).to.contain('hint');
  });

  it('omits aria-describedby entirely when neither hint nor errorText is set', async () => {
    const el = (await fixture(html`<lyra-model-select .catalog=${CATALOG}></lyra-model-select>`)) as LyraModelSelect;
    expect(trigger(el).hasAttribute('aria-describedby')).to.be.false;
  });
});

// -- Editing-assistance and event-bridging passthrough (free-text mode) -----

describe('spellcheck/autocapitalize/autocorrect passthrough', () => {
  it('spellcheck defaults to true (matching the native input default)', async () => {
    const el = (await fixture(html`<lyra-model-select></lyra-model-select>`)) as LyraModelSelect;
    expect(input(el).spellcheck).to.be.true;
  });

  it('forwards spellcheck=false, autocapitalize, and autocorrect onto the native input', async () => {
    const el = (await fixture(html`
      <lyra-model-select spellcheck="false" autocapitalize="off" autocorrect="off"></lyra-model-select>
    `)) as LyraModelSelect;
    const inp = input(el);
    expect(inp.spellcheck).to.be.false;
    expect(inp.getAttribute('autocapitalize')).to.equal('off');
    expect(inp.getAttribute('autocorrect')).to.equal('off');
  });

  it('forwards autocomplete, inputmode, and enterkeyhint onto the free-text input', async () => {
    const el = (await fixture(
      html`<lyra-model-select autocomplete="off" inputmode="text" enterkeyhint="done"></lyra-model-select>`,
    )) as LyraModelSelect;
    const inp = input(el);
    expect(inp.getAttribute('autocomplete')).to.equal('off');
    expect(inp.getAttribute('inputmode')).to.equal('text');
    expect(inp.getAttribute('enterkeyhint')).to.equal('done');
  });
});

describe('blur/focus bubbling', () => {
  it('re-dispatches a bubbling, composed blur event when the free-text input blurs', async () => {
    const el = (await fixture(html`<lyra-model-select></lyra-model-select>`)) as LyraModelSelect;
    const inp = input(el);
    inp.focus();
    const eventPromise = oneEvent(el, 'blur');
    inp.blur();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('re-dispatches a bubbling, composed focus event when the free-text input focuses', async () => {
    const el = (await fixture(html`<lyra-model-select></lyra-model-select>`)) as LyraModelSelect;
    const eventPromise = oneEvent(el, 'focus');
    input(el).focus();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});
