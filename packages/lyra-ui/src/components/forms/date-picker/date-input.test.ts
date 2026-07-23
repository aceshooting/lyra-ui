import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './date-input.js';
import type { LyraDateInput } from './date-input.js';
import type { LyraDatePicker } from './date-picker.js';
import { styles } from './date-input.styles.js';

it('parses typed input into an ISO value and emits change', async () => {
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  input.value = '2026-07-15';
  setTimeout(() => input.dispatchEvent(new Event('change')));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-15');
});

it('forwards host click to the native input and suppresses it while effectively disabled', async () => {
  const form = (await fixture(html`
    <form><fieldset><lr-date-input></lr-date-input></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-date-input') as LyraDateInput;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const input = el.shadowRoot!.querySelector('input[part="input"]') as HTMLInputElement;
  let clicks = 0;
  input.addEventListener('click', () => clicks++);

  el.click();
  expect(clicks).to.equal(1);
  fieldset.disabled = true;
  el.click();
  expect(clicks).to.equal(1);
});

it('reverts an unparseable typed date to the last committed display text and flags badInput', async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const committedDisplay = input.value;

  input.value = 'not a date';
  input.dispatchEvent(new Event('change'));
  await el.updateComplete;

  expect(el.value).to.equal('2026-07-15'); // committed value untouched
  expect(input.value).to.equal(committedDisplay); // reverted, not left showing garbage
  expect(el.checkValidity()).to.be.false;
  expect(el.internals.validity.badInput).to.be.true;
});

it('flags an ISO-shaped but calendar-invalid typed date (e.g. Feb 30) as badInput instead of silently correcting it', async () => {
  // Regression test: parseISO used to accept "2026-02-30" via JS Date's
  // auto-rollover (returning March 2) instead of null, and Date.parse() has
  // the same rollover behavior for an ISO-shaped string -- so a mistyped day
  // used to silently commit a different date with no feedback at all.
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const committedDisplay = input.value;

  input.value = '2026-02-30';
  input.dispatchEvent(new Event('change'));
  await el.updateComplete;

  expect(el.value).to.equal('2026-07-15'); // not silently rolled over to March 2
  expect(input.value).to.equal(committedDisplay);
  expect(el.checkValidity()).to.be.false;
  expect(el.internals.validity.badInput).to.be.true;
});

it('opens the calendar and commits a picked date', async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const picker = el.shadowRoot!.querySelector('lr-date-picker')!;
  await (picker as unknown as LyraDateInput).updateComplete;
  const day = picker.shadowRoot!.querySelector('[data-date="2026-07-22"]') as HTMLButtonElement;
  setTimeout(() => day.click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-22');
  expect(el.open).to.be.false; // single mode closes on pick
});

it('defaults to size "m" and reflects a non-default size attribute', async () => {
  const defaultEl = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  expect(defaultEl.size).to.equal('m');
  expect(defaultEl.getAttribute('size')).to.equal('m');
  const el = (await fixture(html`<lr-date-input size="s"></lr-date-input>`)) as LyraDateInput;
  expect(el.size).to.equal('s');
  expect(el.getAttribute('size')).to.equal('s');
});

it('supports size="2xs": tighter padding/font-size than the default m tier', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(
    /:host\(\[size='2xs'\]\)\s*\{[^}]*--lr-date-input-padding-block:\s*var\(--lr-size-0-0625rem\);[^}]*--lr-date-input-padding-inline:\s*var\(--lr-space-2xs\);[^}]*--lr-date-input-font-size:\s*var\(--lr-font-size-2xs\);/,
  );
});

it('opens the calendar popover and commits a picked date at a non-default size, keeping the toggle buttons\' touch target', async () => {
  // Exercises the popup/toggle at a non-default size tier: the field's own
  // padding/font-size shrink under size="s", but positioning, keyboard
  // interaction, and the accessible minimum hit area on the calendar-toggle
  // and clear buttons must all keep working exactly as at the default size.
  const el = (await fixture(
    html`<lr-date-input size="s" value="2026-07-15" with-clear></lr-date-input>`,
  )) as LyraDateInput;
  expect(el.getAttribute('size')).to.equal('s');
  el.show();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const picker = el.shadowRoot!.querySelector('lr-date-picker')!;
  await (picker as unknown as LyraDateInput).updateComplete;
  const day = picker.shadowRoot!.querySelector('[data-date="2026-07-22"]') as HTMLButtonElement;
  setTimeout(() => day.click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-22');
  expect(el.open).to.be.false;

  const expandBtn = el.shadowRoot!.querySelector('[part="expand-button"]') as HTMLElement;
  expect(expandBtn.getBoundingClientRect().height).to.be.greaterThan(24);
  expect(expandBtn.getBoundingClientRect().width).to.be.greaterThan(24);
  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLElement;
  expect(clearBtn.getBoundingClientRect().height).to.be.greaterThan(24);
  expect(clearBtn.getBoundingClientRect().width).to.be.greaterThan(24);
});

it('renders the unset default size identically to an explicit size="m"', async () => {
  const unset = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  const explicit = (await fixture(
    html`<lr-date-input size="m" value="2026-07-15"></lr-date-input>`,
  )) as LyraDateInput;
  const unsetWrapper = unset.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  const explicitWrapper = explicit.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  expect(getComputedStyle(unsetWrapper).padding).to.equal(getComputedStyle(explicitWrapper).padding);
  const unsetInput = unset.shadowRoot!.querySelector('[part="input"]') as HTMLElement;
  const explicitInput = explicit.shadowRoot!.querySelector('[part="input"]') as HTMLElement;
  expect(getComputedStyle(unsetInput).fontSize).to.equal(getComputedStyle(explicitInput).fontSize);
});

it('fires exactly one input event per day pick, not two', async () => {
  // Regression test: the nested <lr-date-picker>'s own 'input' event
  // (LyraElement.emit always dispatches bubbles:true, composed:true) had no
  // listener wired on it in date-input's render(), so it bubbled straight
  // through the shadow boundary and fired a second, uncounted 'input' on
  // this host on top of onPickerChange's own explicit emit.
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lr-date-picker')!;
  await (picker as unknown as LyraDateInput).updateComplete;

  let inputCount = 0;
  el.addEventListener('input', () => inputCount++);

  const day = picker.shadowRoot!.querySelector('[data-date="2026-07-22"]') as HTMLButtonElement;
  setTimeout(() => day.click());
  await oneEvent(el, 'change');
  expect(inputCount).to.equal(1);
});

it('fires exactly one input event per range click, and one change once the range completes', async () => {
  const el = (await fixture(html`<lr-date-input mode="range"></lr-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lr-date-picker') as LyraDatePicker;
  await picker.updateComplete;
  picker.goToDate('2026-07-01');
  await picker.updateComplete;

  let inputCount = 0;
  let changeCount = 0;
  el.addEventListener('input', () => inputCount++);
  el.addEventListener('change', () => changeCount++);

  (picker.shadowRoot!.querySelector('[data-date="2026-07-05"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(inputCount, 'the first click of a range should fire input once').to.equal(1);
  expect(changeCount).to.equal(0);

  setTimeout(() => (picker.shadowRoot!.querySelector('[data-date="2026-07-10"]') as HTMLButtonElement).click());
  await oneEvent(el, 'change');
  expect(inputCount, 'the second click of a range should fire input a second time, not a third').to.equal(2);
  expect(changeCount).to.equal(1);
});

it('does not flag badInput for the half-completed range value produced by the first click of a range pick', async () => {
  // Regression test: valueDates() required exactly 2 parts in range mode,
  // so the single-part value the picker commits after only the first click
  // of a range (a completely normal, transient state) tripped badInput
  // until the second click completed the pair.
  const el = (await fixture(html`<lr-date-input mode="range"></lr-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lr-date-picker') as LyraDatePicker;
  await picker.updateComplete;
  picker.goToDate('2026-07-01');
  await picker.updateComplete;

  (picker.shadowRoot!.querySelector('[data-date="2026-07-05"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(el.value).to.equal('2026-07-05');
  expect(el.internals.validity.badInput).to.be.false;
  expect(el.checkValidity()).to.be.true;
});

it('flags a required half-completed range value as valueMissing, not badInput', async () => {
  const el = (await fixture(
    html`<lr-date-input mode="range" required></lr-date-input>`,
  )) as LyraDateInput;
  el.value = '2026-07-05';

  expect(el.internals.validity.badInput).to.be.false;
  expect(el.internals.validity.valueMissing).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.value = '2026-07-05/2026-07-10';
  expect(el.internals.validity.valueMissing).to.be.false;
  expect(el.checkValidity()).to.be.true;
});

it('auto-closes the popover once a range selection is completed, not just in single mode', async () => {
  const el = (await fixture(html`<lr-date-input mode="range"></lr-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lr-date-picker') as LyraDatePicker;
  await picker.updateComplete;
  picker.goToDate('2026-07-01');
  await picker.updateComplete;

  (picker.shadowRoot!.querySelector('[data-date="2026-07-05"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.open, 'should stay open after the first click of a range').to.be.true;

  setTimeout(() => (picker.shadowRoot!.querySelector('[data-date="2026-07-10"]') as HTMLButtonElement).click());
  await oneEvent(el, 'change');
  expect(el.open, 'should close once the range selection is complete').to.be.false;
});

it('closes the popover on Escape from anywhere inside the form control', async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const formControl = el.shadowRoot!.querySelector('[part="form-control"]') as HTMLElement;
  formControl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('propagates disable-past/disable-future/with-outside-days to the nested lr-date-picker', async () => {
  const el = (await fixture(
    html`<lr-date-input disable-past disable-future with-outside-days></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lr-date-picker') as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.disablePast).to.be.true;
  expect(picker.disableFuture).to.be.true;
  expect(picker.withOutsideDays).to.be.true;
});

it('links the expand-button to the popup via aria-controls', async () => {
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const expandBtn = el.shadowRoot!.querySelector('[part="expand-button"]') as HTMLElement;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.id, 'expected the popup to have an id').to.not.equal('');
  expect(expandBtn.getAttribute('aria-controls')).to.equal(popup.id);
});

it('shows a formatted display value', async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  expect(input.value).to.not.be.empty;
  expect(input.value).to.not.equal('2026-07-15'); // locale-formatted, not raw ISO
});

it('clears via the clear button', async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15" with-clear></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const clear = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement;
  setTimeout(() => clear.click());
  await oneEvent(el, 'lr-clear');
  expect(el.value).to.equal('');
});

it('touches a required field on clear() so the resulting invalid state is surfaced immediately', async () => {
  // Regression test: clear() used to reset `value` without setting `touched`,
  // so a required-and-now-empty field kept looking valid (no data-invalid)
  // until some later, unrelated blur -- even though the field was just
  // emptied by an explicit, user-initiated action.
  const el = (await fixture(
    html`<lr-date-input with-clear required value="2026-07-15"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.false;

  el.clear();
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.true;
});

it('participates in a form', async () => {
  const form = (await fixture(html`
    <form><lr-date-input name="d" value="2026-07-15"></lr-date-input></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get('d')).to.equal('2026-07-15');
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lr-date-input label="Start date" value="2026-07-15"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('blocks a required, empty date input from submitting the form', async () => {
  const form = (await fixture(
    html`<form><lr-date-input name="d" required></lr-date-input></form>`,
  )) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it('focuses its input when typed bad-input validation fails directly or during form submission', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button" id="sentinel">Before</button>
      <lr-date-input name="d" value="2026-07-15"></lr-date-input>
      <button type="submit">Submit</button>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-date-input') as LyraDateInput;
  const sentinel = form.querySelector('#sentinel') as HTMLButtonElement;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  input.value = 'not a date';
  input.dispatchEvent(new Event('change'));
  await el.updateComplete;
  expect(el.internals.validity.badInput).to.be.true;

  sentinel.focus();
  expect(document.activeElement?.id).to.equal('sentinel');
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-date-input');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('input');

  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });
  sentinel.focus();
  expect(document.activeElement?.id).to.equal('sentinel');
  form.requestSubmit();
  expect(submits).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lr-date-input');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('input');
});

it('re-syncs ElementInternals validity when required is toggled after connection', async () => {
  const form = (await fixture(
    html`<form><lr-date-input name="d"></lr-date-input></form>`,
  )) as HTMLFormElement;
  const el = form.querySelector('lr-date-input') as LyraDateInput;
  expect(form.reportValidity()).to.be.true;

  el.required = true;
  await el.updateComplete;
  expect(form.reportValidity()).to.be.false;

  el.value = '2026-07-15';
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

describe('complete programmatic validity', () => {
  it('retains an out-of-range declarative value and reports its precise bound failure', async () => {
    const form = (await fixture(html`
      <form>
        <lr-date-input name="d" min="2026-01-01" max="2026-12-31" value="2027-01-01"></lr-date-input>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-date-input') as LyraDateInput;

    expect(el.value).to.equal('2027-01-01');
    expect(new FormData(form).get('d')).to.equal('2027-01-01');
    expect(el.internals.validity.rangeOverflow).to.be.true;
    expect(el.checkValidity()).to.be.false;
  });

  it('recomputes min and max validity synchronously for property and attribute changes', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`,
    )) as LyraDateInput;

    el.min = '2026-08-01';
    expect(el.internals.validity.rangeUnderflow).to.be.true;

    el.min = '';
    expect(el.checkValidity()).to.be.true;

    el.setAttribute('max', '2026-06-30');
    expect(el.internals.validity.rangeOverflow).to.be.true;

    el.removeAttribute('max');
    expect(el.checkValidity()).to.be.true;

    el.min = 'not-a-date';
    el.max = '2026-99-99';
    expect(el.checkValidity()).to.be.true;
  });

  it('recomputes disable-past and disable-future validity synchronously', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2000-01-01"></lr-date-input>`,
    )) as LyraDateInput;

    el.setAttribute('disable-past', '');
    expect(el.internals.validity.rangeUnderflow).to.be.true;

    el.removeAttribute('disable-past');
    el.value = '2999-01-01';
    el.disableFuture = true;
    expect(el.internals.validity.rangeOverflow).to.be.true;

    el.disableFuture = false;
    expect(el.checkValidity()).to.be.true;
  });

  it('refreshes temporal validity when checkValidity crosses local midnight', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-14" disable-past></lr-date-input>`,
    )) as LyraDateInput;
    const clock = el as unknown as { now: () => Date };

    clock.now = () => new Date(2026, 6, 14, 23, 59);
    expect(el.checkValidity()).to.be.true;

    clock.now = () => new Date(2026, 6, 15, 0, 1);
    expect(el.checkValidity()).to.be.false;
    expect(el.internals.validity.rangeUnderflow).to.be.true;
  });

  it('refreshes temporal validity when the document becomes visible again', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-14" disable-past></lr-date-input>`,
    )) as LyraDateInput;
    const clock = el as unknown as { now: () => Date };

    clock.now = () => new Date(2026, 6, 14, 23, 59);
    expect(el.checkValidity()).to.be.true;
    clock.now = () => new Date(2026, 6, 15, 0, 1);

    el.ownerDocument.dispatchEvent(new Event('visibilitychange'));
    await el.updateComplete;
    expect(el.internals.validity.rangeUnderflow).to.be.true;
  });

  it('checks every range endpoint and can report underflow and overflow together', async () => {
    const el = (await fixture(html`
      <lr-date-input
        mode="range"
        value="2025-12-31/2027-01-01"
        min="2026-01-01"
        max="2026-12-31"
      ></lr-date-input>
    `)) as LyraDateInput;

    expect(el.internals.validity.rangeUnderflow).to.be.true;
    expect(el.internals.validity.rangeOverflow).to.be.true;
    expect(el.checkValidity()).to.be.false;
  });

  it('reports the explicit bound when it is stricter than a temporal bound', async () => {
    const year = new Date().getFullYear();
    const futureValue = `${year + 1}-01-01`;
    const futureMin = `${year + 2}-01-01`;
    const underflow = (await fixture(html`
      <lr-date-input disable-past value=${futureValue} min=${futureMin}></lr-date-input>
    `)) as LyraDateInput;
    expect(underflow.internals.validity.rangeUnderflow).to.be.true;
    expect(underflow.internals.validationMessage).to.contain(futureMin);

    const pastValue = `${year - 1}-01-01`;
    const pastMax = `${year - 2}-01-01`;
    const overflow = (await fixture(html`
      <lr-date-input disable-future value=${pastValue} max=${pastMax}></lr-date-input>
    `)) as LyraDateInput;
    expect(overflow.internals.validity.rangeOverflow).to.be.true;
    expect(overflow.internals.validationMessage).to.contain(pastMax);
  });

  it('sanitizes calendar-invalid declarative, IDL, and restored values to empty', async () => {
    const form = (await fixture(html`
      <form><lr-date-input name="d" value="2026-02-30"></lr-date-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-date-input') as LyraDateInput;

    expect(el.value).to.equal('');
    expect(new FormData(form).get('d')).to.equal('');

    el.value = 'not-an-iso-date';
    expect(el.value).to.equal('');
    expect(el.checkValidity()).to.be.true;

    el.required = true;
    el.value = 'still-not-an-iso-date';
    expect(el.internals.validity.valueMissing).to.be.true;
    expect(el.internals.validity.badInput).to.be.false;

    (el as unknown as { formStateRestoreCallback(state: string): void }).formStateRestoreCallback('2026-13-01');
    expect(el.value).to.equal('');
  });

  it('revalidates restored and reset values against the current constraints', async () => {
    const form = (await fixture(html`
      <form><lr-date-input name="d" value="2026-07-15" max="2026-12-31"></lr-date-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-date-input') as LyraDateInput;

    (el as unknown as { formStateRestoreCallback(state: string): void }).formStateRestoreCallback('2027-01-01');
    expect(el.value).to.equal('2027-01-01');
    expect(el.internals.validity.rangeOverflow).to.be.true;

    el.max = '2026-06-30';
    form.reset();
    expect(el.value).to.equal('2026-07-15');
    expect(el.internals.validity.rangeOverflow).to.be.true;
  });

  it('bars required and bound validation while readonly, then restores it synchronously', async () => {
    const empty = (await fixture(
      html`<lr-date-input required></lr-date-input>`,
    )) as LyraDateInput;
    expect(empty.checkValidity()).to.be.false;

    empty.readonly = true;
    expect(empty.checkValidity()).to.be.true;
    expect(empty.internals.willValidate).to.be.false;

    empty.readonly = false;
    expect(empty.internals.willValidate).to.be.true;
    expect(empty.internals.validity.valueMissing).to.be.true;

    const bounded = (await fixture(
      html`<lr-date-input value="2027-01-01" max="2026-12-31"></lr-date-input>`,
    )) as LyraDateInput;
    expect(bounded.internals.validity.rangeOverflow).to.be.true;
    bounded.readonly = true;
    expect(bounded.checkValidity()).to.be.true;
  });

  it('revalidates the committed ISO shape when mode changes', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`,
    )) as LyraDateInput;

    // A single-part value is a valid, incomplete range selection once in
    // range mode -- the same shape the picker's first range click commits --
    // not a malformed one.
    el.mode = 'range';
    expect(el.internals.validity.badInput).to.be.false;
    expect(el.checkValidity()).to.be.true;

    // A two-part value genuinely is invalid back in single mode, and mode
    // changes must still revalidate to catch that.
    el.value = '2026-07-01/2026-07-15';
    el.mode = 'single';
    expect(el.internals.validity.badInput).to.be.true;

    el.mode = 'range';
    expect(el.checkValidity()).to.be.true;
  });

  it('normalizes a reversed programmatic range into canonical order', async () => {
    const el = (await fixture(
      html`<lr-date-input mode="range"></lr-date-input>`,
    )) as LyraDateInput;

    el.value = '2026-07-20/2026-07-10';
    expect(el.value).to.equal('2026-07-10/2026-07-20');
    expect(el.checkValidity()).to.be.true;
  });

  it('preserves typed badInput across constraint changes and clears it on a committed value', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`,
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;

    input.value = 'not a date';
    input.dispatchEvent(new Event('change'));
    expect(el.internals.validity.badInput).to.be.true;

    el.max = '2026-12-31';
    expect(el.internals.validity.badInput).to.be.true;

    el.value = '2026-08-01';
    expect(el.checkValidity()).to.be.true;
    expect(el.internals.validity.badInput).to.be.false;
  });

  it('refreshes touched invalid styling after a constraint-only change', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`,
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(el.hasAttribute('data-invalid')).to.be.false;

    el.max = '2026-06-30';
    await el.updateComplete;
    expect(el.hasAttribute('data-invalid')).to.be.true;

    el.max = '';
    await el.updateComplete;
    expect(el.hasAttribute('data-invalid')).to.be.false;
  });

  it('refreshes touched invalid styling after a typed parse failure', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15"></lr-date-input>`,
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(el.hasAttribute('data-invalid')).to.be.false;

    input.value = 'not a date';
    input.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.hasAttribute('data-invalid')).to.be.true;
  });
});

it('restores the constructed value (not blank) on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lr-date-input name="d" value="2026-07-15"></lr-date-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-date-input') as LyraDateInput;
  el.value = '2026-08-01';
  form.reset();
  expect(el.value).to.equal('2026-07-15');
});

