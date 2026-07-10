import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './date-input.js';
import type { LyraDateInput } from './date-input.js';

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
  // Regression for the 2026-07-10 review: previously the *first* assignment
  // to `.value` after construction — even a user's own first edit of a
  // blank required field — silently became the permanent reset default.
  const form = (await fixture(
    html`<form><lyra-date-input name="d"></lyra-date-input></form>`,
  )) as HTMLFormElement;
  const el = form.querySelector('lyra-date-input') as LyraDateInput;
  el.value = 'first-user-edit';
  el.value = 'second-user-edit';
  form.reset();
  expect(el.value).to.equal('');
});
