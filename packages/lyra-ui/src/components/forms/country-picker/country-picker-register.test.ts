import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraCountryPicker } from './country-picker.class.js';
import type { LyraCombobox } from '../combobox/combobox.class.js';
import './country-picker-register.js';
import '../currency-picker/currency-picker-register.js';
import '../time-zone-picker/time-zone-picker-register.js';
import '../unit-picker/unit-picker-register.js';

describe('lean catalog registration', () => {
  it('registers each catalog without eagerly registering select, option or combobox', () => {
    for (const name of ['country', 'currency', 'time-zone', 'unit']) {
      expect(typeof customElements.get(`lr-${name}-picker`)).to.equal('function');
    }
    for (const name of ['select', 'option', 'combobox']) {
      expect(customElements.get(`lr-${name}`) === undefined).to.equal(true);
    }
  });

  it('loads the specialized filter control with explicit option/select imports and commits a searched selection', async () => {
    await import('../combobox/option.js');
    await import('../select/select.js');
    expect(customElements.get('lr-combobox') === undefined).to.equal(true);
    const form = await fixture<HTMLFormElement>(html`<form><lr-country-picker name="country" label="Country" value="FR" .countries=${['FR', 'GB']}></lr-country-picker></form>`);
    const picker = form.querySelector<LyraCountryPicker>('lr-country-picker')!;
    await picker.updateComplete;
    picker.searchable = true;
    await customElements.whenDefined('lr-combobox');
    await picker.updateComplete;
    await waitUntil(() => Boolean(picker.shadowRoot?.querySelector('lr-combobox')));
    const fetchedModules = performance.getEntriesByType('resource').map(entry => new URL(entry.name).pathname);
    expect(fetchedModules.some(name => /\/combobox-catalog\.(?:ts|js)$/u.test(name))).to.equal(true);
    expect(fetchedModules.some(name => /\/combobox\.(?:ts|js)$/u.test(name))).to.equal(false);
    const combo = picker.shadowRoot!.querySelector<LyraCombobox<false>>('lr-combobox')!;
    await combo.updateComplete;
    await waitUntil(() => combo.querySelectorAll('lr-option').length === 2);
    expect(new FormData(form).get('country')).to.equal('FR');
    picker.input!.value = 'kingdom';
    picker.input!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await combo.updateComplete;
    await focusByKeyboard(picker);
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'Enter' });
    await picker.updateComplete;
    expect(picker.value).to.equal('GB');
    expect(new FormData(form).get('country')).to.equal('GB');
  });
});
