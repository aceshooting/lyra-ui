import { fixture, expect, oneEvent, html, aTimeout } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './select.styles.js';

const basic = () => html`
  <lr-select>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-select>
`;

function trigger(el: LyraSelect): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}

function rows(el: LyraSelect): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

it('renders lr-option children as listbox rows with the placeholder shown as the trigger label', async () => {
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

it('emits lr-change with the new value alongside native-style change/input', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const seen: Array<{ type: string; detail: unknown }> = [];
  for (const type of ['input', 'change', 'lr-change']) {
    el.addEventListener(type, (e) => seen.push({ type, detail: (e as CustomEvent).detail }));
  }
  rows(el)[1].click();
  await el.updateComplete;

  expect(seen.map((s) => s.type)).to.deep.equal(['input', 'change', 'lr-change']);
  for (const s of seen) expect(s.detail).to.deep.equal({ value: 'b' });
});

it('stays silent on input/change/lr-change for a programmatic value assignment', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;
  let count = 0;
  for (const type of ['input', 'change', 'lr-change']) {
    el.addEventListener(type, () => count++);
  }
  el.value = 'b';
  await el.updateComplete;
  expect(el.value).to.equal('b');
  expect(count).to.equal(0);
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
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  el.value = 'b';
  await el.updateComplete;
  expect(new FormData(form).get('fruit')).to.equal('b');
});

it('submits an untouched empty value instead of omitting the named control', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;

  const data = new FormData(form);
  expect(data.has('fruit')).to.be.true;
  expect(data.get('fruit')).to.equal('');
});

it('blocks a required, empty select from submitting the form', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it('allows a required select to submit once a value is selected', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  el.value = 'a';
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('focuses the inner trigger after direct and submit-driven validity reporting', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before select</button>
      <lr-select name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button') as HTMLButtonElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  let submitCount = 0;
  form.addEventListener('submit', (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-select');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lr-select');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('trigger');
});

it('updates dynamic required validity synchronously without awaiting a Lit update', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
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
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  el.value = 'a';
  expect(new FormData(form).get('fruit')).to.equal('a');

  el.disabled = true;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(new FormData(form).has('fruit')).to.be.false;

  el.disabled = false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(new FormData(form).get('fruit')).to.equal('a');
});

it('seeds the initial selection from a declaratively-selected <lr-option>', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.value).to.equal('b');
});

it('restores the declared default selection on form.reset()', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  await el.updateComplete;
  el.value = 'a';
  form.reset();
  expect(el.value).to.equal('b');
});

it('resets to empty via form.reset() when no option was declared selected', async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  await el.updateComplete;
  el.value = 'a';
  el.value = 'b';
  form.reset();
  expect(el.value).to.equal('');
});

it('does not open or select when disabled', async () => {
  const el = (await fixture(html`
    <lr-select disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
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
        <lr-select name="fruit">
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-select') as LyraSelect;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await el.updateComplete;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.false;

  fieldset.disabled = true;
  await el.updateComplete;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lr-combobox's identical `_fieldsetDisabled`/
  // `effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(el.disabled).to.be.false;
  const triggerEl = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(triggerEl).opacity).to.equal('0.5');
  expect(getComputedStyle(triggerEl).cursor).to.equal('not-allowed');
});

it('restores its own explicit `disabled` after an ancestor fieldset re-enables', async () => {
  const el = (await fixture(html`<lr-select disabled></lr-select>`)) as LyraSelect;
  (el as unknown as { formDisabledCallback(d: boolean): void }).formDisabledCallback(true);
  (el as unknown as { formDisabledCallback(d: boolean): void }).formDisabledCallback(false);
  await el.updateComplete;
  expect(el.disabled).to.be.true;
});

it('re-binds positioning after a disconnect+reconnect while open, ending up closed rather than half-open with no listeners', async () => {
  const el = (await fixture(html`<lr-select open><lr-option value="x"></lr-option></lr-select>`)) as LyraSelect;
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
  const el = (await fixture(html`<lr-select><span slot="label">Region</span></lr-select>`)) as LyraSelect;
  await el.updateComplete;
  const triggerEl = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
  expect(triggerEl.getAttribute('aria-label')).to.not.equal('Select');
});

it('re-renders when an already-slotted option mutates its own label', async () => {
  const el = (await fixture(html`<lr-select><lr-option value="x">Old label</lr-option></lr-select>`)) as LyraSelect;
  // Open BEFORE mutating, with no further `open` toggle afterward — this is
  // what makes the test discriminating: opening AFTER the mutation would
  // force an ordinary re-render that reads the option's live (already-new)
  // textContent regardless of whether the lr-option-change/MutationObserver
  // mechanism fired at all.
  el.open = true;
  await el.updateComplete;
  const option = el.querySelector('lr-option')!;
  option.textContent = 'New label';
  await new Promise((r) => setTimeout(r, 0)); // let the MutationObserver's microtask + onOptionChange's re-render land
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="option"]')!;
  expect(row.textContent).to.include('New label');
});

