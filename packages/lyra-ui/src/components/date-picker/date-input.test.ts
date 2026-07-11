import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './date-input.js';
import type { LyraDateInput } from './date-input.js';
import { styles } from './date-input.styles.js';

it('parses typed input into an ISO value and emits change', async () => {
  const el = (await fixture(html`<lyra-date-input></lyra-date-input>`)) as LyraDateInput;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  input.value = '2026-07-15';
  setTimeout(() => input.dispatchEvent(new Event('change')));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('2026-07-15');
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

it('shows a not-allowed cursor on the disabled input wrapper', async () => {
  const el = (await fixture(html`<lyra-date-input disabled></lyra-date-input>`)) as LyraDateInput;
  await el.updateComplete;
  const wrapper = el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  expect(getComputedStyle(wrapper).cursor).to.equal('not-allowed');
});

it('applies the shared focus-ring tokens to the clear and expand buttons', () => {
  const css = styles.cssText;
  const focusBlock = /\[part=['"]?clear-button['"]?]:focus-visible,\s*\[part=['"]?expand-button['"]?]:focus-visible\s*{([^}]*)}/.exec(css);
  expect(focusBlock, 'expected a shared clear/expand :focus-visible rule').to.not.equal(null);
  expect(focusBlock![1]).to.include('var(--lyra-focus-ring-width)');
  expect(focusBlock![1]).to.include('var(--lyra-focus-ring-color)');
});
