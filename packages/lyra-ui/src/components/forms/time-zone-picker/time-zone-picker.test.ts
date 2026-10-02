import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraTimeZonePicker } from './time-zone-picker.class.js';
import type { LyraCombobox } from '../combobox/combobox.class.js';
import { getTimeZoneCodes } from '../../../time-zones.js';
import './time-zone-picker.js';

describe('<lr-time-zone-picker>', () => {
  it('includes UTC and runtime IANA zones without choosing a zone automatically', async () => {
    const el = await fixture<LyraTimeZonePicker>(html`<lr-time-zone-picker label="Time zone"></lr-time-zone-picker>`);
    expect(el.value).to.equal('');
    expect(getTimeZoneCodes().includes('UTC')).to.equal(true);
    expect(getTimeZoneCodes().includes('Europe/Luxembourg')).to.equal(true);
    expect(el.input === null).to.equal(true);
  });

  it('preserves explicit order, groups and identifiers and validates unavailable selections', async () => {
    const el = await fixture<LyraTimeZonePicker>(html`<lr-time-zone-picker label="Time zone" value="Europe/Paris" .timeZones=${[
      { code: 'UTC', group: 'Common' }, { code: 'Europe/Paris', label: 'Paris', group: 'Europe' },
    ]}></lr-time-zone-picker>`);
    expect(el.value).to.equal('Europe/Paris');
    expect(el.validity.valid).to.equal(true);
    expect([...el.shadowRoot!.querySelectorAll('lr-option')].map((row) => row.value)).to.deep.equal(['UTC', 'Europe/Paris']);
    el.timeZones = ['UTC'];
    expect(el.validity.customError).to.equal(true);
    expect(el.value).to.equal('Europe/Paris');
  });

  it('renders populated named choices accessibly and supports an explicitly empty catalog', async () => {
    const el = await fixture<LyraTimeZonePicker>(html`<lr-time-zone-picker searchable label="Time zone" .timeZones=${['UTC', 'Asia/Beirut']} value="UTC"></lr-time-zone-picker>`);
    const child = el.shadowRoot!.querySelector('lr-combobox')!;
    await child.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-option').length).to.equal(2);
    await child.show();
    expect(child.shadowRoot!.querySelector('[role="listbox"]')!.getBoundingClientRect().height > 0).to.equal(true);
    expect(child.shadowRoot!.querySelectorAll('[part~="option"]').length).to.equal(2);
    await expect(el).to.be.accessible();
    el.timeZones = [];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-option').length).to.equal(0);
    expect(el.value).to.equal('UTC');
    expect(el.validity.customError).to.equal(true);
  });

  it('trims identifiers without changing case and keeps form reset and restored state synchronous', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-time-zone-picker name="zone" label="Time zone"
      value=" Europe/Paris " .timeZones=${['Europe/Paris', 'America/New_York', 'UTC']}></lr-time-zone-picker></form>`);
    const el = form.querySelector('lr-time-zone-picker')!;
    expect(el.value).to.equal('Europe/Paris');
    expect(new FormData(form).get('zone')).to.equal('Europe/Paris');
    el.value = ' America/New_York ';
    expect(new FormData(form).get('zone')).to.equal('America/New_York');
    el.defaultValue = ' UTC ';
    expect(el.value).to.equal('America/New_York');
    form.reset();
    expect(el.value).to.equal('UTC');
    el.formStateRestoreCallback(' Europe/Paris ', 'restore');
    expect(new FormData(form).get('zone')).to.equal('Europe/Paris');
    el.value = 'europe/paris';
    expect(el.value).to.equal('europe/paris');
    expect(el.validity.customError).to.equal(true);
    el.defaultValue = null;
    form.reset();
    expect(el.value).to.equal('');
  });

  it('filters readable IANA names and caller labels without changing committed state until selection', async () => {
    const el = await fixture<LyraTimeZonePicker>(html`<lr-time-zone-picker searchable label="Time zone" value="UTC"
      .timeZones=${[{ code: 'UTC', group: 'Common' }, { code: 'America/New_York', group: 'Americas' },
        { code: 'Asia/Beirut', label: 'Beirut office', group: 'Asia' }]}></lr-time-zone-picker>`);
    const child = el.shadowRoot!.querySelector<LyraCombobox<false>>('lr-combobox')!;
    await child.updateComplete;
    const events: string[] = [];
    for (const name of ['input', 'lr-input', 'change', 'lr-change']) el.addEventListener(name, () => events.push(name));
    el.input!.value = 'New York';
    el.input!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await waitUntil(() => child.shadowRoot!.querySelectorAll('[part~="option"]').length === 1);
    expect(child.shadowRoot!.querySelector('[part~="option"]')?.getAttribute('data-value')).to.equal('America/New_York');
    expect(el.value).to.equal('UTC');
    expect(events).to.deep.equal([]);
    el.input!.value = 'office';
    el.input!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await waitUntil(() => child.shadowRoot!.querySelector('[part~="option"]')?.getAttribute('data-value') === 'Asia/Beirut');
    child.shadowRoot!.querySelector<HTMLElement>('[part~="option"]')!.click();
    expect(el.value).to.equal('Asia/Beirut');
    expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  });

  it('owns ordered immutable catalogs and never invokes caller getters', async () => {
    let reads = 0;
    const first = { code: ' UTC ', label: 'Coordinated time', group: 'Common' };
    const source = [first,
      { code: 'Europe/Paris', get label() { reads++; return 'Unsafe'; } }, { code: 'UTC', label: 'Duplicate' }];
    const el = await fixture<LyraTimeZonePicker>(html`<lr-time-zone-picker label="Time zone" .timeZones=${source}></lr-time-zone-picker>`);
    expect(el.timeZones).to.deep.equal([{ code: 'UTC', label: 'Coordinated time', group: 'Common' }]);
    expect(reads).to.equal(0);
    expect(Object.isFrozen(el.timeZones)).to.equal(true);
    first.label = 'Changed';
    expect(el.shadowRoot!.querySelector('lr-option')?.label).to.equal('Coordinated time');
    el.timeZones = undefined;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-option').length).to.equal(getTimeZoneCodes().length);
  });

  it('localizes the actual filter accessible name through a strings override', async () => {
    const el = await fixture<LyraTimeZonePicker>(html`<lr-time-zone-picker searchable .strings=${{
      timeZonePickerLabel: 'Fuseau horaire',
    }} .timeZones=${['UTC']}></lr-time-zone-picker>`);
    await el.shadowRoot!.querySelector('lr-combobox')!.updateComplete;
    expect(el.input?.getAttribute('aria-label')).to.equal('Fuseau horaire');
  });

  it('examines at most 1024 caller rows even when preceding rows are invalid', async () => {
    const source = [...Array.from({ length: 1024 }, () => ''), 'UTC'];
    const el = await fixture<LyraTimeZonePicker>(html`<lr-time-zone-picker label="Time zone" .timeZones=${source}></lr-time-zone-picker>`);
    expect(el.timeZones).to.deep.equal([]);
    source[1023] = 'UTC';
    el.timeZones = source;
    expect(el.timeZones).to.deep.equal([{ code: 'UTC' }]);
  });
});