it('reflects a property-assigned `name` synchronously, with no await, so same-tick FormData submission sees it', async () => {
  const el = (await fixture(html`<lr-select></lr-select>`)) as LyraSelect;
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

it('fires lr-show/lr-hide when `open` is set directly, bypassing click/keyboard', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;

  setTimeout(() => {
    el.open = true;
  });
  await oneEvent(el, 'lr-show');
  await el.updateComplete;
  expect(el.open).to.be.true;

  setTimeout(() => {
    el.open = false;
  });
  await oneEvent(el, 'lr-hide');
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
    <lr-select required>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.false;

  trigger(el).dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.true;
});

it('renders sub and dot-color from light-DOM options', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" sub="Running" dot-color="green">Meter A</lr-option>
    </lr-select>
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
    <lr-select>
      <lr-option value="a" group="Fruits">Apple</lr-option>
      <lr-option value="b" group="Fruits">Banana</lr-option>
      <lr-option value="c" group="Vegetables">Carrot</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  const groups = Array.from(el.shadowRoot!.querySelectorAll('.group-label')).map((n) => n.textContent);
  expect(groups).to.deep.equal(['Fruits', 'Vegetables']);
});

it('skips a disabled option during click selection and keyboard navigation', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" disabled>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-select>
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

it('associates the trigger with the hint/error text via aria-describedby, like lr-combobox', async () => {
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
  const el = (await fixture(html`<lr-select size="s"></lr-select>`)) as LyraSelect;
  expect(el.getAttribute('size')).to.equal('s');
  expect(el.size).to.equal('s');
});

it('defaults to size "m"', async () => {
  const el = (await fixture(html`<lr-select></lr-select>`)) as LyraSelect;
  expect(el.size).to.equal('m');
});

it('prefers a host-level aria-label over label/placeholder for the trigger', async () => {
  const el = (await fixture(
    html`<lr-select aria-label="Sort order" placeholder="Choose…"></lr-select>`,
  )) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(trigger.getAttribute('aria-label')).to.equal('Sort order');
});

it('falls back to placeholder when no host aria-label or label is set', async () => {
  const el = (await fixture(html`<lr-select placeholder="Choose…"></lr-select>`)) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(trigger.getAttribute('aria-label')).to.equal('Choose…');
});

describe('trigger aria-label localization', () => {
  it('falls back to the localized "Select" when no aria-label, label, or placeholder is set', async () => {
    const el = (await fixture(html`<lr-select></lr-select>`)) as LyraSelect;
    expect(trigger(el).getAttribute('aria-label')).to.equal('Select');
  });

  it('localizes the fallback trigger aria-label via this.localize() when .strings overrides select', async () => {
    const el = (await fixture(
      html`<lr-select .strings=${{ select: 'Sélectionner' }}></lr-select>`,
    )) as LyraSelect;
    expect(trigger(el).getAttribute('aria-label')).to.equal('Sélectionner');
  });
});

describe('validationMessage localization', () => {
  it('defaults to the built-in English validationMessage for a required, unselected control', async () => {
    const el = (await fixture(html`
      <lr-select required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    expect(el.validationMessage).to.equal('Please select an option.');
  });

  it('localizes the validationMessage via this.localize() when .strings overrides selectValueMissing', async () => {
    const el = (await fixture(html`
      <lr-select required .strings=${{ selectValueMissing: 'Veuillez sélectionner une option.' }}>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    expect(el.validationMessage).to.equal('Veuillez sélectionner une option.');

    el.value = 'a';
    expect(el.validationMessage).to.equal('');
  });
});

describe('single-option combobox default (autoCommitSingleOption unset)', () => {
  const single = () => html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
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
    <lr-select auto-commit-single-option>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
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
      <lr-select>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
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
      <lr-select auto-commit-single-option>
        <lr-option value="a" disabled>Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c" disabled>Cherry</lr-option>
      </lr-select>
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
        <lr-select name="fruit" required>
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-select') as LyraSelect;
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(form.reportValidity()).to.be.false;
  });

  it('does not intercept click/keyboard when disabled, even with a single option', async () => {
    const el = (await fixture(html`
      <lr-select disabled auto-commit-single-option>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
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

it('lets a consumer pin an exact trigger height via --lr-select-trigger-height, bypassing the min-height floor', async () => {
  const el = (await fixture(html`<lr-select label="Role"><lr-option value="a">A</lr-option></lr-select>`)) as LyraSelect;
  el.style.setProperty('--lr-select-trigger-height', '43px');
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(trigger).blockSize).to.equal('43px');
});

it('leaves today\'s min-height-floor-only behavior unchanged when the override is unset', async () => {
  const el = (await fixture(html`<lr-select label="Role"><lr-option value="a">A</lr-option></lr-select>`)) as LyraSelect;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(trigger).blockSize).to.not.equal('0px');
  // No forced block-size -- the trigger's rendered height still comes from its own
  // padding/line-height/border, only floored by --lr-select-trigger-min-height as before.
});

describe('per-size min-height floor', () => {
  it('actually enforces --lr-select-trigger-min-height at each non-default size', async () => {
    // --lr-select-trigger-min-height is declared per size tier (xs=1.5rem, s=1.875rem,
    // l=3rem, xl=3.5rem) but was never wired to min-block-size for those tiers -- this is the
    // regression test for that fix.
    const expected: Record<string, string> = { xs: '24px', s: '30px', l: '48px', xl: '56px' };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(
        html`<lr-select size=${size} label="Role"><lr-option value="a">A</lr-option></lr-select>`,
      )) as LyraSelect;
      const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
      expect(getComputedStyle(t).minBlockSize, `size=${size}`).to.equal(px);
    }
  });

  it('enforces the same floor on the default (m) tier, matching lr-input/lr-combobox at that tier', async () => {
    const el = (await fixture(html`<lr-select label="Role"><lr-option value="a">A</lr-option></lr-select>`)) as LyraSelect;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).minBlockSize).to.equal('40px');
  });

  it('lets a consumer raise --lr-select-trigger-min-height at the default tier', async () => {
    const el = (await fixture(html`<lr-select label="Role"><lr-option value="a">A</lr-option></lr-select>`)) as LyraSelect;
    el.style.setProperty('--lr-select-trigger-min-height', '52px');
    await el.updateComplete;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).minBlockSize).to.equal('52px');
  });

  it('keeps --lr-select-trigger-min-height live at size="s" with no specificity patch rule', async () => {
    const el = (await fixture(
      html`<lr-select size="s" label="Role"><lr-option value="a">A</lr-option></lr-select>`,
    )) as LyraSelect;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).minBlockSize).to.equal('30px');
    el.style.setProperty('--lr-select-trigger-min-height', '33px');
    await el.updateComplete;
    expect(getComputedStyle(t).minBlockSize).to.equal('33px');
  });

  it('a consumer-pinned --lr-select-trigger-height still overrides the per-size floor', async () => {
    const el = (await fixture(
      html`<lr-select size="s" label="Role"><lr-option value="a">A</lr-option></lr-select>`,
    )) as LyraSelect;
    el.style.setProperty('--lr-select-trigger-height', '43px');
    await el.updateComplete;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).blockSize).to.equal('43px');
    expect(getComputedStyle(t).minBlockSize).to.equal('43px');
  });
});

describe('trigger gap/radius cssprops', () => {
  it('exposes --lr-select-gap and --lr-select-radius, defaulting to the pre-existing literals', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const cs = getComputedStyle(trigger(el));
    expect(cs.gap).to.equal('4px');
    expect(cs.borderRadius).to.equal('6px');
  });

  it('retunes the trigger gap and corner radius with no ::part(trigger) rule', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.style.setProperty('--lr-select-gap', '12px');
    el.style.setProperty('--lr-select-radius', '3px');
    await el.updateComplete;
    const cs = getComputedStyle(trigger(el));
    expect(cs.gap).to.equal('12px');
    expect(cs.borderRadius).to.equal('3px');
  });

  it('declares --lr-select-gap/--lr-select-radius on :host and consumes them once on [part="trigger"]', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/:host \{[^}]*--lr-select-gap: var\(--lr-space-xs\);/);
    expect(css).to.match(/:host \{[^}]*--lr-select-radius: var\(--lr-radius\);/);
    expect(css).to.include('gap: var(--lr-select-gap);');
    expect(css).to.include('border-radius: var(--lr-select-radius);');
  });
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.display = 'block';
  probe.style.setProperty('--lr-popover-viewport-clamp', '10px');
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it('clamps its floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`<lr-select></lr-select>`)) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  expect(renderedClamp(el, "[part='listbox']")).to.equal('10px');
});

it('pins overflow-x explicitly alongside the listbox\'s overflow-y, so the unset axis never falls back to browser-implicit auto', () => {
  // Per the CSS overflow spec, pinning one axis to a non-'visible' value forces the other axis's
  // used value to 'auto' too -- an implicit overflow-x: auto here risks a phantom horizontal
  // scrollbar even though this listbox only ever scrolls vertically. Same class of bug already
  // fixed on lr-tabs' tablist (overflow-x: auto; overflow-y: hidden;), just the opposite axis.
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='listbox'\]\s*\{[^}]*overflow-y:\s*auto;\s*overflow-x:\s*hidden;/);
});

it('gives the trigger a :hover rule alongside its :focus-visible ring', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(
    /:where\(\[part='trigger'\]\):hover:where\(:not\(:disabled\)\)\s*\{[^}]*background:\s*var\(--lr-color-brand-quiet\)/,
  );
});

describe('active-option row cssprop indirection', () => {
  it('recolors the active option row from --lr-select-option-active-bg on an ancestor, not a :host-declared prop', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.style.setProperty('--lr-select-option-active-bg', 'rgb(10, 20, 30)');
    el.open = true;
    await el.updateComplete;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
    expect(getComputedStyle(active).backgroundColor).to.equal('rgb(10, 20, 30)');
  });

  it('renders byte-identically to the pre-cssprop-indirection output when the prop is unset', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true }));
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
    // Resolve the brand-quiet token in the same shadow root for a like-for-like comparison,
    // rather than comparing a raw custom-property string against getComputedStyle's rgb(...) form.
    const probe = document.createElement('span');
    probe.setAttribute('style', 'background: var(--lr-color-brand-quiet)');
    el.shadowRoot!.appendChild(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    expect(getComputedStyle(active).backgroundColor).to.equal(expected);
  });
});

describe('host click() forwarding', () => {
  it('forwards host click() to the internal trigger button, opening the listbox', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    expect(el.open).to.be.false;
    el.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
  });

  it('does not forward click() when the trigger is disabled, matching a native disabled <button>', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.disabled = true;
    await el.updateComplete;
    el.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraSelect | undefined;
      expect(() => {
        el = document.createElement('lr-select') as LyraSelect;
      }).to.not.throw();
      // Confirm the fallback keeps the rest of the public surface usable rather than merely
      // swallowing the constructor error.
      expect(el!.checkValidity()).to.be.true;
      expect(el!.form).to.equal(null);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

describe('lifecycle super calls', () => {
  const LyraSelectCtor = customElements.get('lr-select')!;

  it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
    // Keyed on `this === el` (not a bare shared boolean) -- `basic()`'s slotted <lr-option>
    // children are themselves LyraElement subclasses that update through this exact same patched
    // prototype method, so a plain "was it called at all" flag would pass even if LyraSelect's
    // own willUpdate() never called super, as long as some sibling element happened to.
    const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void };
    const original = proto.willUpdate;
    let calledOnSelect = false;
    proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
      if (this instanceof LyraSelectCtor) calledOnSelect = true;
      original.call(this, changed);
    };
    try {
      const el = (await fixture(basic())) as LyraSelect;
      await el.updateComplete;
      expect(calledOnSelect).to.be.true;
    } finally {
      proto.willUpdate = original;
    }
  });

  it('calls super.updated so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
    const proto = LyraElement.prototype as unknown as { updated: (changed: PropertyValues) => void };
    const original = proto.updated;
    let calledOnSelect = false;
    proto.updated = function (this: LyraElement, changed: PropertyValues): void {
      if (this instanceof LyraSelectCtor) calledOnSelect = true;
      original.call(this, changed);
    };
    try {
      const el = (await fixture(basic())) as LyraSelect;
      await el.updateComplete;
      expect(calledOnSelect).to.be.true;
    } finally {
      proto.updated = original;
    }
  });
});

describe('start/end adornment slots', () => {
  const part = (el: LyraSelect, name: string) => el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it('renders a slotted glyph inside the trigger, before the value label', async () => {
    const el = (await fixture(html`
      <lr-select>
        <svg slot="start" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5"></circle></svg>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const start = part(el, 'start');
    expect(start.hasAttribute('hidden')).to.be.false;
    const startRect = start.getBoundingClientRect();
    const triggerRect = trigger(el).getBoundingClientRect();
    expect(startRect.width).to.be.greaterThan(0);
    expect(startRect.left).to.be.at.least(triggerRect.left);
  });

  it('places the end adornment before the expand icon', async () => {
    const el = (await fixture(html`
      <lr-select>
        <kbd slot="end">K</kbd>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const end = part(el, 'end');
    expect(end.hasAttribute('hidden')).to.be.false;
    expect(end.compareDocumentPosition(part(el, 'expand-icon')) & Node.DOCUMENT_POSITION_FOLLOWING).to.be.greaterThan(
      0,
    );
  });

  it('hides both wrappers when nothing is slotted', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.updateComplete;
    expect(part(el, 'start').hasAttribute('hidden')).to.be.true;
    expect(part(el, 'end').hasAttribute('hidden')).to.be.true;
    expect(getComputedStyle(part(el, 'start')).display).to.equal('none');
    expect(getComputedStyle(part(el, 'end')).display).to.equal('none');
  });

  it('reveals the wrapper when an adornment is slotted in after first render', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const glyph = document.createElement('span');
    glyph.slot = 'start';
    glyph.textContent = '⌕';
    el.append(glyph);
    await el.updateComplete;
    await el.updateComplete;
    expect(part(el, 'start').hasAttribute('hidden')).to.be.false;
  });
});

it('applies size="2xs" with a 20px trigger min-height', async () => {
  const el = await fixture(
    html`<lr-select size="2xs" label="Role"><lr-option value="a">A</lr-option></lr-select>`,
  );
  const trigger = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  expect(getComputedStyle(trigger).minBlockSize).to.equal('20px');
});

it('reflects size="2xs" as a host attribute', async () => {
  const el = (await fixture(html`<lr-select size="2xs"></lr-select>`)) as LyraSelect;
  expect(el.size).to.equal('2xs');
  expect(el.getAttribute('size')).to.equal('2xs');
});

describe('ElementInternals unavailable at call time (attachInternals throws)', () => {
  it('falls back to no-op ElementInternals when attachInternals() exists but throws (e.g. already attached elsewhere)', () => {
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (): ElementInternals {
      throw new Error('already attached');
    };
    try {
      let el: LyraSelect | undefined;
      expect(() => {
        el = document.createElement('lr-select') as LyraSelect;
      }).to.not.throw();
      expect(el!.checkValidity()).to.be.true;
      expect(el!.reportValidity()).to.be.true;
      expect(el!.form).to.equal(null);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

it('normalizes a nullish name assignment to the empty string and removes the name attribute', async () => {
  const el = (await fixture(html`<lr-select name="fruit"></lr-select>`)) as LyraSelect;
  expect(el.getAttribute('name')).to.equal('fruit');
  (el as unknown as { name: string }).name = null as unknown as string;
  expect(el.name).to.equal('');
  expect(el.hasAttribute('name')).to.be.false;
});

it('normalizes a nullish value assignment to the empty string', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.value = 'a';
  (el as unknown as { value: string }).value = null as unknown as string;
  expect(el.value).to.equal('');
});

describe('formStateRestoreCallback', () => {
  it('restores a string form state verbatim', () => {
    const el = document.createElement('lr-select') as LyraSelect;
    (
      el as unknown as {
        formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
      }
    ).formStateRestoreCallback('a', 'restore');
    expect(el.value).to.equal('a');
  });

  it('restores to empty when the browser hands it a non-string state (e.g. null)', () => {
    const el = document.createElement('lr-select') as LyraSelect;
    el.value = 'a';
    (
      el as unknown as {
        formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
      }
    ).formStateRestoreCallback(null, 'restore');
    expect(el.value).to.equal('');
  });
});

it('seeds a newly-selected option that is slotted in after the initial collection pass', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;

  const defaultSlot = el.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement;
  const slotchangePromise = oneEvent(defaultSlot, 'slotchange');
  const opt = document.createElement('lr-option');
  opt.setAttribute('value', 'b');
  opt.textContent = 'Banana';
  opt.toggleAttribute('selected', true);
  el.append(opt);
  await slotchangePromise;
  await el.updateComplete;

  expect(el.value).to.equal('b');
});

it('does not auto-commit when auto-commit-single-option is set but more than one option is enabled', async () => {
  const el = (await fixture(html`
    <lr-select auto-commit-single-option>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const btn = trigger(el);
  expect(btn.getAttribute('role')).to.equal('combobox');

  btn.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(el.value).to.equal('');
});

it('ignores a dispatched keydown-driven open attempt while disabled', async () => {
  const el = (await fixture(html`
    <lr-select disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('ignores a dispatched click while disabled, even bypassing native click() gating', async () => {
  const el = (await fixture(html`
    <lr-select disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  trigger(el).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('does not select a disabled option row via a direct click, even though the row itself has no native disabled semantics', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" disabled>Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const disabledRow = [...rows(el)].find((r) => r.dataset.value === 'b')!;
  disabledRow.click();
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(el.open).to.be.true; // selection blocked, listbox stays open
});

describe('type-ahead edge cases', () => {
  it('does nothing when every option is disabled', async () => {
    const el = (await fixture(html`
      <lr-select>
        <lr-option value="a" disabled>Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(el.open).to.be.false;
  });

  it('does nothing when no option label starts with the typed character', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('');
  });
});

describe('ArrowUp keyboard handling', () => {
  it('commits the sole option on ArrowUp too, not just ArrowDown', async () => {
    const el = (await fixture(html`
      <lr-select auto-commit-single-option>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    setTimeout(() =>
      trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })),
    );
    await oneEvent(el, 'change');
    expect(el.value).to.equal('a');
    expect(el.open).to.be.false;
  });

  it('navigates upward with ArrowUp when already open, decrementing the active index', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    el.open = true;
    await el.updateComplete;

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete; // active index -> 1 (Banana)

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    await el.updateComplete;

    const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
    expect(active?.textContent).to.contain('Apple');
  });
});

it('closes the listbox on Enter without selecting anything when no option has been made active yet', async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.value).to.equal('');
  expect(el.open).to.be.false;
});

describe('Home/End keyboard handling', () => {
  it('jumps to the first option with Home while open', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    el.open = true;
    await el.updateComplete;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await el.updateComplete; // active index -> 1 (Banana)

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await el.updateComplete;

    const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
    expect(active?.textContent).to.contain('Apple');
  });

  it('jumps to the last option with End while open', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    el.open = true;
    await el.updateComplete;

    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;

    const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
    expect(active?.textContent).to.contain('Cherry');
  });

  it('ignores Home/End while the listbox is closed', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});

it('ignores a listbox click that lands outside any option row (e.g. a group-label or empty padding)', async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" group="Fruits">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;
  const groupLabel = listbox.querySelector('.group-label') as HTMLElement;
  groupLabel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(el.open).to.be.true;
});

describe('selected-state theming tokens', () => {
  it('honours --lr-select-option-selected-color on the selected row', async () => {
    const el = (await fixture(html`
      <lr-select value="a" style="--lr-select-option-selected-color: rgb(1, 2, 3);">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector('[part="option"][aria-selected="true"]') as HTMLElement;
    expect(getComputedStyle(selected).color).to.equal('rgb(1, 2, 3)');
  });

  it('honours --lr-select-option-selected-bg on the selected row', async () => {
    const el = (await fixture(html`
      <lr-select value="a" style="--lr-select-option-selected-bg: rgb(4, 5, 6);">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector('[part="option"][aria-selected="true"]') as HTMLElement;
    expect(getComputedStyle(selected).backgroundColor).to.equal('rgb(4, 5, 6)');
  });

  it('leaves the selected row at the brand color when the token is unset (regression)', async () => {
    const el = (await fixture(html`
      <lr-select value="a">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector('[part="option"][aria-selected="true"]') as HTMLElement;
    const brand = getComputedStyle(el).getPropertyValue('--lr-color-brand').trim();
    // Resolve the brand token through a probe element so we compare like-for-like rgb() values.
    const probe = document.createElement('span');
    probe.style.color = brand;
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    expect(getComputedStyle(selected).color).to.equal(expected);
  });
});
