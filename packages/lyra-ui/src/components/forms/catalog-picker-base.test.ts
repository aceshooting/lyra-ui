import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './country-picker/country-picker.js';
import './time-zone-picker/time-zone-picker.js';
import './unit-picker/unit-picker.js';
import type { LyraCountryPicker } from './country-picker/country-picker.class.js';
import type { LyraTimeZonePicker } from './time-zone-picker/time-zone-picker.class.js';
import type { LyraUnitPicker } from './unit-picker/unit-picker.class.js';
import type { LyraSelect } from './select/select.class.js';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../test/wtr-focus.js';
import type { LyraCombobox } from './combobox/combobox.class.js';
import { COUNTRY_CODES } from '../../countries.js';
import { getTimeZoneCodes } from '../../time-zones.js';

for (const kind of ['country', 'time-zone'] as const) {
  it(`offers the built-in ${kind} catalog tail in the actual popup`, async () => {
    const el = kind === 'country'
      ? await fixture<LyraCountryPicker>(html`<lr-country-picker></lr-country-picker>`)
      : await fixture<LyraTimeZonePicker>(html`<lr-time-zone-picker></lr-time-zone-picker>`);
    const codes = kind === 'country' ? COUNTRY_CODES : getTimeZoneCodes();
    const child = el.shadowRoot!.querySelector<LyraSelect<false>>('lr-select')!;
    el.click();
    await waitUntil(() => child.querySelectorAll('lr-option').length === codes.length);
    await child.updateComplete;
    const options = child.shadowRoot!.querySelectorAll<HTMLElement>('[part~="option"]');
    expect(options.length).to.equal(codes.length);
    options[options.length - 1]!.click();
    await el.updateComplete;
    expect(el.value).to.equal(codes[codes.length - 1]);
  });
}

for (const first of ['unit', 'time-zone'] as const) {
  it(`isolates shared admitted catalog labels when ${first} resolves first`, async () => {
    const unit = document.createElement('lr-unit-picker') as LyraUnitPicker;
    const zone = document.createElement('lr-time-zone-picker') as LyraTimeZonePicker;
    if (first === 'unit') { unit.units = ['kilometer-per-hour']; zone.timeZones = unit.units; }
    else { zone.timeZones = ['kilometer-per-hour']; unit.units = zone.timeZones; }
    unit.value = zone.value = 'kilometer-per-hour';
    const firstEl = first === 'unit' ? unit : zone;
    const secondEl = first === 'unit' ? zone : unit;
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    host.append(firstEl); await firstEl.updateComplete;
    host.append(secondEl); await secondEl.updateComplete;
    const unitOption = unit.shadowRoot!.querySelector('lr-option') as HTMLElement & {label:string};
    const zoneOption = zone.shadowRoot!.querySelector('lr-option') as HTMLElement & {label:string};
    expect(zoneOption.label).to.equal('kilometer-per-hour');
    expect(unitOption.label).to.not.equal(zoneOption.label);
  });
}

it('discloses the 1,000-row popup cap and reaches a custom tail through search', async function () {
  // Mounts two successive 1,000-option controls, including the lazy searchable module.
  this.timeout(20000);
  const entries = Array.from({length:1024}, (_, index) => `Custom/Zone${index}`);
  const el = await fixture<LyraTimeZonePicker>(html`<lr-time-zone-picker .timeZones=${entries}></lr-time-zone-picker>`);
  const child = el.shadowRoot!.querySelector<LyraSelect<false>>('lr-select')!;
  el.click();
  await waitUntil(() => child.querySelectorAll('lr-option').length === 1024);
  await child.updateComplete;
  expect(child.shadowRoot!.querySelectorAll('[part~="option"]').length).to.equal(1000);
  expect(child.shadowRoot!.querySelector('[part="option-overflow"]')?.textContent).to.contain('24');
  expect(child.getAttribute('exportparts')).to.contain('option-overflow:select-option-overflow');
  el.value = entries[1023]!; await el.updateComplete; await child.updateComplete;
  expect(child.shadowRoot!.querySelectorAll('[part~="option"]').length).to.equal(1000);
  expect(child.shadowRoot!.textContent).to.contain(entries[1023]!);
  el.value = ''; el.searchable = true; await el.updateComplete;
  const combo = el.shadowRoot!.querySelector<LyraCombobox<false>>('lr-combobox')!;
  await combo.updateComplete;
  await focusByKeyboard(combo.input!);
  combo.input!.value = 'Zone1023';
  combo.input!.dispatchEvent(new InputEvent('input', {bubbles:true,composed:true}));
  await combo.updateComplete;
  await sendKeys({press:'ArrowDown'}); await sendKeys({press:'Enter'});
  await el.updateComplete;
  expect(el.value).to.equal(entries[1023]);
});
