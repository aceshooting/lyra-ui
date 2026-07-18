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

it('does not refire change/input when reopening and re-clicking the already-selected row', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.value = 'b';
  await el.updateComplete;

  el.open = true;
  await el.updateComplete;

  let changeFired = false;
  let inputFired = false;
  el.addEventListener('change', () => (changeFired = true));
  el.addEventListener('input', () => (inputFired = true));
  rows(el)[1].click();
  await el.updateComplete;

  expect(el.value).to.equal('b');
  expect(el.open).to.be.false;
  expect(changeFired).to.be.false;
  expect(inputFired).to.be.false;
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

it('submits an untouched empty value instead of omitting the named control', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-select name="fruit">
        <lyra-option value="a">Apple</lyra-option>
      </lyra-select>
    </form>
  `)) as HTMLFormElement;

  const data = new FormData(form);
  expect(data.has('fruit')).to.be.true;
  expect(data.get('fruit')).to.equal('');
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

it('focuses the inner trigger after direct and submit-driven validity reporting', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before select</button>
      <lyra-select name="fruit" required>
        <lyra-option value="a">Apple</lyra-option>
      </lyra-select>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button') as HTMLButtonElement;
  const el = form.querySelector('lyra-select') as LyraSelect;
  let submitCount = 0;
  form.addEventListener('submit', (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lyra-select');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lyra-select');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
});

it('updates dynamic required validity synchronously without awaiting a Lit update', async () => {
  const el = (await fixture(html`
    <lyra-select>
      <lyra-option value="a">Apple</lyra-option>
    </lyra-select>
  `)) as LyraSelect;

  el.required = true;
  expect(el.hasAttribute('required')).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.required = false;
  expect(el.hasAttribute('required')).to.be.false;
  expect(el.checkValidity()).to.be.true;
});

it('updates disabled form participation synchronously without awaiting a Lit update', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-select name="fruit">
        <lyra-option value="a">Apple</lyra-option>
      </lyra-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-select') as LyraSelect;
  el.value = 'a';
  expect(new FormData(form).get('fruit')).to.equal('a');

  el.disabled = true;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(new FormData(form).has('fruit')).to.be.false;

  el.disabled = false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(new FormData(form).get('fruit')).to.equal('a');
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
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.false;

  fieldset.disabled = true;
  await el.updateComplete;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lyra-combobox's identical `_fieldsetDisabled`/
  // `effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(el.disabled).to.be.false;
  const triggerEl = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(triggerEl).opacity).to.equal('0.5');
  expect(getComputedStyle(triggerEl).cursor).to.equal('not-allowed');
});

it('restores its own explicit `disabled` after an ancestor fieldset re-enables', async () => {
  const el = (await fixture(html`<lyra-select disabled></lyra-select>`)) as LyraSelect;
  (el as unknown as { formDisabledCallback(d: boolean): void }).formDisabledCallback(true);
  (el as unknown as { formDisabledCallback(d: boolean): void }).formDisabledCallback(false);
  await el.updateComplete;
  expect(el.disabled).to.be.true;
});

it('re-binds positioning after a disconnect+reconnect while open, ending up closed rather than half-open with no listeners', async () => {
  const el = (await fixture(html`<lyra-select open><lyra-option value="x"></lyra-option></lyra-select>`)) as LyraSelect;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  // `disconnectedCallback()` resets `open` to `false` — asserting that directly
  // (not an incidental side effect like a leftover inline `position` style,
  // which is set once at first open and never cleared either way) is what
  // actually distinguishes the fix from the pre-fix bug.
  expect(el.open).to.be.false;
});

it('does not override an explicit `label` slot with the fallback aria-label', async () => {
  const el = (await fixture(html`<lyra-select><span slot="label">Region</span></lyra-select>`)) as LyraSelect;
  await el.updateComplete;
  const triggerEl = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(triggerEl.getAttribute('aria-label')).to.not.equal('Select');
});

