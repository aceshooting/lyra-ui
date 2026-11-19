import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './model-select.js';

it('keeps the current catalog selection silent when it is picked again', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-model-select']>(html`<lr-model-select value="a"
    .catalog=${[{ id: 'a', label: 'Alpha' }]}></lr-model-select>`);
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
  const el = await fixture<HTMLElementTagNameMap['lr-model-select']>(html`<lr-model-select hint="Help" error-text="Invalid"
    .catalog=${[{ id: 'a', label: 'Alpha' }]}></lr-model-select>`);
  for (const mode of [false, true]) {
    el.allowCustom = mode;
    await el.updateComplete;
    const field = el.shadowRoot!.querySelector('[role="combobox"]')!;
    expect(field.getAttribute('aria-describedby')).to.equal('model-select-error model-select-hint');
  }
});

it('reports the typed query while preserving the committed value', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-model-select']>(html`<lr-model-select allow-custom value="old"></lr-model-select>`);
  const details: unknown[] = [];
  el.addEventListener('lr-input', event => details.push((event as CustomEvent).detail));
  el.input!.value = 'New draft';
  el.input!.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  expect(details).to.deep.equal([{ value: 'old', inCatalog: false, query: 'New draft' }]);
  expect(el.value).to.equal('old');
});

it('themes the hover and pressed backgrounds independently', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-model-select']>(html`<lr-model-select data-lr-theme-scope .catalog=${[{ id: 'a', label: 'Alpha' }]}
    style="--lr-transition-fast:0s; --lr-model-select-trigger-hover-bg:rgb(11, 22, 33); --lr-model-select-trigger-active-bg:rgb(33, 22, 11)"></lr-model-select>`);
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
  const el = await fixture<HTMLElementTagNameMap['lr-model-select']>(html`<lr-model-select
    style="--lr-opacity-disabled:0.31" .catalog=${[{ id: 'a', label: 'Alpha', disabled: true }]}></lr-model-select>`);
  el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!.click();
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][aria-disabled="true"]')!;
  expect(getComputedStyle(row).opacity).to.equal('0.31');
  el.style.setProperty('--lr-model-select-option-disabled-opacity', '0.42');
  expect(getComputedStyle(row).opacity).to.equal('0.42');
});
