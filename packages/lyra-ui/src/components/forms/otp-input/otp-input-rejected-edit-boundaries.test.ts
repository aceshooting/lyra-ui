import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './otp-input.js';
import type { LyraOtpInput } from './otp-input.class.js';

function paste(input: HTMLInputElement, text: string): Event {
  const event = new Event('paste', { bubbles: true, composed: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => type === 'text' ? text : '' } });
  input.dispatchEvent(event);
  return event;
}

it('caps an oversized segment format and submits only the rendered code', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input name="code" label="Security code" .format=${'#'.repeat(40)}
      .value=${'1234567890'.repeat(4)}></lr-otp-input></form>
  `);
  const el = form.querySelector<LyraOtpInput>('lr-otp-input')!;
  const expected = '1234567890'.repeat(4).slice(0, 32);
  expect(el.effectiveLength).to.equal(32);
  expect(el.shadowRoot!.querySelectorAll('[part~="segment"]').length).to.equal(32);
  expect(el.input!.maxLength).to.equal(32);
  expect(el.value).to.equal(expected);
  expect(new FormData(form).get('code')).to.equal(expected);
});

it('rejects a paste containing no accepted digits without clearing a partial code or emitting edits', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Security code" length="4" value="12"></lr-otp-input>`);
  const events: string[] = [];
  for (const name of ['input', 'change', 'lr-input', 'lr-change', 'lr-complete']) el.addEventListener(name, () => events.push(name));
  const event = paste(el.input!, 'letters only');
  await el.updateComplete;
  expect(event.defaultPrevented).to.equal(true);
  expect(el.value).to.equal('12');
  expect(el.input!.value).to.equal('12');
  expect(events).to.deep.equal([]);
});

it('leaves readonly paste native and preserves the submitted code', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-otp-input label="Security code" name="code" length="4" value="1234" readonly></lr-otp-input></form>
  `);
  const el = form.querySelector<LyraOtpInput>('lr-otp-input')!;
  const event = paste(el.input!, '5678');
  await el.updateComplete;
  expect(event.defaultPrevented).to.equal(false);
  expect(el.value).to.equal('1234');
  expect(new FormData(form).get('code')).to.equal('1234');
  await expect(el).to.be.accessible();
});

it('does not relay an unchanged native input or turn a rejected letter into a code edit', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Security code" length="4" value="12"></lr-otp-input>`);
  let edits = 0;
  el.addEventListener('input', () => { edits++; });
  el.addEventListener('lr-input', () => { edits++; });
  const input = el.input!;
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: '2' }));
  await el.updateComplete;
  expect(edits).to.equal(0);
  await focusByKeyboard(input);
  await sendKeys({ type: 'a' });
  await el.updateComplete;
  expect(el.value).to.equal('12');
  expect(input.value).to.equal('12');
  expect(edits).to.equal(0);
});

it('does not reinterpret a composing key as a fixed-cell edit', async () => {
  const el = await fixture<LyraOtpInput>(html`<lr-otp-input label="Security code" length="4" value="12"></lr-otp-input>`);
  const event = new KeyboardEvent('keydown', { key: '3', isComposing: true, bubbles: true, composed: true, cancelable: true });
  el.input!.dispatchEvent(event);
  await el.updateComplete;
  expect(event.defaultPrevented).to.equal(false);
  expect(el.value).to.equal('12');
  expect(el.input!.value).to.equal('12');
});
