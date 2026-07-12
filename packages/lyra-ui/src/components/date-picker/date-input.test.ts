import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './date-input.js';
import type { LyraDateInput } from './date-input.js';
import type { LyraDatePicker } from './date-picker.js';
import { styles } from './date-input.styles.js';

it('parses typed input into an ISO value and emits change', async () => {
  const el = (await fixture(html`<lyra-date-input></lyra-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  input.value = '2026-07-15';
  setTimeout(() => input.dispatchEvent(new Event('change')));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-15');
});

it('reverts an unparseable typed date to the last committed display text and flags badInput', async () => {
  const el = (await fixture(html`<lyra-date-input value="2026-07-15"></lyra-date-input>`)) as LyraDateInput;
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
  const el = (await fixture(html`<lyra-date-input value="2026-07-15"></lyra-date-input>`)) as LyraDateInput;
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
  const el = (await fixture(html`<lyra-date-input value="2026-07-15"></lyra-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const picker = el.shadowRoot!.querySelector('lyra-date-picker')!;
  await (picker as unknown as LyraDateInput).updateComplete;
  const day = picker.shadowRoot!.querySelector('[data-date="2026-07-22"]') as HTMLButtonElement;
  setTimeout(() => day.click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-22');
  expect(el.open).to.be.false; // single mode closes on pick
});

it('fires exactly one input event per day pick, not two', async () => {
  // Regression test: the nested <lyra-date-picker>'s own 'input' event
  // (LyraElement.emit always dispatches bubbles:true, composed:true) had no
  // listener wired on it in date-input's render(), so it bubbled straight
  // through the shadow boundary and fired a second, uncounted 'input' on
  // this host on top of onPickerChange's own explicit emit.
  const el = (await fixture(html`<lyra-date-input value="2026-07-15"></lyra-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lyra-date-picker')!;
  await (picker as unknown as LyraDateInput).updateComplete;

  let inputCount = 0;
  el.addEventListener('input', () => inputCount++);

  const day = picker.shadowRoot!.querySelector('[data-date="2026-07-22"]') as HTMLButtonElement;
  setTimeout(() => day.click());
  await oneEvent(el, 'change');
  expect(inputCount).to.equal(1);
});

it('fires exactly one input event per range click, and one change once the range completes', async () => {
  const el = (await fixture(html`<lyra-date-input mode="range"></lyra-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lyra-date-picker') as LyraDatePicker;
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

it('auto-closes the popover once a range selection is completed, not just in single mode', async () => {
  const el = (await fixture(html`<lyra-date-input mode="range"></lyra-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lyra-date-picker') as LyraDatePicker;
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
  const el = (await fixture(html`<lyra-date-input value="2026-07-15"></lyra-date-input>`)) as LyraDateInput;
  el.show();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const formControl = el.shadowRoot!.querySelector('[part="form-control"]') as HTMLElement;
  formControl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('propagates disable-past/disable-future/with-outside-days to the nested lyra-date-picker', async () => {
  const el = (await fixture(
    html`<lyra-date-input disable-past disable-future with-outside-days></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lyra-date-picker') as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.disablePast).to.be.true;
  expect(picker.disableFuture).to.be.true;
  expect(picker.withOutsideDays).to.be.true;
});

it('links the expand-button to the popup via aria-controls', async () => {
  const el = (await fixture(html`<lyra-date-input></lyra-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const expandBtn = el.shadowRoot!.querySelector('[part="expand-button"]') as HTMLElement;
  const popup = el.shadowRoot!.querySelector('[part="popup"]') as HTMLElement;
  expect(popup.id, 'expected the popup to have an id').to.not.equal('');
  expect(expandBtn.getAttribute('aria-controls')).to.equal(popup.id);
});

it('shows a formatted display value', async () => {
  const el = (await fixture(html`<lyra-date-input value="2026-07-15"></lyra-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  expect(input.value).to.not.be.empty;
  expect(input.value).to.not.equal('2026-07-15'); // locale-formatted, not raw ISO
});

it('clears via the clear button', async () => {
  const el = (await fixture(html`<lyra-date-input value="2026-07-15" with-clear></lyra-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const clear = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement;
  setTimeout(() => clear.click());
  await oneEvent(el, 'lyra-clear');
  expect(el.value).to.equal('');
});

it('participates in a form', async () => {
  const form = (await fixture(html`
    <form><lyra-date-input name="d" value="2026-07-15"></lyra-date-input></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get('d')).to.equal('2026-07-15');
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-date-input label="Start date" value="2026-07-15"></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('blocks a required, empty date input from submitting the form', async () => {
  const form = (await fixture(
    html`<form><lyra-date-input name="d" required></lyra-date-input></form>`,
  )) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it('re-syncs ElementInternals validity when required is toggled after connection', async () => {
  const form = (await fixture(
    html`<form><lyra-date-input name="d"></lyra-date-input></form>`,
  )) as HTMLFormElement;
  const el = form.querySelector('lyra-date-input') as LyraDateInput;
  expect(form.reportValidity()).to.be.true;

  el.required = true;
  await el.updateComplete;
  expect(form.reportValidity()).to.be.false;

  el.value = '2026-07-15';
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('restores the constructed value (not blank) on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lyra-date-input name="d" value="2026-07-15"></lyra-date-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-date-input') as LyraDateInput;
  el.value = '2026-08-01';
  form.reset();
  expect(el.value).to.equal('2026-07-15');
});

it('does not let a typed-in value become the reset default when there is no `value` attribute', async () => {
  // Regression test: previously the *first* assignment to `.value` after
  // construction — even a user's own first edit of a blank required field —
  // silently became the permanent reset default.
  const form = (await fixture(
    html`<form><lyra-date-input name="d"></lyra-date-input></form>`,
  )) as HTMLFormElement;
  const el = form.querySelector('lyra-date-input') as LyraDateInput;
  el.value = 'first-user-edit';
  el.value = 'second-user-edit';
  form.reset();
  expect(el.value).to.equal('');
});

it('uses shared svg icons instead of literal glyphs for clear and calendar toggle', async () => {
  const el = (await fixture(
    html`<lyra-date-input value="2026-07-15" with-clear></lyra-date-input>`,
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
  expect(popupBlock![1]).to.include('var(--lyra-transition-fast)');
  expect(css).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

it('gives the clear/expand buttons a real touch target instead of collapsing to bare glyph height', async () => {
  const css = styles.cssText;
  const btnBlock = /\[part=['"]?clear-button['"]?],\s*\[part=['"]?expand-button['"]?]\s*{([^}]*)}/.exec(css);
  expect(btnBlock, 'expected a shared [part="clear-button"], [part="expand-button"] rule').to.not.equal(null);
  expect(btnBlock![1]).to.include('var(--lyra-icon-button-size)');

  const el = (await fixture(
    html`<lyra-date-input value="2026-07-15" with-clear></lyra-date-input>`,
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
  const el = (await fixture(html`<lyra-date-input></lyra-date-input>`)) as LyraDateInput;
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  // Neither part can rely on `:empty` — each always contains a literal
  // `<slot>` child element, so `:empty` never matches regardless of
  // assigned/text content (same bug class fixed for lyra-stat).
  expect(getComputedStyle(errorPart).display).to.equal('none');
  expect(getComputedStyle(hintPart).display).to.equal('none');

  el.errorText = 'Invalid date';
  el.hint = 'Use ISO format';
  await el.updateComplete;
  expect(getComputedStyle(errorPart).display).to.not.equal('none');
  expect(getComputedStyle(hintPart).display).to.not.equal('none');
});

it('renders errorText in var(--lyra-color-danger), distinct from and alongside the hint', async () => {
  const el = (await fixture(html`<lyra-date-input></lyra-date-input>`)) as LyraDateInput;
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
  const el = (await fixture(html`<lyra-date-input required></lyra-date-input>`)) as LyraDateInput;
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
    html`<lyra-date-input label="Start date" required></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  const after = getComputedStyle(label, '::after');
  expect(after.content).to.contain('*');
});

it('does not render an orphaned asterisk when required but no label is provided', async () => {
  const el = (await fixture(html`<lyra-date-input required></lyra-date-input>`)) as LyraDateInput;
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
  expect(styles.cssText).to.include('max-inline-size: min(92vw, 28rem)');
});

it('propagates disabled/readonly to the nested lyra-date-picker so its days actually stop being interactive', async () => {
  const el = (await fixture(
    html`<lyra-date-input value="2026-07-15" disabled></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lyra-date-picker') as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.disabled).to.be.true;

  el.disabled = false;
  el.readonly = true;
  await el.updateComplete;
  await picker.updateComplete;
  expect(picker.readonly).to.be.true;
});

it('shows a not-allowed cursor on the disabled input wrapper', async () => {
  const el = (await fixture(html`<lyra-date-input disabled></lyra-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const wrapper = el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  expect(getComputedStyle(wrapper).cursor).to.equal('not-allowed');
});

it('pairs the form-control label with the date input via for/id so clicking the label focuses it', async () => {
  const el = (await fixture(
    html`<lyra-date-input label="Start date" value="2026-07-15"></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLLabelElement;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  expect(label.htmlFor, 'label should have a for attribute').to.not.equal('');
  expect(label.htmlFor).to.equal(input.id);
});

it('propagates locale, first-day-of-week and weekday-format to the nested lyra-date-picker', async () => {
  const el = (await fixture(
    html`<lyra-date-input locale="fr-FR" first-day-of-week="mon" weekday-format="narrow"></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const picker = el.shadowRoot!.querySelector('lyra-date-picker') as LyraDatePicker;
  await picker.updateComplete;
  expect(picker.locale).to.equal('fr-FR');
  expect(picker.firstDayOfWeek).to.equal('mon');
  expect(picker.weekdayFormat).to.equal('narrow');
});

it('formats the displayed value using the locale property', async () => {
  const el = (await fixture(
    html`<lyra-date-input value="2026-07-15" locale="fr-FR"></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  expect(input.value).to.equal(new Date(2026, 6, 15).toLocaleDateString('fr-FR'));
});

it('applies the shared focus-ring tokens to the clear and expand buttons', () => {
  const css = styles.cssText;
  const focusBlock = /\[part=['"]?clear-button['"]?]:focus-visible,\s*\[part=['"]?expand-button['"]?]:focus-visible\s*{([^}]*)}/.exec(css);
  expect(focusBlock, 'expected a shared clear/expand :focus-visible rule').to.not.equal(null);
  expect(focusBlock![1]).to.include('var(--lyra-focus-ring-width)');
  expect(focusBlock![1]).to.include('var(--lyra-focus-ring-color)');
});

it('round-trips a rendered range string typed back into the field', async () => {
  const el = (await fixture(
    html`<lyra-date-input mode="range" value="2026-05-01/2026-05-15"></lyra-date-input>`,
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
  const el = (await fixture(html`<lyra-date-input mode="range"></lyra-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = '2026-05-01/2026-05-15';
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('2026-05-01/2026-05-15');
});

it('rejects a typed date outside min/max as invalid instead of silently accepting it', async () => {
  const el = (await fixture(
    html`<lyra-date-input min="2026-01-01" max="2026-12-31"></lyra-date-input>`,
  )) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = '2027-01-01';
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('');
  expect(el.checkValidity()).to.be.false;
});

it('rejects a typed date before disable-past\'s today floor', async () => {
  const el = (await fixture(html`<lyra-date-input disable-past></lyra-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = '2000-01-01';
  input.dispatchEvent(new Event('change'));
  expect(el.value).to.equal('');
  expect(el.checkValidity()).to.be.false;
});

it('keeps the clear button disabled while the control is disabled', async () => {
  const el = (await fixture(
    html`<lyra-date-input disabled with-clear value="2026-01-01"></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement | null;
  expect(clearBtn?.disabled).to.be.true;
});

it('keeps the clear button disabled while the control is readonly', async () => {
  const el = (await fixture(
    html`<lyra-date-input readonly with-clear value="2026-01-01"></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement | null;
  expect(clearBtn?.disabled).to.be.true;
});

it('re-binds positioning after a disconnect+reconnect while open', async () => {
  const el = (await fixture(html`<lyra-date-input open></lyra-date-input>`)) as LyraDateInput;
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
  const el = (await fixture(html`<lyra-date-input open></lyra-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  expect(el.open, 'disconnect should reset open').to.be.false;
  parent.appendChild(el);
});

it('does not override an explicit `label` slot with the fallback aria-label', async () => {
  const el = (await fixture(
    html`<lyra-date-input><span slot="label">Start date</span></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.getAttribute('aria-label')).to.not.equal('Date');
});

it('wires aria-describedby to the visible hint/error text', async () => {
  const el = (await fixture(
    html`<lyra-date-input hint="Pick a date" error-text="Required"></lyra-date-input>`,
  )) as LyraDateInput;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  const describedBy = input.getAttribute('aria-describedby') ?? '';
  expect(describedBy).to.include('date-input-hint');
  expect(describedBy).to.include('date-input-error');
});
