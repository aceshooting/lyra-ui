import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './otp-input.js';
import type { LyraOtpInput } from './otp-input.class.js';

const controlOf = (el: Element): HTMLInputElement => el.shadowRoot!.querySelector('[part="control"]') as HTMLInputElement;
const segmentsOf = (el: Element): HTMLElement[] => [...el.shadowRoot!.querySelectorAll('[part~="segment"]')] as HTMLElement[];

const type = async (el: LyraOtpInput, text: string): Promise<void> => {
  const control = controlOf(el);
  control.value = text;
  control.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await el.updateComplete;
};

it('renders six segments and one focusable control by default', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Verification code"></lr-otp-input>`);
  expect(segmentsOf(el)).to.have.lengthOf(6);
  // One tab stop, not one per character.
  expect(el.shadowRoot!.querySelectorAll('input')).to.have.lengthOf(1);
  await expect(el).to.be.accessible();
});

it('honours length', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="PIN" length="4"></lr-otp-input>`);
  expect(segmentsOf(el)).to.have.lengthOf(4);
  expect(controlOf(el).maxLength).to.equal(4);
});

it('derives segments and separators from format, overriding length', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Key" length="9" format="###-###"></lr-otp-input>`);
  expect(segmentsOf(el)).to.have.lengthOf(6);
  const separators = el.shadowRoot!.querySelectorAll('[part="separator"]');
  expect(separators).to.have.lengthOf(1);
  expect(separators[0].textContent).to.equal('-');
});

it('drops characters the type rejects', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code"></lr-otp-input>`);
  await type(el, 'A1B2');
  expect(el.value).to.equal('12');
  expect(controlOf(el).value).to.equal('12');
});

it('accepts letters when type is alphanumeric and applies the case transform', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" type="alphanumeric" case="upper"></lr-otp-input>`);
  await type(el, 'ab1');
  expect(el.value).to.equal('AB1');
});

it('re-sanitizes an existing value when type narrows', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" type="alphanumeric"></lr-otp-input>`);
  await type(el, 'a1b2');
  expect(el.value).to.equal('a1b2');
  el.type = 'numeric';
  await el.updateComplete;
  expect(el.value).to.equal('12');
});

it('emits input and then lr-complete once every segment is filled', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="3"></lr-otp-input>`);
  const complete = oneEvent(el, 'lr-complete');
  await type(el, '123');
  const event = await complete;
  expect(event.detail.value).to.equal('123');
});

it('does not emit lr-complete while the code is short', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="3"></lr-otp-input>`);
  let fired = false;
  el.addEventListener('lr-complete', () => { fired = true; });
  await type(el, '12');
  expect(fired).to.equal(false);
});

it('submits its value through an ancestor form under its name', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4"></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  await type(el, '1234');
  expect(new FormData(form).get('code')).to.equal('1234');
});

it('reports a partial code as invalid and a full one as valid', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
  await type(el, '12');
  expect(el.validity.valid).to.equal(false);
  await type(el, '1234');
  expect(el.validity.valid).to.equal(true);
});

it('reports valueMissing only when required and empty', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4" required></lr-otp-input>`);
  expect(el.validity.valueMissing).to.equal(true);
  await type(el, '1234');
  expect(el.validity.valid).to.equal(true);
});

it('restores the attribute value on form reset', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" value="1111"></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  await type(el, '2222');
  expect(el.value).to.equal('2222');
  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('1111');
});

it('masks the displayed characters without changing the value', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="PIN" length="4" mask></lr-otp-input>`);
  await type(el, '1234');
  expect(el.value).to.equal('1234');
  const filled = segmentsOf(el);
  expect(filled[0].textContent).to.equal('');
  expect(filled[0].getAttribute('part')!.split(/\s+/)).to.include('masked');
});

it('marks the next segment active only while focused', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" length="4"></lr-otp-input>`);
  await type(el, '12');
  expect(segmentsOf(el).some((s) => s.getAttribute('part')!.includes('active'))).to.equal(false);
  controlOf(el).focus();
  await el.updateComplete;
  const active = segmentsOf(el).findIndex((s) => s.getAttribute('part')!.includes('active'));
  expect(active).to.equal(2);
});

it('renders the English fallback label with no locale registered', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input></lr-otp-input>`);
  expect(controlOf(el).getAttribute('aria-label')).to.equal('Verification code');
});

it('lets a strings override reach the DOM', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input></lr-otp-input>`);
  el.strings = { otpInputLabel: 'Code de vérification' };
  await el.updateComplete;
  expect(controlOf(el).getAttribute('aria-label')).to.equal('Code de vérification');
});

it('prefers a host aria-label over the computed name', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Code" aria-label="Two-factor code"></lr-otp-input>`);
  expect(controlOf(el).getAttribute('aria-label')).to.equal('Two-factor code');
});

it('is not editable while readonly but still submits', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Code" length="4" value="4321" readonly></lr-otp-input></form>
  `);
  const el = form.querySelector('lr-otp-input') as LyraOtpInput;
  expect(controlOf(el).readOnly).to.equal(true);
  expect(new FormData(form).get('code')).to.equal('4321');
});
