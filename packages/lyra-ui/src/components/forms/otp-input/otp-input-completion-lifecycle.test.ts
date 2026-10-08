import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './otp-input.js';
import '../button/button.js';
import type { LyraOtpInput } from './otp-input.class.js';

for (const state of ['own disabled', 'fieldset disabled', 'readonly'] as const) {
  it(`cancels queued OTP autosubmission when a completion listener makes it ${state}`, async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form>
        <fieldset><lr-otp-input name="code" label="Code" length="1" autosubmit></lr-otp-input></fieldset>
        <button type="submit">Continue</button>
      </form>
    `);
    const el = form.querySelector<LyraOtpInput>('lr-otp-input')!;
    let completions = 0;
    let submissions = 0;
    form.addEventListener('submit', event => { event.preventDefault(); submissions += 1; });
    el.addEventListener('lr-complete', async () => {
      completions += 1;
      await Promise.resolve();
      if (state === 'own disabled') el.disabled = true;
      else if (state === 'fieldset disabled') form.querySelector('fieldset')!.disabled = true;
      else el.readonly = true;
    }, { once: true });
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
    await focusByKeyboard(input);
    await sendKeys({ type: '7' });
    await waitUntil(() => completions === 1);
    // wait-reason: asserting nothing changes after the completion event (negative assertion)
    await aTimeout(60);
    expect(el.value).to.equal('7');
    expect(submissions).to.equal(0);
    if (state !== 'readonly') expect(new FormData(form).has('code')).to.equal(false);
    if (state === 'own disabled') el.disabled = false;
    else if (state === 'fieldset disabled') form.querySelector('fieldset')!.disabled = false;
    else el.readonly = false;
    await el.updateComplete;
    // wait-reason: asserting the cancelled submission is not replayed (negative assertion)
    await aTimeout(30);
    expect(submissions, 'restoring editability must not replay the cancelled submission').to.equal(0);
    el.clear();
    await focusByKeyboard(input);
    await sendKeys({ type: '8' });
    await waitUntil(() => submissions === 1, 'a fresh completion should submit after editability returns');
  });
}

it('autosubmits exactly once through the named custom default submitter after native typing', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-otp-input name="code" label="Code" length="1" autosubmit></lr-otp-input>
      <lr-button type="submit" name="action" value="verify">Verify</lr-button>
    </form>
  `);
  const el = form.querySelector<LyraOtpInput>('lr-otp-input')!;
  const submissions: Array<{ code: string; submitterName: string; submitterValue: string }> = [];
  form.addEventListener('submit', event => {
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    submissions.push({ code: String(new FormData(form).get('code')), submitterName: submitter?.name ?? '', submitterValue: submitter?.value ?? '' });
  });
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLInputElement>('input')!);
  await sendKeys({ type: '7' });
  await waitUntil(() => submissions.length === 1);
  // wait-reason: asserting no second submission follows the first (negative assertion)
  await aTimeout(30);
  expect(submissions).to.deep.equal([{ code: '7', submitterName: 'action', submitterValue: 'verify' }]);
});

it('keeps autosubmission enabled for a control in the first legend of a disabled fieldset', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><fieldset disabled>
      <legend><lr-otp-input name="code" label="Code" length="1" autosubmit></lr-otp-input></legend>
    </fieldset><button type="submit">Continue</button></form>
  `);
  const el = form.querySelector<LyraOtpInput>('lr-otp-input')!;
  let submittedCode = '';
  form.addEventListener('submit', event => { event.preventDefault(); submittedCode = String(new FormData(form).get('code')); });
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLInputElement>('input')!);
  await sendKeys({ type: '7' });
  await waitUntil(() => submittedCode === '7');
  expect(el.effectiveDisabled).to.equal(false);
});