it('does not let a typed-in value become the reset default when there is no `value` attribute', async () => {
  // Regression test: previously the *first* assignment to `.value` after
  // construction — even a user's own first edit of a blank required field —
  // silently became the permanent reset default.
  const form = (await fixture(
    html`<form><lr-date-input name="d"></lr-date-input></form>`,
  )) as HTMLFormElement;
  const el = form.querySelector('lr-date-input') as LyraDateInput;
  el.value = 'first-user-edit';
  el.value = 'second-user-edit';
  form.reset();
  expect(el.value).to.equal('');
});

it('uses shared svg icons instead of literal glyphs for clear and calendar toggle', async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" with-clear></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;

  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLElement;
  expect(clearBtn.querySelector('svg')).to.exist;
  expect(clearBtn.textContent?.trim()).to.equal('');

  const expandIcon = el.shadowRoot!.querySelector('[part="expand-icon"]') as HTMLElement;
  expect(expandIcon.querySelector('svg')).to.exist;
  expect(expandIcon.textContent?.trim()).to.equal('');
});

it('transitions the popup with the shared fast-transition token and respects reduced motion', () => {
  const css = styles.cssText;
  const popupBlock = /\[part=['"]?popup['"]?]\s*{([^}]*)}/.exec(css);
  expect(popupBlock, 'expected a base [part="popup"] rule').to.not.equal(null);
  expect(popupBlock![1]).to.include('var(--lr-transition-fast)');
  expect(css).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

it('gives the clear/expand buttons a real touch target instead of collapsing to bare glyph height', async () => {
  const css = styles.cssText;
  const btnBlock = /\[part=['"]?clear-button['"]?],\s*\[part=['"]?expand-button['"]?]\s*{([^}]*)}/.exec(css);
  expect(btnBlock, 'expected a shared [part="clear-button"], [part="expand-button"] rule').to.not.equal(null);
  expect(btnBlock![1]).to.include('var(--lr-icon-button-size)');

  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" with-clear></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const expandBtn = el.shadowRoot!.querySelector('[part="expand-button"]') as HTMLElement;
  expect(expandBtn.getBoundingClientRect().height).to.be.greaterThan(24);
  // WCAG 2.2 SC 2.5.8 requires a 24x24 CSS-px minimum target *in both
  // dimensions* — a tall-but-narrow button still fails it.
  expect(expandBtn.getBoundingClientRect().width).to.be.greaterThan(24);

  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLElement;
  expect(clearBtn.getBoundingClientRect().width).to.be.greaterThan(24);
});

it('hides the error and hint parts when empty, shows them once populated', async () => {
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  // Neither part can rely on `:empty` — each always contains a literal
  // `<slot>` child element, so `:empty` never matches regardless of
  // assigned/text content (same bug class fixed for lr-stat).
  expect(getComputedStyle(errorPart).display).to.equal('none');
  expect(getComputedStyle(hintPart).display).to.equal('none');

  el.errorText = 'Invalid date';
  el.hint = 'Use ISO format';
  await el.updateComplete;
  expect(getComputedStyle(errorPart).display).to.not.equal('none');
  expect(getComputedStyle(hintPart).display).to.not.equal('none');
});

it('renders errorText in var(--lr-color-danger), distinct from and alongside the hint', async () => {
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  el.hint = 'Use ISO format';
  el.errorText = 'Invalid date';
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  expect(errorPart).to.exist;
  expect(errorPart.textContent).to.contain('Invalid date');
  expect(hintPart.textContent).to.contain('Use ISO format');
  expect(getComputedStyle(errorPart).color).to.not.equal(getComputedStyle(hintPart).color);
});

it('reflects an invalid state only after the field has been interacted with once', async () => {
  const el = (await fixture(html`<lr-date-input required></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.false;

  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  input.dispatchEvent(new FocusEvent('focus'));
  input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.true;
});

it('shows a required-field asterisk after the label', async () => {
  const el = (await fixture(
    html`<lr-date-input label="Start date" required></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  const after = getComputedStyle(label, '::after');
  expect(after.content).to.contain('*');
});

it('does not render an orphaned asterisk when required but no label is provided', async () => {
  const el = (await fixture(html`<lr-date-input required></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;

  // The label box always contains a literal `<slot name="label">` child,
  // so `:empty` can never match it (same bug class already fixed for
  // hint/error) -- real emptiness must be tracked in JS and reflected via
  // `hidden`, or the required-asterisk `::after` (which attaches to this
  // box) renders a stray ' *' with nothing before it.
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label).display).to.equal('none');
});

it('clamps the popup to the viewport width like the combobox listbox', () => {
  expect(styles.cssText).to.include(
    'max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-28rem))',
  );
});

it('propagates disabled/readonly to the nested lr-date-picker so its days actually stop being interactive', async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" disabled></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lr-date-picker') as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.disabled).to.be.true;

  el.disabled = false;
  el.readonly = true;
  await el.updateComplete;
  await picker.updateComplete;
  expect(picker.readonly).to.be.true;
});

it('shows a not-allowed cursor on the disabled input wrapper', async () => {
  const el = (await fixture(html`<lr-date-input disabled></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const wrapper = el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  expect(getComputedStyle(wrapper).cursor).to.equal('not-allowed');
});

it('pairs the form-control label with the date input via for/id so clicking the label focuses it', async () => {
  const el = (await fixture(
    html`<lr-date-input label="Start date" value="2026-07-15"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLLabelElement;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  expect(label.htmlFor, 'label should have a for attribute').to.not.equal('');
  expect(label.htmlFor).to.equal(input.id);
});

it('propagates locale, first-day-of-week and weekday-format to the nested lr-date-picker', async () => {
  const el = (await fixture(
    html`<lr-date-input locale="fr-FR" first-day-of-week="mon" weekday-format="narrow"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lr-date-picker') as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.locale).to.equal('fr-FR');
  expect(picker.firstDayOfWeek).to.equal('mon');
  expect(picker.weekdayFormat).to.equal('narrow');
});

it('normalizes invalid calendar count and weekday format attributes before propagation', async () => {
  const el = (await fixture(
    html`<lr-date-input months="999" weekday-format="bogus"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lr-date-picker') as LyraDatePicker;
  await picker.updateComplete;

  expect(el.months).to.equal(2);
  expect(el.weekdayFormat).to.equal('short');
  expect(picker.months).to.equal(2);
  expect(picker.weekdayFormat).to.equal('short');
  expect(picker.shadowRoot!.querySelectorAll('[part="month"]')).to.have.length(2);
});

it('falls back to the default locale when a malformed locale is supplied', async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" locale="not_a_locale"></lr-date-input>`,
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const picker = el.shadowRoot!.querySelector('lr-date-picker') as LyraDatePicker;
  await picker.updateComplete;

  expect(input.value).to.equal(new Date(2026, 6, 15).toLocaleDateString());
  expect(picker.shadowRoot!.querySelectorAll('[part="weekday"]')).to.have.length(7);
});

it('formats the displayed value using the locale property', async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" locale="fr-FR"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  expect(input.value).to.equal(new Date(2026, 6, 15).toLocaleDateString('fr-FR'));
});

it('derives the displayed value, the day/month/year parse order, and the nested picker locale from an inherited lang ancestor with no locale attribute set', async () => {
  // Regression test: displayText's formatter, localeDateOrder() (which
  // decides how an ambiguous typed date like "03/04/2026" is parsed), and the
  // `.locale=` binding forwarded to the nested <lr-date-picker> all used to
  // read the raw `locale` prop (default '') directly instead of
  // `effectiveLocale`, which also walks lang/locale ancestors -- so an
  // inherited <div lang="en-GB"> was silently ignored, both for display and
  // for day-first vs month-first parsing.
  const wrapper = await fixture(html`
    <div lang="en-GB"><lr-date-input value="2026-07-15"></lr-date-input></div>
  `);
  const el = wrapper.querySelector('lr-date-input') as LyraDateInput;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  expect(input.value).to.equal(new Date(2026, 6, 15).toLocaleDateString('en-GB'));

  const picker = el.shadowRoot!.querySelector('lr-date-picker') as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.locale).to.equal('en-GB');

  // en-GB reads day/month/year, so "03/04/2026" is April 3rd, not March 4th.
  input.value = '03/04/2026';
  setTimeout(() => input.dispatchEvent(new Event('change')));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-04-03');
});

it('applies the shared focus-ring tokens to the clear and expand buttons', () => {
  const css = styles.cssText;
  const focusBlock = /\[part=['"]?clear-button['"]?]:focus-visible,\s*\[part=['"]?expand-button['"]?]:focus-visible\s*{([^}]*)}/.exec(css);
  expect(focusBlock, 'expected a shared clear/expand :focus-visible rule').to.not.equal(null);
  expect(focusBlock![1]).to.include('var(--lr-focus-ring-width)');
  expect(focusBlock![1]).to.include('var(--lr-focus-ring-color)');
});

it('round-trips a rendered range string typed back into the field', async () => {
  const el = (await fixture(
    html`<lr-date-input mode="range" value="2026-05-01/2026-05-15"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  const rendered = input.value; // the actual locale-formatted range this component rendered
  expect(rendered, 'expected the en-dash range separator in the rendered text').to.include(' – ');

  // Clear the committed value first so the assertion below can only pass if
  // parseRangeText actually recovers '2026-05-01/2026-05-15' from the typed
  // text -- a stale, never-reset `el.value` would otherwise make this pass
  // trivially even with completely broken parsing.
  el.value = '';
  await el.updateComplete;

  input.value = rendered; // re-type the exact displayed text
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('2026-05-01/2026-05-15');
});

it('also accepts a raw ISO range typed directly, as a convenience', async () => {
  const el = (await fixture(html`<lr-date-input mode="range"></lr-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = '2026-05-01/2026-05-15';
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('2026-05-01/2026-05-15');
});

it('retains a typed date outside min/max and reports rangeOverflow rather than badInput', async () => {
  const el = (await fixture(
    html`<lr-date-input min="2026-01-01" max="2026-12-31"></lr-date-input>`,
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = '2027-01-01';
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('2027-01-01');
  expect(el.internals.validity.rangeOverflow).to.be.true;
  expect(el.internals.validity.badInput).to.be.false;
  expect(el.checkValidity()).to.be.false;
});

it('retains a typed date before disable-past\'s today floor and reports rangeUnderflow', async () => {
  const el = (await fixture(html`<lr-date-input disable-past></lr-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = '2000-01-01';
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('2000-01-01');
  expect(el.internals.validity.rangeUnderflow).to.be.true;
  expect(el.internals.validity.badInput).to.be.false;
  expect(el.checkValidity()).to.be.false;
});

it('keeps the clear button disabled while the control is disabled', async () => {
  const el = (await fixture(
    html`<lr-date-input disabled with-clear value="2026-01-01"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement | null;
  expect(clearBtn?.disabled).to.be.true;
});

it('keeps the clear button disabled while the control is readonly', async () => {
  const el = (await fixture(
    html`<lr-date-input readonly with-clear value="2026-01-01"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement | null;
  expect(clearBtn?.disabled).to.be.true;
});

it('re-binds positioning after a disconnect+reconnect while open', async () => {
  const el = (await fixture(html`<lr-date-input open></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  const popup = el.shadowRoot!.querySelector('[part="popup"] [part="date-picker"]')!;
  expect(popup).to.exist; // popup content still renders; positioning re-attached, not just left stale
});

it('resets `open` on disconnect so a later reconnect starts from a clean, re-bindable state', async () => {
  // Regression test: disconnectedCallback used to tear down the position
  // listener (cleanupFn) and the document pointerdown listener but never
  // reset `open` itself -- so `open` stayed stuck `true` across a
  // disconnect, and because `updated()` only rebinds positioning when
  // `open` *changes*, a reconnect while still nominally "open" would never
  // re-run `place()`.
  const el = (await fixture(html`<lr-date-input open></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  expect(el.open, 'disconnect should reset open').to.be.false;
  parent.appendChild(el);
});

it('does not override an explicit `label` slot with the fallback aria-label', async () => {
  const el = (await fixture(
    html`<lr-date-input><span slot="label">Start date</span></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.getAttribute('aria-label')).to.not.equal('Date');
});

it('wires aria-describedby to the visible hint/error text', async () => {
  const el = (await fixture(
    html`<lr-date-input hint="Pick a date" error-text="Required"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  const describedBy = input.getAttribute('aria-describedby') ?? '';
  expect(describedBy).to.include('date-input-hint');
  expect(describedBy).to.include('date-input-error');
});

it('forwards its accessible name and required validity state to the inner input', async () => {
  const el = (await fixture(
    html`<lr-date-input aria-label="Departure date" label="Ignored label" required></lr-date-input>`,
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;

  expect(input.getAttribute('aria-label')).to.equal('Departure date');
  expect(input.required).to.be.true;
  expect(input.getAttribute('aria-required')).to.equal('true');
  expect(input.getAttribute('aria-invalid')).to.equal('false');

  el.setAttribute('aria-label', 'Return date');
  await el.updateComplete;
  expect(input.getAttribute('aria-label')).to.equal('Return date');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(input.hasAttribute('aria-label')).to.be.false;

  input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(input.getAttribute('aria-invalid')).to.equal('true');

  el.value = '2026-07-15';
  await el.updateComplete;
  expect(input.getAttribute('aria-invalid')).to.equal('false');

  el.required = false;
  await el.updateComplete;
  expect(input.required).to.be.false;
  expect(input.getAttribute('aria-required')).to.equal('false');
});

it('reveals invalid state after validation and clears touched presentation on form reset', async () => {
  const form = (await fixture(html`
    <form><lr-date-input name="date" required></lr-date-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-date-input') as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;

  expect(input.getAttribute('aria-invalid')).to.equal('false');
  expect(form.reportValidity()).to.be.false;
  await el.updateComplete;
  expect(input.getAttribute('aria-invalid')).to.equal('true');

  form.reset();
  await el.updateComplete;
  expect(input.getAttribute('aria-invalid')).to.equal('false');
});

it('forwards custom bad-input validity to the inner input after it is touched', async () => {
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;

  input.value = 'not a date';
  input.dispatchEvent(new Event('change'));
  input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;

  expect(el.internals.validity.badInput).to.be.true;
  expect(input.getAttribute('aria-invalid')).to.equal('true');
});

it("parses an ambiguous dd/mm/yyyy-style date according to the locale, not Date.parse()'s bias", async () => {
  const el = (await fixture(html`<lr-date-input locale="en-GB"></lr-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = '15/07/2026'; // en-GB: 15 July 2026 -- Date.parse() would read this as invalid or mm/dd (month 15 -> invalid, or misparsed)
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('2026-07-15');
});

it('parses an ambiguous mm/dd/yyyy-style date according to an en-US locale', async () => {
  const el = (await fixture(html`<lr-date-input locale="en-US"></lr-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = '07/15/2026'; // en-US: July 15, 2026
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('2026-07-15');
});

it('normalizes a typed reversed range into from-before-to order', async () => {
  const el = (await fixture(html`<lr-date-input mode="range"></lr-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = '2026-05-15/2026-05-01';
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('2026-05-01/2026-05-15');
});

it('still parses a non-zero-padded, year-first ISO-ish date -- a 4-digit first group is unambiguously a year', async () => {
  // Regression test: parseOneDate used to route this through Date.parse()
  // directly and it parsed fine ("2026-7-15" -> July 15, 2026). Once the
  // ambiguous-date regex (\d{1,4} per group) was introduced to handle
  // genuinely ambiguous locale-ordered dates like "15/07/2026", this
  // non-padded-but-unambiguous year-first string started matching that same
  // regex too and got misrouted through localeDateOrder()'s day/month/year
  // guessing -- which, for a western field order, does not treat the first
  // group as the year, and rejects the date. A 4-digit first group is
  // unambiguously a year (this is exactly ISO 8601's own year-first
  // convention, just without zero-padding) regardless of locale/separator,
  // so it must be routed straight through parseISO() instead.
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = '2026-7-15';
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('2026-07-15');
});

it('defaults the clear/expand/dialog labels to English but lets them be overridden for other locales', async () => {
  const el = (await fixture(
    html`<lr-date-input with-clear value="2026-07-15"></lr-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;

  const clearBtn = () => el.shadowRoot!.querySelector('[part="clear-button"]')!;
  const expandBtn = () => el.shadowRoot!.querySelector('[part="expand-button"]')!;
  const popup = () => el.shadowRoot!.querySelector('[part="popup"]')!;

  expect(clearBtn().getAttribute('aria-label')).to.equal('Clear');
  expect(expandBtn().getAttribute('aria-label')).to.equal('Open calendar');
  expect(popup().getAttribute('aria-label')).to.equal('Choose date');

  el.clearLabel = 'Effacer';
  el.openLabel = 'Ouvrir le calendrier';
  el.dialogLabel = 'Choisir une date';
  await el.updateComplete;

  expect(clearBtn().getAttribute('aria-label')).to.equal('Effacer');
  expect(expandBtn().getAttribute('aria-label')).to.equal('Ouvrir le calendrier');
  expect(popup().getAttribute('aria-label')).to.equal('Choisir une date');
});

it('routes clear, expand, and dialog labels through .strings', async () => {
  const el = (await fixture(
    html`<lr-date-input with-clear value="2026-07-15"></lr-date-input>`,
  )) as LyraDateInput;
  el.strings = {
    clear: 'Effacer via strings',
    openCalendar: 'Ouvrir via strings',
    chooseDate: 'Choisir via strings',
  };
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="clear-button"]')!.getAttribute('aria-label')).to.equal(
    'Effacer via strings',
  );
  expect(el.shadowRoot!.querySelector('[part="expand-button"]')!.getAttribute('aria-label')).to.equal(
    'Ouvrir via strings',
  );
  expect(el.shadowRoot!.querySelector('[part="popup"]')!.getAttribute('aria-label')).to.equal(
    'Choisir via strings',
  );
});

it('themes the native placeholder through the component placeholder-color hook', async () => {
  const el = (await fixture(html`
    <lr-date-input
      placeholder="Choose a date"
      style="--lr-date-input-placeholder-color: rgb(12, 34, 56)"
    ></lr-date-input>
  `)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  expect(getComputedStyle(input, '::placeholder').color).to.equal('rgb(12, 34, 56)');
});

describe('spellcheck/autocapitalize/autocorrect passthrough', () => {
  it('spellcheck defaults to true', async () => {
    const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    expect(input.spellcheck).to.be.true;
  });

  it('forwards spellcheck=false, autocapitalize, and autocorrect onto the native input', async () => {
    const el = (await fixture(html`
      <lr-date-input spellcheck="false" autocapitalize="off" autocorrect="off"></lr-date-input>
    `)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    expect(input.spellcheck).to.be.false;
    expect(input.getAttribute('autocapitalize')).to.equal('off');
    expect(input.getAttribute('autocorrect')).to.equal('off');
  });

  it('forwards autocomplete, inputmode, and enterkeyhint onto the native input', async () => {
    const el = (await fixture(
      html`<lr-date-input autocomplete="bday" inputmode="numeric" enterkeyhint="next"></lr-date-input>`,
    )) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    expect(input.getAttribute('autocomplete')).to.equal('bday');
    expect(input.getAttribute('inputmode')).to.equal('numeric');
    expect(input.getAttribute('enterkeyhint')).to.equal('next');
  });
});

describe('blur/focus bubbling', () => {
  it('re-dispatches a bubbling, composed blur event when the native input blurs', async () => {
    const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    input.focus();
    const eventPromise = oneEvent(el, 'blur');
    input.blur();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('re-dispatches a bubbling, composed focus event when the native input focuses', async () => {
    const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    const eventPromise = oneEvent(el, 'focus');
    input.focus();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('gives the clear/expand buttons a :hover treatment', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='clear-button'\]:hover,\s*\[part='expand-button'\]:hover\s*\{[^}]+\}/);
  });
});

describe('native-wrapper focus/selection/editing surface', () => {
  it('exposes the internal date text input via a public getter', async () => {
    const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    expect(el.input).to.equal(el.shadowRoot!.querySelector('[part="input"]'));
  });

  it('focus()/blur() delegate to the internal input instead of the host', async () => {
    const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    el.focus();
    expect(el.shadowRoot!.activeElement).to.equal(el.input);
    el.blur();
    expect(el.shadowRoot!.activeElement).to.equal(null);
  });

  it('select() and the selectionStart/selectionEnd accessors operate on the internal input', async () => {
    const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    el.focus();
    el.select();
    expect(el.selectionStart).to.equal(0);
    expect(el.selectionEnd).to.equal(el.input!.value.length);

    el.setSelectionRange(1, 3);
    expect(el.selectionStart).to.equal(1);
    expect(el.selectionEnd).to.equal(3);
  });

  it('setRangeText() edits the field and re-parses it into a new value, keeping value/validity in sync', async () => {
    const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    const displayed = el.input!.value; // e.g. "7/15/2026" under en-US
    const isoOfNext = new Date(2026, 6, 20);
    const replacement = displayed.replace('15', '20');

    el.setRangeText(replacement, 0, displayed.length);
    expect(el.value, 'setRangeText should commit a parseable edit as the new value').to.equal('2026-07-20');
    expect(el.input!.value).to.equal(isoOfNext.toLocaleDateString());
  });

  it('setRangeText() reverts to the last committed display text and flags badInput for an unparseable edit', async () => {
    const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    const committedDisplay = el.input!.value;

    el.setRangeText('not a date', 0, committedDisplay.length);
    expect(el.value, 'an unparseable programmatic edit must not overwrite the committed value').to.equal(
      '2026-07-15',
    );
    expect(el.input!.value).to.equal(committedDisplay);
    expect(el.internals.validity.badInput).to.be.true;
  });
});

it('exposes accessibleLabel as a public property, not just the aria-label attribute', async () => {
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal(null);

  // A JS property assignment (no cast needed since the property is public)
  // must reach the internal input's aria-label, the same as setting the
  // aria-label attribute already did.
  el.accessibleLabel = 'Departure date';
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  expect(input.getAttribute('aria-label')).to.equal('Departure date');
});

describe('start/end adornment slots', () => {
  const part = (el: LyraDateInput, name: string) =>
    el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it('renders a slotted glyph inside the input row, before the text field, with no consumer padding', async () => {
    const el = (await fixture(html`
      <lr-date-input size="s" label="Departure">
        <svg slot="start" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5"></circle></svg>
      </lr-date-input>
    `)) as LyraDateInput;
    await el.updateComplete;
    const start = part(el, 'start');
    expect(start.hasAttribute('hidden')).to.be.false;
    const startRect = start.getBoundingClientRect();
    const rowRect = part(el, 'input-wrapper').getBoundingClientRect();
    const inputRect = part(el, 'input').getBoundingClientRect();
    expect(startRect.width).to.be.greaterThan(0);
    expect(startRect.left).to.be.at.least(rowRect.left);
    expect(startRect.right).to.be.at.most(inputRect.left + 1);
  });

  it('places the end adornment before the calendar toggle', async () => {
    const el = (await fixture(html`
      <lr-date-input label="Departure"><kbd slot="end">D</kbd></lr-date-input>
    `)) as LyraDateInput;
    await el.updateComplete;
    const end = part(el, 'end');
    expect(end.hasAttribute('hidden')).to.be.false;
    expect(
      end.compareDocumentPosition(part(el, 'expand-button')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).to.be.greaterThan(0);
    expect(end.getBoundingClientRect().right).to.be.at.most(
      part(el, 'expand-button').getBoundingClientRect().left + 1,
    );
  });

  it('hides both wrappers when nothing is slotted', async () => {
    const el = (await fixture(html`<lr-date-input label="Departure"></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    expect(part(el, 'start').hasAttribute('hidden')).to.be.true;
    expect(part(el, 'end').hasAttribute('hidden')).to.be.true;
    expect(getComputedStyle(part(el, 'start')).display).to.equal('none');
    expect(getComputedStyle(part(el, 'end')).display).to.equal('none');
  });

  it('reveals the wrapper when an adornment is slotted in after first render', async () => {
    const el = (await fixture(html`<lr-date-input label="Departure"></lr-date-input>`)) as LyraDateInput;
    const glyph = document.createElement('span');
    glyph.slot = 'end';
    glyph.textContent = 'UTC';
    el.append(glyph);
    await el.updateComplete;
    await el.updateComplete;
    expect(part(el, 'end').hasAttribute('hidden')).to.be.false;
  });

  it('places the start adornment on the inline-start under dir="rtl"', async () => {
    const root = await fixture(html`
      <div dir="rtl">
        <lr-date-input label="Departure"><span slot="start">⌕</span></lr-date-input>
      </div>
    `);
    const el = root.querySelector('lr-date-input') as LyraDateInput;
    await el.updateComplete;
    expect(part(el, 'start').getBoundingClientRect().left).to.be.greaterThan(
      part(el, 'input').getBoundingClientRect().left,
    );
  });

  it('is accessible with adornments slotted', async () => {
    const el = (await fixture(html`
      <lr-date-input label="Departure" with-clear value="2026-07-15">
        <span slot="start" aria-hidden="true">⌕</span>
        <kbd slot="end">D</kbd>
      </lr-date-input>
    `)) as LyraDateInput;
    await el.updateComplete;
    expect(part(el, 'clear-button')).to.exist;
    await expect(el).to.be.accessible();
  });
});

describe('control min-height knob and exact-height hatch', () => {
  const wrapper = (el: LyraDateInput): HTMLElement =>
    el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;

  it('does NOT declare the --lr-date-input-control-height sentinel (guards the lr-select trap)', async () => {
    const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    expect(getComputedStyle(el).getPropertyValue('--lr-date-input-control-height').trim()).to.equal('');
  });

  it('wires --lr-date-input-control-min-height per tier (rendered min-block-size)', async () => {
    const expected: Record<string, string> = {
      '2xs': '20px',
      xs: '24px',
      s: '30px',
      m: '40px',
      l: '48px',
      xl: '56px',
    };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(html`<lr-date-input size=${size}></lr-date-input>`)) as LyraDateInput;
      await el.updateComplete;
      expect(getComputedStyle(wrapper(el)).minBlockSize, `size=${size}`).to.equal(px);
    }
  });

  it('leaves the rendered row height byte-identical when the height hatch is unset', async () => {
    const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    const w = wrapper(el);
    const natural = getComputedStyle(w).blockSize;
    // The row height is pinned transitively by the un-gated 40px calendar toggle, well above the
    // per-tier min-height floor, so the floor is dead until raised -- byte-identical to today.
    expect(Number.parseFloat(natural)).to.be.greaterThan(
      Number.parseFloat(getComputedStyle(w).minBlockSize),
    );
    el.style.setProperty('--lr-date-input-control-height', '30px');
    await el.updateComplete;
    expect(getComputedStyle(w).blockSize).to.equal('30px');
    el.style.removeProperty('--lr-date-input-control-height');
    await el.updateComplete;
    expect(getComputedStyle(w).blockSize).to.equal(natural);
  });

  it('keeps the calendar toggle a >=24x24 target even when the height hatch crushes the row', async () => {
    // The exact-height cap does not crush the WCAG 2.2 SC 2.5.8 target: the expand button carries
    // its own un-gated --lr-icon-button-size floor, so it keeps 24x24 while overflowing a short row.
    const el = (await fixture(html`<lr-date-input value="2026-07-15" with-clear></lr-date-input>`)) as LyraDateInput;
    el.style.setProperty('--lr-date-input-control-height', '16px');
    await el.updateComplete;
    const expandBtn = el.shadowRoot!.querySelector('[part="expand-button"]') as HTMLElement;
    expect(expandBtn.getBoundingClientRect().height).to.be.greaterThan(24);
    expect(expandBtn.getBoundingClientRect().width).to.be.greaterThan(24);
    const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLElement;
    expect(clearBtn.getBoundingClientRect().height).to.be.greaterThan(24);
    expect(clearBtn.getBoundingClientRect().width).to.be.greaterThan(24);
  });

  it('lets a consumer raise --lr-date-input-control-min-height past the row content', async () => {
    const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
    await el.updateComplete;
    const w = wrapper(el);
    const natural = Number.parseFloat(getComputedStyle(w).blockSize);
    el.style.setProperty('--lr-date-input-control-min-height', `${natural + 20}px`);
    await el.updateComplete;
    expect(Number.parseFloat(getComputedStyle(w).blockSize)).to.equal(natural + 20);
  });

  it('stays accessible with a pinned exact control height', async () => {
    const el = (await fixture(
      html`<lr-date-input value="2026-07-15" style="--lr-date-input-control-height: 44px;"></lr-date-input>`,
    )) as LyraDateInput;
    await el.updateComplete;
    await expect(el).to.be.accessible();
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
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  expect(renderedClamp(el, "[part='popup']")).to.equal('10px');
});

// -- Coverage backfill: locale-order fallback paths, selection accessors before
//    first render, setter edge cases, defensive validity guards, show/hide
//    no-ops, parse fallbacks, and range-text edge cases. ---------------------

describe('locale day/month/year order fallback', () => {
  it('falls back to the runtime default locale order when locale resolution is empty', async () => {
    const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
    Object.defineProperty(el, 'effectiveLocale', { get: () => '', configurable: true });
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    input.value = '03/04/2026';
    input.dispatchEvent(new Event('change'));
    expect(el.value).to.match(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to month/day/year field order when Intl.DateTimeFormat rejects the locale outright', async () => {
    // "not_a_locale" is malformed enough that `new Intl.DateTimeFormat(...)` itself throws a
    // RangeError -- localeDateOrder()'s own try/catch must fall back to its hardcoded default
    // rather than letting that propagate out of a keystroke handler.
    const el = (await fixture(html`<lr-date-input locale="not_a_locale"></lr-date-input>`)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    input.value = '07/15/2026'; // month/day/year fallback order -> July 15, 2026
    input.dispatchEvent(new Event('change'));
    expect(el.value).to.equal('2026-07-15');
  });

  it('falls back to month/day/year field order when Intl reports fewer than three date fields', async () => {
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    Intl.DateTimeFormat.prototype.formatToParts = function (...args: Parameters<typeof original>) {
      return original.apply(this, args).filter((p) => p.type !== 'year');
    };
    try {
      const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
      const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
      input.value = '07/15/2026'; // month/day/year under the forced fallback -> July 15, 2026
      input.dispatchEvent(new Event('change'));
      expect(el.value).to.equal('2026-07-15');
    } finally {
      Intl.DateTimeFormat.prototype.formatToParts = original;
    }
  });

  it('expands a 2-digit year in an ambiguous locale-ordered date to the 2000s', async () => {
    const el = (await fixture(html`<lr-date-input locale="en-GB"></lr-date-input>`)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    input.value = '15/07/26'; // en-GB day/month/year -> 15 July, year 26 -> 2026
    input.dispatchEvent(new Event('change'));
    expect(el.value).to.equal('2026-07-15');
  });
});

describe('selection accessors before the internal input has rendered', () => {
  it('selectionStart/selectionEnd/selectionDirection getters all return null before the internal input exists', () => {
    const el = document.createElement('lr-date-input') as LyraDateInput;
    expect(el.selectionStart).to.equal(null);
    expect(el.selectionEnd).to.equal(null);
    expect(el.selectionDirection).to.equal(null);
  });

  it('setRangeText() no-ops when the internal input has not rendered yet', () => {
    const el = document.createElement('lr-date-input') as LyraDateInput;
    expect(() => el.setRangeText('x')).to.not.throw();
  });
});

it('selectionStart/selectionEnd/selectionDirection setters operate on the internal input', async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  el.focus();

  el.selectionStart = 1;
  expect(el.input!.selectionStart).to.equal(1);

  el.selectionEnd = 3;
  expect(el.input!.selectionEnd).to.equal(3);

  el.selectionDirection = 'backward';
  expect(el.selectionDirection).to.equal('backward');
});

it('setRangeText() with only a replacement string uses the single-argument native overload', async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  el.focus();
  el.select(); // select the whole displayed text so a bare replacement covers it entirely
  const displayed = el.input!.value;
  const replaced = displayed.replace('15', '20');
  el.setRangeText(replaced);
  expect(el.value).to.equal('2026-07-20');
});

it('min/max setters tolerate a null assignment, normalizing to an empty string', async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15" min="2026-01-01" max="2026-12-31"></lr-date-input>`,
  )) as LyraDateInput;
  (el as unknown as { min: string | null }).min = null;
  expect(el.min).to.equal('');
  (el as unknown as { max: string | null }).max = null;
  expect(el.max).to.equal('');
});

it('value setter tolerates a null assignment, normalizing to an empty string', async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  (el as unknown as { value: string | null }).value = null;
  expect(el.value).to.equal('');
});

it('normalizes a malformed value with more than two slash-separated parts to empty', async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-15/2026-07-20/2026-07-25"></lr-date-input>`,
  )) as LyraDateInput;
  expect(el.value).to.equal('');
});

it('flags badInput defensively if a committed value fails a later strict-ISO re-check', async () => {
  // valueDates() guards every part with parseStrictISO() again at validity-check time, even
  // though normalizeCommittedValue() already rejects a bad value before it is ever committed --
  // this proves that second guard actually does something if that invariant is ever violated.
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;

  (el as unknown as { parseStrictISO(): null }).parseStrictISO = () => null;
  el.min = '2026-01-01'; // re-runs updateValidity() without re-normalizing `value`
  expect(el.internals.validity.badInput).to.be.true;
  expect(el.checkValidity()).to.be.false;
});

it('ignores a visibilitychange event while the document is hidden', async () => {
  const el = (await fixture(
    html`<lr-date-input value="2026-07-14" disable-past></lr-date-input>`,
  )) as LyraDateInput;
  const clock = el as unknown as { now: () => Date };
  clock.now = () => new Date(2026, 6, 14, 23, 59);
  expect(el.checkValidity()).to.be.true;
  clock.now = () => new Date(2026, 6, 15, 0, 1);

  Object.defineProperty(el.ownerDocument, 'visibilityState', { value: 'hidden', configurable: true });
  try {
    el.ownerDocument.dispatchEvent(new Event('visibilitychange'));
    await el.updateComplete;
    expect(el.internals.validity.rangeUnderflow).to.be.false;
  } finally {
    delete (el.ownerDocument as unknown as { visibilityState?: unknown }).visibilityState;
  }
});

it('does not track a focus-restore target when nothing was focused when the popup opened', async () => {
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  Object.defineProperty(document, 'activeElement', { get: () => null, configurable: true });
  try {
    el.show();
    await el.updateComplete;
    expect(el.open).to.be.true;
  } finally {
    delete (document as unknown as { activeElement?: unknown }).activeElement;
  }
});

it('show() no-ops while already open or readonly; hide() no-ops when already closed', async () => {
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  expect(el.open).to.be.false;
  el.hide(); // already closed -- no-op
  expect(el.open).to.be.false;

  el.show();
  await el.updateComplete;
  expect(el.open).to.be.true;
  el.show(); // already open -- no-op
  expect(el.open).to.be.true;
  el.hide();
  await el.updateComplete;

  el.readonly = true;
  await el.updateComplete;
  el.show(); // readonly -- no-op
  expect(el.open).to.be.false;
});

it('commits an empty typed value once its trimmed text is blank', async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  input.value = '   '; // whitespace-only -- trims to empty
  setTimeout(() => input.dispatchEvent(new Event('change')));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('');
  expect(el.internals.validity.badInput).to.be.false;
});

it('parses a non-ambiguous, human-readable date string via Date.parse() as a last resort', async () => {
  const el = (await fixture(html`<lr-date-input></lr-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  input.value = 'July 15, 2026';
  setTimeout(() => input.dispatchEvent(new Event('change')));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-15');
});

describe('range-text edge cases', () => {
  // These three are rejected (unparseable) inputs -- applyTypedText() only emits
  // input/change when a value actually commits, so a rejected parse fires neither
  // event; awaiting oneEvent() here would hang forever. Dispatch synchronously
  // (matching the existing "reverts an unparseable typed date" test above) instead.
  it('rejects a raw ISO range containing a calendar-invalid date', async () => {
    const el = (await fixture(html`<lr-date-input mode="range"></lr-date-input>`)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    input.value = '2026-02-30/2026-07-15';
    input.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(el.internals.validity.badInput).to.be.true;
  });

  it('rejects a single date (no range separator) typed while in range mode', async () => {
    const el = (await fixture(html`<lr-date-input mode="range"></lr-date-input>`)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    input.value = '2026-07-15';
    input.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(el.internals.validity.badInput).to.be.true;
  });

  it('rejects a separator-joined range where one side fails to parse', async () => {
    const el = (await fixture(html`<lr-date-input mode="range"></lr-date-input>`)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    input.value = 'not a date – 2026-07-15';
    input.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(el.internals.validity.badInput).to.be.true;
  });

  it('normalizes a reversed range typed using the displayed en-dash separator format', async () => {
    const el = (await fixture(html`<lr-date-input mode="range"></lr-date-input>`)) as LyraDateInput;
    const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
    input.value = 'July 20, 2026 – July 10, 2026'; // reversed, human-readable -> the separator branch
    input.dispatchEvent(new Event('change'));
    expect(el.value).to.equal('2026-07-10/2026-07-20');
  });
});

it('formStateRestoreCallback clears the value for a non-string restored state', async () => {
  const el = (await fixture(html`<lr-date-input value="2026-07-15"></lr-date-input>`)) as LyraDateInput;
  (el as unknown as { formStateRestoreCallback(state: FormData | null): void }).formStateRestoreCallback(
    new FormData(),
  );
  expect(el.value).to.equal('');
});
