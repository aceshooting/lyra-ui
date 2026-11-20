import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { TemplateResult } from 'lit';
import { focusByKeyboard } from '../../../test/wtr-focus.js';
import '../lr-country-picker.js';
import '../lr-currency-picker.js';
import '../lr-time-zone-picker.js';
import '../lr-unit-picker.js';
import type { LyraCatalogPickerBase } from './catalog-picker-base.js';
import type { LyraCombobox } from './combobox/combobox.class.js';
import type { LyraSelect } from './select/select.class.js';

type Picker = LyraCatalogPickerBase;
const cases: Array<{ name: string; codes: [string, string, string]; mount: (value: string) => TemplateResult }> = [
  { name: 'lr-country-picker', codes: ['FR', 'DE', 'IT'],
    mount: (value) => html`<lr-country-picker label="Country" value=${value} .countries=${['FR', 'DE', 'IT']}></lr-country-picker>` },
  { name: 'lr-currency-picker', codes: ['EUR', 'USD', 'GBP'],
    mount: (value) => html`<lr-currency-picker label="Currency" value=${value} .currencies=${['EUR', 'USD', 'GBP']}></lr-currency-picker>` },
  { name: 'lr-time-zone-picker', codes: ['Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo'],
    mount: (value) => html`<lr-time-zone-picker label="Zone" value=${value}
      .timeZones=${['Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo']}></lr-time-zone-picker>` },
  { name: 'lr-unit-picker', codes: ['meter', 'kilogram', 'second'],
    mount: (value) => html`<lr-unit-picker label="Unit" value=${value} .units=${['meter', 'kilogram', 'second']}></lr-unit-picker>` },
];

function track(el: Picker) {
  const log: string[] = [];
  const state = { mode: 'veto' as 'veto' | 'resolve' | 'allow', resolveTo: '' };
  el.addEventListener('lr-change-request', (event) => {
    const { value, previousValue } = event.detail;
    log.push(`request:${value}:${previousValue}:${el.value}:${String(event.cancelable)}`);
    if (state.mode === 'veto') event.preventDefault();
    if (state.mode === 'resolve') el.value = state.resolveTo;
  });
  for (const name of ['input', 'lr-input', 'change', 'lr-change']) el.addEventListener(name, () => log.push(name));
  return { log, state };
}

async function pick(el: Picker, value: string): Promise<void> {
  const child = el.shadowRoot!.querySelector<LyraSelect<false>>('lr-select')!;
  el.click();
  await waitUntil(() => child.shadowRoot!.querySelector(`[part="option"][data-value="${value}"]`), 'the option renders');
  child.shadowRoot!.querySelector<HTMLElement>(`[part="option"][data-value="${value}"]`)!.click();
  await el.updateComplete;
  await child.updateComplete;
}

for (const { name, codes: [first, second, third], mount } of cases) {
  it(`${name} lets a listener veto or resolve a selection before it commits`, async () => {
    const el = await fixture<Picker>(mount(first));
    const { log, state } = track(el);
    const child = el.shadowRoot!.querySelector<LyraSelect<false>>('lr-select')!;

    await pick(el, second);
    expect(el.value).to.equal(first);
    expect(child.value, 'the visible control keeps the current value').to.equal(first);
    expect(log).to.deep.equal([`request:${second}:${first}:${first}:true`]);

    log.length = 0;
    state.mode = 'resolve';
    state.resolveTo = third;
    await pick(el, second);
    expect(el.value, 'a listener write wins over the proposal').to.equal(third);
    expect(child.value).to.equal(third);
    expect(log).to.deep.equal([`request:${second}:${first}:${first}:true`]);

    log.length = 0;
    state.mode = 'allow';
    await pick(el, second);
    expect(el.value).to.equal(second);
    expect(log).to.deep.equal([`request:${second}:${third}:${third}:true`, 'input', 'lr-input', 'change', 'lr-change']);
  });
}

it('vetoes a searchable picker selection the same way', async () => {
  const el = await fixture<Picker>(html`<lr-country-picker searchable label="Country" value="FR"
    .countries=${['FR', 'DE', 'IT']}></lr-country-picker>`);
  await waitUntil(() => Boolean(el.input));
  const { log } = track(el);
  const combo = el.shadowRoot!.querySelector<LyraCombobox<false>>('lr-combobox')!;
  await combo.updateComplete;
  await focusByKeyboard(combo.input!);
  combo.input!.value = 'Germany';
  combo.input!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  await combo.updateComplete;
  await sendKeys({ press: 'ArrowDown' });
  await sendKeys({ press: 'Enter' });
  await el.updateComplete;
  expect(el.value).to.equal('FR');
  expect(log).to.deep.equal(['request:DE:FR:FR:true']);
});
