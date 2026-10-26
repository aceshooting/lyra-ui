import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { ifDefined } from 'lit/directives/if-defined.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraSelect } from './select.js';
import './select.js';
import '../combobox/option.js';

async function setup(ariaLabel?: string) {
  const form = await fixture<HTMLFormElement>(html`<form>
    <lr-select label="Response" name="response" required aria-label=${ifDefined(ariaLabel)}>
      <lr-option value="accepted">Accepted</lr-option>
    </lr-select>
    <button type="submit">Save</button>
  </form>`);
  const select = form.querySelector<LyraSelect>('lr-select')!;
  await select.updateComplete;
  const trigger = select.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
  const submit = form.querySelector<HTMLButtonElement>('button')!;
  let submits = 0;
  form.addEventListener('submit', event => { event.preventDefault(); submits++; });
  return { form, select, trigger, submit, submits: () => submits };
}
function expectInvalid(app: Awaited<ReturnType<typeof setup>>, invalid: boolean): void {
  expect(app.trigger.getAttribute('aria-invalid')).to.equal(String(invalid));
  expect(app.select.hasAttribute('data-invalid')).to.equal(invalid);
}

for (const ariaLabel of [undefined, 'Host response name']) {
  it(`reflects untouched native invalid submission with ${ariaLabel ? 'a host accessible name' : 'the default label'}, and clears after correction/reset`, async () => {
    const app = await setup(ariaLabel);
    expectInvalid(app, false);
    await focusByKeyboard(app.submit);
    await sendKeys({ press: 'Enter' });
    await app.select.updateComplete;
    expect(app.submits()).to.equal(0);
    expect(app.select.shadowRoot!.activeElement === app.trigger).to.equal(true);
    expectInvalid(app, true);
    if (ariaLabel) expect(app.trigger.getAttribute('aria-label')).to.equal(ariaLabel);
    else expect([...app.trigger.labels].some(label => label.textContent?.includes('Response'))).to.equal(true);
    await expect(app.select).to.be.accessible();
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => app.trigger.getAttribute('aria-expanded') === 'true');
    await sendKeys({ press: 'Home' });
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => app.trigger.getAttribute('aria-expanded') === 'false');
    await app.select.updateComplete;
    expect(app.select.value).to.equal('accepted');
    expectInvalid(app, false);
    await sendKeys({ press: 'Tab' });
    expect(document.activeElement === app.submit).to.equal(true);
    await sendKeys({ press: 'Enter' });
    expect(app.submits()).to.equal(1);
    app.form.reset();
    await app.select.updateComplete;
    expect(app.select.value).to.equal('');
    expectInvalid(app, false);
    await sendKeys({ press: 'Enter' });
    await app.select.updateComplete;
    expect(app.submits()).to.equal(1);
    expectInvalid(app, true);
  });
}

it('keeps silent validity queries pristine while direct reportValidity exposes the error', async () => {
  const app = await setup();
  expect(app.select.checkValidity()).to.equal(false);
  await app.select.updateComplete;
  expectInvalid(app, false);
  expect(app.select.reportValidity()).to.equal(false);
  await app.select.updateComplete;
  expectInvalid(app, true);
  expect(app.select.shadowRoot!.activeElement === app.trigger).to.equal(true);
  app.select.value = 'accepted';
  await app.select.updateComplete;
  expectInvalid(app, false);
  app.form.reset();
  await app.select.updateComplete;
  expectInvalid(app, false);
  expect(app.select.checkValidity()).to.equal(false);
  await app.select.updateComplete;
  expectInvalid(app, false);
});
