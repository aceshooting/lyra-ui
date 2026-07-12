import { fixture, expect, oneEvent, html, aTimeout } from '@open-wc/testing';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';

const basic = () => html`
  <lyra-select>
    <lyra-option value="a">Apple</lyra-option>
    <lyra-option value="b">Banana</lyra-option>
    <lyra-option value="c">Cherry</lyra-option>
  </lyra-select>
`;

function trigger(el: LyraSelect): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}

function rows(el: LyraSelect): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

it('renders lyra-option children as listbox rows with the placeholder shown as the trigger label', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.placeholder = 'Pick a fruit…';
  await el.updateComplete;

  expect(rows(el).length).to.equal(3);
  expect(trigger(el).textContent).to.contain('Pick a fruit…');
  expect(el.value).to.equal('');
});

it('opens the listbox by clicking the trigger, and closes it by clicking again', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  expect(el.open).to.be.false;

  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('opens the listbox with ArrowDown when closed', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('opens the listbox with ArrowUp when closed', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('selects an option by clicking it and emits change + input', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  setTimeout(() => rows(el)[1].click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
  expect(el.open).to.be.false;
});

it('emits input alongside change on selection, matching a native <select>', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  let inputFired = false;
  el.addEventListener('input', () => (inputFired = true));
  setTimeout(() => rows(el)[0].click());
  await oneEvent(el, 'change');
  expect(inputFired).to.be.true;
});

it('navigates with ArrowDown and selects the active option with Enter', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  // First ArrowDown (already open) moves to index 0, second to index 1.
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;

  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
});

it('selects the active option with Space, same as Enter', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;

  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('a');
});

it('closes the listbox on Escape without changing the selection', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.value = 'a';
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(el.value).to.equal('a');
});

it('jumps to (and selects) the option whose label starts with a typed character while closed', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  expect(el.open).to.be.false;

  setTimeout(() =>
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'change');
  expect(el.value).to.equal('c');
  expect(el.open).to.be.false;
});

it('type-ahead only moves the active row (no commit) while the listbox is open', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.value).to.equal('');
  const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
  expect(active?.textContent).to.contain('Banana');
});

it('resets the type-ahead buffer after ~500ms of inactivity', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);

  setTimeout(() =>
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');

  await aTimeout(600);

  // Buffer reset -> 'c' alone (not 'bc') should now match Cherry.
  setTimeout(() =>
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true, cancelable: true })),
  );
  await oneEvent(el, 'change');
  expect(el.value).to.equal('c');
});

it('participates in a form: value reflects in FormData on submit', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-select name="fruit">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
      </lyra-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-select') as LyraSelect;
  el.value = 'b';
  await el.updateComplete;
  expect(new FormData(form).get('fruit')).to.equal('b');
});

it('blocks a required, empty select from submitting the form', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-select name="fruit" required>
        <lyra-option value="a">Apple</lyra-option>
      </lyra-select>
    </form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it('allows a required select to submit once a value is selected', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-select name="fruit" required>
        <lyra-option value="a">Apple</lyra-option>
      </lyra-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-select') as LyraSelect;
  el.value = 'a';
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('seeds the initial selection from a declaratively-selected <lyra-option>', async () => {
  const el = (await fixture(html`
    <lyra-select>
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b" selected>Banana</lyra-option>
    </lyra-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.value).to.equal('b');
});

it('restores the declared default selection on form.reset()', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-select name="fruit">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b" selected>Banana</lyra-option>
      </lyra-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-select') as LyraSelect;
  await el.updateComplete;
  el.value = 'a';
  form.reset();
  expect(el.value).to.equal('b');
});

it('resets to empty via form.reset() when no option was declared selected', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-select name="fruit">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
      </lyra-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-select') as LyraSelect;
  await el.updateComplete;
  el.value = 'a';
  el.value = 'b';
  form.reset();
  expect(el.value).to.equal('');
});

it('does not open or select when disabled', async () => {
  const el = (await fixture(html`
    <lyra-select disabled>
      <lyra-option value="a">Apple</lyra-option>
    </lyra-select>
  `)) as LyraSelect;
  await el.updateComplete;

  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(trigger(el).disabled).to.be.true;
});

it('disables the select when its containing fieldset is disabled', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lyra-select name="fruit">
          <lyra-option value="a">Apple</lyra-option>
        </lyra-select>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-select') as LyraSelect;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await el.updateComplete;
  expect(el.disabled).to.be.false;

  fieldset.disabled = true;
  await el.updateComplete;
  expect(el.disabled).to.be.true;
});

it('closes the listbox on a pointerdown outside the element', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('fires lyra-show/lyra-hide when `open` is set directly, bypassing click/keyboard', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;

  setTimeout(() => {
    el.open = true;
  });
  await oneEvent(el, 'lyra-show');
  await el.updateComplete;
  expect(el.open).to.be.true;

  setTimeout(() => {
    el.open = false;
  });
  await oneEvent(el, 'lyra-hide');
  expect(el.open).to.be.false;
});

it('closes the listbox when the trigger blurs (e.g. tabbing away)', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  trigger(el).dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('reflects an invalid state only after the field has been interacted with once', async () => {
  const el = (await fixture(html`
    <lyra-select required>
      <lyra-option value="a">Apple</lyra-option>
    </lyra-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.false;

  trigger(el).dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.true;
});

it('renders sub and dot-color from light-DOM options', async () => {
  const el = (await fixture(html`
    <lyra-select>
      <lyra-option value="a" sub="Running" dot-color="green">Meter A</lyra-option>
    </lyra-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="option-sub"]')!.textContent).to.equal('Running');
  expect((el.shadowRoot!.querySelector('[part="option-dot"]') as HTMLElement).style.background).to.equal(
    'green',
  );
});

it('renders a group-label header when option rows are grouped', async () => {
  const el = (await fixture(html`
    <lyra-select>
      <lyra-option value="a" group="Fruits">Apple</lyra-option>
      <lyra-option value="b" group="Fruits">Banana</lyra-option>
      <lyra-option value="c" group="Vegetables">Carrot</lyra-option>
    </lyra-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  const groups = Array.from(el.shadowRoot!.querySelectorAll('.group-label')).map((n) => n.textContent);
  expect(groups).to.deep.equal(['Fruits', 'Vegetables']);
});

it('skips a disabled option during click selection and keyboard navigation', async () => {
  const el = (await fixture(html`
    <lyra-select>
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b" disabled>Banana</lyra-option>
      <lyra-option value="c">Cherry</lyra-option>
    </lyra-select>
  `)) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  // ArrowDown twice from -1 should land on Cherry (index 1 of the 2
  // navigable options), skipping disabled Banana entirely.
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;

  setTimeout(() => btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('c');
});

it('pairs the form-control label with the trigger via for/id so clicking the label focuses it', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.label = 'Fruit';
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLLabelElement;
  const btn = trigger(el);
  expect(label.htmlFor, 'label should have a for attribute').to.not.equal('');
  expect(label.htmlFor).to.equal(btn.id);
});

it('hides the error and hint parts when empty, shows them once populated', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  expect(getComputedStyle(errorPart).display).to.equal('none');
  expect(getComputedStyle(hintPart).display).to.equal('none');

  el.errorText = 'Selection required';
  el.hint = 'Pick a fruit';
  await el.updateComplete;
  expect(getComputedStyle(errorPart).display).to.not.equal('none');
  expect(getComputedStyle(hintPart).display).to.not.equal('none');
});

it('is accessible', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.label = 'Fruit';
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible while open', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.label = 'Fruit';
  el.open = true;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
