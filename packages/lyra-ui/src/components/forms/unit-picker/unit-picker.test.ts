import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraUnitPicker } from './unit-picker.class.js';
import type { LyraCombobox } from '../combobox/combobox.class.js';
import { UNIT_CODES } from '../../../units.js';
import './unit-picker.js';
import '../../../translations/fr/forms.js';
import '../../../translations/fr/shared.js';

describe('<lr-unit-picker>', () => {
  it('offers standard measurement units without choosing or converting a value', async () => {
    const el = await fixture<LyraUnitPicker>(html`<lr-unit-picker label="Unit"></lr-unit-picker>`);
    expect(el.value).to.equal('');
    expect(UNIT_CODES.includes('kilometer')).to.equal(true);
    expect(UNIT_CODES.includes('celsius')).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll('lr-option').length).to.equal(UNIT_CODES.length);
    expect(el.input === null).to.equal(true);
  });

  it('renders the default filter name and updates it through a strings override', async () => {
    const el = await fixture<LyraUnitPicker>(html`<lr-unit-picker searchable lang="en" .units=${['meter']}></lr-unit-picker>`);
    const child = el.shadowRoot!.querySelector('lr-combobox')!;
    await child.updateComplete;
    expect(el.input?.getAttribute('aria-label')).to.equal('Unit');
    el.strings = { unitPickerLabel: 'Unité de mesure' };
    await el.updateComplete;
    await child.updateComplete;
    expect(el.input?.getAttribute('aria-label')).to.equal('Unité de mesure');
  });

  it('supports caller-defined units, symbols, groups, ordering and immutable snapshots', async () => {
    const units = [{ code: 'kWh', label: 'Kilowatt-hour', symbol: 'kWh', group: 'Energy' }, { code: 'MWh', label: 'Megawatt-hour', disabled: true }];
    const el = await fixture<LyraUnitPicker>(html`<lr-unit-picker label="Energy unit" .units=${units} value="kWh"></lr-unit-picker>`);
    units[0]!.label = 'Changed';
    expect(el.units?.[0]).to.deep.equal({ code: 'kWh', label: 'Kilowatt-hour', symbol: 'kWh', group: 'Energy' });
    expect(el.validity.valid).to.equal(true);
    el.value = 'MWh';
    expect(el.validity.customError).to.equal(true);
    expect(el.value).to.equal('MWh');
  });

  it('renders localized populated choices accessibly with no implicit unit change', async () => {
    const el = await fixture<LyraUnitPicker>(html`<lr-unit-picker lang="fr" searchable label="Unité" .units=${['meter', 'kilometer']} value="meter"></lr-unit-picker>`);
    const child = el.shadowRoot!.querySelector('lr-combobox')!;
    await child.updateComplete;
    expect(el.shadowRoot!.querySelector('lr-option')!.label).to.contain('mètre');
    expect(el.value).to.equal('meter');
    await child.show();
    expect(child.shadowRoot!.querySelector('[role="listbox"]')!.getBoundingClientRect().height > 0).to.equal(true);
    expect(child.shadowRoot!.querySelectorAll('[part~="option"]').length).to.equal(2);
    await expect(el).to.be.accessible();
  });

  it('searches localized names and custom symbols while committing only an offered enabled unit', async () => {
    const el = await fixture<LyraUnitPicker>(html`<lr-unit-picker searchable lang="fr" label="Unité" value="meter" .units=${[
      { code: 'meter', group: 'Length' }, { code: 'kilometer', group: 'Length' },
      { code: 'energy-credit', label: 'Energy credit', symbol: 'EC', group: 'Energy' },
    ]}></lr-unit-picker>`);
    const child = el.shadowRoot!.querySelector<LyraCombobox<false>>('lr-combobox')!;
    await child.updateComplete;
    const events: string[] = [];
    for (const name of ['input', 'lr-input', 'change', 'lr-change']) el.addEventListener(name, () => events.push(name));
    el.input!.value = 'kilomètre';
    el.input!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await waitUntil(() => child.shadowRoot!.querySelectorAll('[part~="option"]').length === 1);
    expect(child.shadowRoot!.querySelector('[part~="option"]')?.getAttribute('data-value')).to.equal('kilometer');
    expect(el.value).to.equal('meter');
    expect(events).to.deep.equal([]);
    el.input!.value = 'EC';
    el.input!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await waitUntil(() => child.shadowRoot!.querySelector('[part~="option"]')?.getAttribute('data-value') === 'energy-credit');
    child.shadowRoot!.querySelector<HTMLElement>('[part~="option"]')!.click();
    expect(el.value).to.equal('energy-credit');
    expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  });

  it('preserves custom identifier case, reset defaults and unavailable values without converting measurements', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-unit-picker label="Energy unit" name="unit"
      value=" kWh " .units=${['kWh', 'MWh']}></lr-unit-picker></form>`);
    const el = form.querySelector('lr-unit-picker')!;
    expect(el.value).to.equal('kWh');
    expect(new FormData(form).get('unit')).to.equal('kWh');
    el.value = ' MWh ';
    expect(new FormData(form).get('unit')).to.equal('MWh');
    el.defaultValue = ' kWh ';
    form.reset();
    expect(el.value).to.equal('kWh');
    el.formStateRestoreCallback(' MWh ', 'restore');
    expect(el.value).to.equal('MWh');
    el.units = [];
    expect(el.validity.customError).to.equal(true);
    expect(new FormData(form).get('unit')).to.equal('MWh');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-option').length).to.equal(0);
  });

  it('updates localized display and searchable names after a locale change without selection events', async () => {
    const el = await fixture<LyraUnitPicker>(html`<lr-unit-picker searchable lang="en" label="Unit"
      value="meter" .units=${['meter', 'second']}></lr-unit-picker>`);
    const child = el.shadowRoot!.querySelector('lr-combobox')!;
    await child.updateComplete;
    const events: string[] = [];
    for (const name of ['input', 'lr-input', 'change', 'lr-change']) el.addEventListener(name, () => events.push(name));
    el.lang = 'fr';
    await waitUntil(() => el.shadowRoot!.querySelector('lr-option')?.label === 'mètre');
    await child.updateComplete;
    expect(el.input?.value).to.equal('mètre');
    el.input!.value = 'mèt';
    el.input!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await waitUntil(() => child.shadowRoot!.querySelectorAll('[part~="option"]').length === 1);
    expect(child.shadowRoot!.querySelector('[part~="option"]')?.getAttribute('data-value')).to.equal('meter');
    expect(el.value).to.equal('meter');
    expect(events).to.deep.equal([]);
  });

  it('does not commit a disabled matching unit through keyboard or pointer activation', async () => {
    const el = await fixture<LyraUnitPicker>(html`<lr-unit-picker searchable label="Unit" value="meter" .units=${[
      { code: 'meter' }, { code: 'kWh', label: 'Kilowatt-hour', disabled: true },
    ]}></lr-unit-picker>`);
    const child = el.shadowRoot!.querySelector('lr-combobox')!;
    await child.updateComplete;
    const events: string[] = [];
    for (const name of ['input', 'lr-input', 'change', 'lr-change']) el.addEventListener(name, () => events.push(name));
    await focusByKeyboard(el.input!);
    el.input!.value = 'Kilowatt';
    el.input!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await waitUntil(() => child.shadowRoot!.querySelectorAll('[part~="option"]').length === 1);
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'Enter' });
    expect(el.value).to.equal('meter');
    expect(events).to.deep.equal([]);
    await child.show();
    const row = child.shadowRoot!.querySelector<HTMLElement>('[part~="option"][data-value="kWh"]')!;
    expect(row.getAttribute('aria-disabled')).to.equal('true');
    const rect = row.getBoundingClientRect();
    expect(rect.width > 0 && rect.height > 0).to.equal(true);
    await sendMouse({ type: 'click', position: [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)] });
    expect(el.value).to.equal('meter');
    expect(events).to.deep.equal([]);
  });

  it('examines at most 1024 caller rows even when preceding rows are invalid', async () => {
    const source = [...Array.from({ length: 1024 }, () => ''), 'meter'];
    const el = await fixture<LyraUnitPicker>(html`<lr-unit-picker label="Unit" .units=${source}></lr-unit-picker>`);
    expect(el.units).to.deep.equal([]);
    source[1023] = 'meter';
    el.units = source;
    expect(el.units).to.deep.equal([{ code: 'meter' }]);
  });
});
