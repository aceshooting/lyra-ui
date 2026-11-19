import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './budget-meter.js';
import type { LyraBudgetMeter } from './budget-meter.js';

it('keeps the fill and track visible under forced colors', async () => {
  try {
    await setForcedColors('active');
    const el = await fixture<LyraBudgetMeter>(html`<lr-budget-meter used="30" limit="100"></lr-budget-meter>`);
    const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
    const fill = el.shadowRoot!.querySelector('[part="fill"]') as HTMLElement;
    expect(getComputedStyle(track).outlineStyle).to.equal('solid');
    expect(getComputedStyle(fill).borderTopStyle).to.equal('solid');
    expect(getComputedStyle(fill).backgroundColor).to.not.equal(getComputedStyle(track).backgroundColor);
  } finally {
    await setForcedColors('none');
  }
});

it('names the meter from localized text when its visible heading is blank', async () => {
  const el = await fixture<LyraBudgetMeter>(html`<lr-budget-meter limit="10" label="" .strings=${{ budgetMeterLabel: 'Allowance' }}></lr-budget-meter>`);
  const meter = el.shadowRoot!.querySelector('[part="meter"]')!;
  expect(meter.getAttribute('aria-label')).to.equal('Allowance');
  expect(el.shadowRoot!.querySelector('[part="label"]') === null).to.equal(true);
  el.label = '  ';
  await el.updateComplete;
  expect(meter.getAttribute('aria-label')).to.equal('Allowance');
  expect(el.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal('Allowance');
});

it('distinguishes tiny shares and nearly full budgets', async () => {
  const el = await fixture<LyraBudgetMeter>(html`<lr-budget-meter lang="en" used="3" limit="1000"></lr-budget-meter>`);
  const percent = (): string => el.shadowRoot!.querySelector('[part="percent"]')!.textContent!;
  expect(percent()).to.contain('0.3%');
  el.used = 996;
  await el.updateComplete;
  expect(percent()).to.contain('99.6%');
});

it('exposes a quota as a named meter', async () => {
  const el = await fixture<LyraBudgetMeter>(html`<lr-budget-meter limit="2" used="1"></lr-budget-meter>`);
  expect(el.shadowRoot!.querySelector('[part="meter"]')!.getAttribute('role')).to.equal('meter');
});

it('isolates repeated and reordered formatted quantities and caller units in a localized sentence', async () => {
  const el = await fixture<LyraBudgetMeter>(html`<lr-budget-meter dir="rtl" used="3" limit="20" unit="USD"
    .strings=${{ budgetMeterValue: '{unit} {limit} / {used} ({used})' }}></lr-budget-meter>`);
  const value = el.shadowRoot!.querySelector('[part="value"]')!;
  expect(Array.from(value.querySelectorAll('bdi'), node => node.textContent)).to.deep.equal(['USD', '20', '3', '3']);
  expect(value.textContent).to.equal('USD 20 / 3 (3)');
  expect(el.shadowRoot!.querySelector('[part="meter"]')!.getAttribute('aria-valuetext')).to.equal(value.textContent);
});
