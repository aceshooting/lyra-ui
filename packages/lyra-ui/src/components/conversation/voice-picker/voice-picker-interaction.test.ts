import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './voice-picker.js';

it('keeps the current catalog selection silent when it is picked again', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-voice-picker']>(html`<lr-voice-picker value="a"
    .catalog=${[{ id: 'a', label: 'Alpha' }]}></lr-voice-picker>`);
  const events: string[] = [];
  for (const name of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(name, () => events.push(name));
  el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!.click();
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!.click();
  await el.updateComplete;
  expect(el.open).to.equal(false);
  expect(events).to.deep.equal([]);
});

it('orders internal error and hint descriptions in both editing modes', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-voice-picker']>(html`<lr-voice-picker hint="Help" error-text="Invalid"
    .catalog=${[{ id: 'a', label: 'Alpha' }]}></lr-voice-picker>`);
  for (const mode of [false, true]) {
    el.allowCustom = mode;
    await el.updateComplete;
    const field = el.shadowRoot!.querySelector('[role="combobox"]')!;
    expect(field.getAttribute('aria-describedby')).to.equal('voice-picker-error voice-picker-hint');
  }
});

it('themes the hover and pressed backgrounds independently', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-voice-picker']>(html`<lr-voice-picker .catalog=${[{ id: 'a', label: 'Alpha' }]}
    style="--lr-transition-fast:0s; --lr-voice-picker-trigger-hover-bg:rgb(11, 22, 33); --lr-voice-picker-trigger-active-bg:rgb(33, 22, 11)"></lr-voice-picker>`);
  const button = el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
  try {
    await hoverUntilMatched(button, 'the trigger receives hover');
    await waitUntil(() => getComputedStyle(button).backgroundColor === 'rgb(11, 22, 33)');
    await sendMouse({ type: 'down' });
    await waitUntil(() => getComputedStyle(button).backgroundColor === 'rgb(33, 22, 11)');
  } finally {
    el.remove();
    await resetMouse();
  }
});

it('dims disabled options with the shared opacity and keeps the option override', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-voice-picker']>(html`<lr-voice-picker
    style="--lr-opacity-disabled:0.31" .catalog=${[{ id: 'a', label: 'Alpha', disabled: true }]}></lr-voice-picker>`);
  el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!.click();
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][aria-disabled="true"]')!;
  expect(getComputedStyle(row).opacity).to.equal('0.31');
  el.style.setProperty('--lr-voice-picker-option-disabled-opacity', '0.42');
  expect(getComputedStyle(row).opacity).to.equal('0.42');
});