it('re-renders when an already-slotted option mutates its own label', async () => {
  const el = (await fixture(html`<lyra-select><lyra-option value="x">Old label</lyra-option></lyra-select>`)) as LyraSelect;
  // Open BEFORE mutating, with no further `open` toggle afterward — this is
  // what makes the test discriminating: opening AFTER the mutation would
  // force an ordinary re-render that reads the option's live (already-new)
  // textContent regardless of whether the lyra-option-change/MutationObserver
  // mechanism fired at all.
  el.open = true;
  await el.updateComplete;
  const option = el.querySelector('lyra-option')!;
  option.textContent = 'New label';
  await new Promise((r) => setTimeout(r, 0)); // let the MutationObserver's microtask + onOptionChange's re-render land
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="option"]')!;
  expect(row.textContent).to.include('New label');
});

it('reflects a property-assigned `name` synchronously, with no await, so same-tick FormData submission sees it', async () => {
  const el = (await fixture(html`<lyra-select></lyra-select>`)) as LyraSelect;
  el.name = 'region';
  expect(el.getAttribute('name')).to.equal('region');
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

it('forwards public focus and blur to the trigger', async () => {
  const el = (await fixture(basic())) as LyraSelect;

  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);
});

it('bridges trigger focus and blur as bubbling, composed host events', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);

  const focusPromise = oneEvent(el, 'focus');
  btn.focus();
  const focusEvent = await focusPromise;
  expect(focusEvent.bubbles).to.be.true;
  expect(focusEvent.composed).to.be.true;

  const blurPromise = oneEvent(el, 'blur');
  btn.blur();
  const blurEvent = await blurPromise;
  expect(blurEvent.bubbles).to.be.true;
  expect(blurEvent.composed).to.be.true;
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

it('associates the trigger with the hint/error text via aria-describedby, like lyra-combobox', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;
  const btn = trigger(el);
  expect(btn.hasAttribute('aria-describedby')).to.be.false;

  el.hint = 'Pick a fruit';
  await el.updateComplete;
  expect(btn.getAttribute('aria-describedby')).to.equal('select-hint');

  el.errorText = 'Selection required';
  await el.updateComplete;
  expect(btn.getAttribute('aria-describedby')).to.equal('select-error select-hint');
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

it('applies a size attribute that reflects to the host', async () => {
  const el = (await fixture(html`<lyra-select size="s"></lyra-select>`)) as LyraSelect;
  expect(el.getAttribute('size')).to.equal('s');
  expect(el.size).to.equal('s');
});

it('defaults to size "m"', async () => {
  const el = (await fixture(html`<lyra-select></lyra-select>`)) as LyraSelect;
  expect(el.size).to.equal('m');
});

it('prefers a host-level aria-label over label/placeholder for the trigger', async () => {
  const el = (await fixture(
    html`<lyra-select aria-label="Sort order" placeholder="Choose…"></lyra-select>`,
  )) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(trigger.getAttribute('aria-label')).to.equal('Sort order');
});

it('falls back to placeholder when no host aria-label or label is set', async () => {
  const el = (await fixture(html`<lyra-select placeholder="Choose…"></lyra-select>`)) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(trigger.getAttribute('aria-label')).to.equal('Choose…');
});

describe('trigger aria-label localization', () => {
  it('falls back to the localized "Select" when no aria-label, label, or placeholder is set', async () => {
    const el = (await fixture(html`<lyra-select></lyra-select>`)) as LyraSelect;
    expect(trigger(el).getAttribute('aria-label')).to.equal('Select');
  });

  it('localizes the fallback trigger aria-label via this.localize() when .strings overrides select', async () => {
    const el = (await fixture(
      html`<lyra-select .strings=${{ select: 'Sélectionner' }}></lyra-select>`,
    )) as LyraSelect;
    expect(trigger(el).getAttribute('aria-label')).to.equal('Sélectionner');
  });
});

describe('validationMessage localization', () => {
  it('defaults to the built-in English validationMessage for a required, unselected control', async () => {
    const el = (await fixture(html`
      <lyra-select required>
        <lyra-option value="a">Apple</lyra-option>
      </lyra-select>
    `)) as LyraSelect;
    expect(el.validationMessage).to.equal('Please select an option.');
  });

  it('localizes the validationMessage via this.localize() when .strings overrides selectValueMissing', async () => {
    const el = (await fixture(html`
      <lyra-select required .strings=${{ selectValueMissing: 'Veuillez sélectionner une option.' }}>
        <lyra-option value="a">Apple</lyra-option>
      </lyra-select>
    `)) as LyraSelect;
    expect(el.validationMessage).to.equal('Veuillez sélectionner une option.');

    el.value = 'a';
    expect(el.validationMessage).to.equal('');
  });
});

describe('single-option combobox default (autoCommitSingleOption unset)', () => {
  const single = () => html`
    <lyra-select>
      <lyra-option value="a">Apple</lyra-option>
    </lyra-select>
  `;

  it('keeps the normal combobox/listbox/chevron trigger when only one option is enabled', async () => {
    const el = (await fixture(single())) as LyraSelect;
    expect(el.autoCommitSingleOption).to.be.false;
    const btn = trigger(el);
    expect(btn.getAttribute('role')).to.equal('combobox');
    expect(btn.getAttribute('aria-haspopup')).to.equal('listbox');
    expect(btn.hasAttribute('aria-expanded')).to.be.true;
    expect(btn.hasAttribute('aria-controls')).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.exist;
  });

  it('opens the listbox on click instead of committing the sole option directly', async () => {
    const el = (await fixture(single())) as LyraSelect;
    trigger(el).click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.value).to.equal('');
  });

  it('opens the listbox on ArrowDown instead of committing the sole option directly', async () => {
    const el = (await fixture(single())) as LyraSelect;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.value).to.equal('');
  });
});

describe('single-option auto-commit (autoCommitSingleOption)', () => {
  const single = () => html`
    <lyra-select auto-commit-single-option>
      <lyra-option value="a">Apple</lyra-option>
    </lyra-select>
  `;

  it('renders the trigger as a plain button with no chevron/combobox ARIA when only one option is enabled', async () => {
    const el = (await fixture(single())) as LyraSelect;
    const btn = trigger(el);
    expect(btn.getAttribute('role')).to.equal('button');
    expect(btn.hasAttribute('aria-haspopup')).to.be.false;
    expect(btn.hasAttribute('aria-expanded')).to.be.false;
    expect(btn.hasAttribute('aria-controls')).to.be.false;
    expect(btn.hasAttribute('aria-activedescendant')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.not.exist;
  });

  it('commits the sole option on click without ever opening the listbox', async () => {
    const el = (await fixture(single())) as LyraSelect;
    setTimeout(() => trigger(el).click());
    await oneEvent(el, 'change');
    expect(el.value).to.equal('a');
    expect(el.open).to.be.false;
  });

  it('commits the sole option on ArrowDown/ArrowUp', async () => {
    const el = (await fixture(single())) as LyraSelect;
    setTimeout(() =>
      trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })),
    );
    await oneEvent(el, 'change');
    expect(el.value).to.equal('a');
    expect(el.open).to.be.false;
  });

  it('does not refire change/input on a second click once the sole option is already selected', async () => {
    const el = (await fixture(single())) as LyraSelect;
    setTimeout(() => trigger(el).click());
    await oneEvent(el, 'change');
    expect(el.value).to.equal('a');

    let changeFired = false;
    let inputFired = false;
    el.addEventListener('change', () => (changeFired = true));
    el.addEventListener('input', () => (inputFired = true));
    trigger(el).click();
    await el.updateComplete;
    expect(el.value).to.equal('a');
    expect(changeFired).to.be.false;
    expect(inputFired).to.be.false;
  });

  it('still opens normally (three-row combobox chrome, no auto-commit) once a second option is enabled', async () => {
    const el = (await fixture(html`
      <lyra-select>
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
      </lyra-select>
    `)) as LyraSelect;
    const btn = trigger(el);
    expect(btn.getAttribute('role')).to.equal('combobox');
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.exist;

    btn.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.value).to.equal('');
  });

  it('treats a single ENABLED option among several disabled ones as single-option too', async () => {
    const el = (await fixture(html`
      <lyra-select auto-commit-single-option>
        <lyra-option value="a" disabled>Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
        <lyra-option value="c" disabled>Cherry</lyra-option>
      </lyra-select>
    `)) as LyraSelect;
    const btn = trigger(el);
    expect(btn.getAttribute('role')).to.equal('button');

    setTimeout(() => btn.click());
    await oneEvent(el, 'change');
    expect(el.value).to.equal('b');
  });

  it('does not auto-select on mount -- a required, unselected single-option select stays invalid', async () => {
    const form = (await fixture(html`
      <form>
        <lyra-select name="fruit" required>
          <lyra-option value="a">Apple</lyra-option>
        </lyra-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lyra-select') as LyraSelect;
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(form.reportValidity()).to.be.false;
  });

  it('does not intercept click/keyboard when disabled, even with a single option', async () => {
    const el = (await fixture(html`
      <lyra-select disabled auto-commit-single-option>
        <lyra-option value="a">Apple</lyra-option>
      </lyra-select>
    `)) as LyraSelect;
    trigger(el).click();
    await el.updateComplete;
    expect(el.value).to.equal('');
  });

  it('is accessible with a single enabled option', async () => {
    const el = (await fixture(single())) as LyraSelect;
    el.label = 'Fruit';
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('SingleOption / SingleEnabledAmongDisabled stories actually set auto-commit-single-option', () => {
  it('SingleOption renders the plain-button auto-commit trigger its doc comment describes', async () => {
    const { SingleOption } = await import('./select.stories.js');
    const el = (await fixture(SingleOption.render!({}, null as never))) as LyraSelect;
    const btn = trigger(el);
    expect(el.autoCommitSingleOption).to.be.true;
    expect(btn.getAttribute('role')).to.equal('button');
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.not.exist;
  });

  it('SingleEnabledAmongDisabled renders the plain-button auto-commit trigger its doc comment describes', async () => {
    const { SingleEnabledAmongDisabled } = await import('./select.stories.js');
    const el = (await fixture(SingleEnabledAmongDisabled.render!({}, null as never))) as LyraSelect;
    const btn = trigger(el);
    expect(el.autoCommitSingleOption).to.be.true;
    expect(btn.getAttribute('role')).to.equal('button');
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.not.exist;
  });
});

it('lets a consumer pin an exact trigger height via --lyra-select-trigger-height, bypassing the min-height floor', async () => {
  const el = (await fixture(html`<lyra-select label="Role"><lyra-option value="a">A</lyra-option></lyra-select>`)) as LyraSelect;
  el.style.setProperty('--lyra-select-trigger-height', '43px');
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(trigger).blockSize).to.equal('43px');
});

it('leaves today\'s min-height-floor-only behavior unchanged when the override is unset', async () => {
  const el = (await fixture(html`<lyra-select label="Role"><lyra-option value="a">A</lyra-option></lyra-select>`)) as LyraSelect;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(trigger).blockSize).to.not.equal('0px');
  // No forced block-size -- the trigger's rendered height still comes from its own
  // padding/line-height/border, only floored by --lyra-select-trigger-min-height as before.
});

describe('per-size min-height floor', () => {
  it('actually enforces --lyra-select-trigger-min-height at each non-default size', async () => {
    // --lyra-select-trigger-min-height is declared per size tier (xs=1.5rem, s=1.875rem,
    // l=3rem, xl=3.5rem) but was never wired to min-block-size for those tiers -- this is the
    // regression test for that fix.
    const expected: Record<string, string> = { xs: '24px', s: '30px', l: '48px', xl: '56px' };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(
        html`<lyra-select size=${size} label="Role"><lyra-option value="a">A</lyra-option></lyra-select>`,
      )) as LyraSelect;
      const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
      expect(getComputedStyle(t).minBlockSize, `size=${size}`).to.equal(px);
    }
  });

  it('leaves the default (m) tier unaffected by the fix -- no enforced floor, matching pre-fix behavior', async () => {
    const el = (await fixture(html`<lyra-select label="Role"><lyra-option value="a">A</lyra-option></lyra-select>`)) as LyraSelect;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).minBlockSize).to.equal('0px');
  });

  it('a consumer-pinned --lyra-select-trigger-height still overrides the per-size floor', async () => {
    const el = (await fixture(
      html`<lyra-select size="s" label="Role"><lyra-option value="a">A</lyra-option></lyra-select>`,
    )) as LyraSelect;
    el.style.setProperty('--lyra-select-trigger-height', '43px');
    await el.updateComplete;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).blockSize).to.equal('43px');
  });
});
