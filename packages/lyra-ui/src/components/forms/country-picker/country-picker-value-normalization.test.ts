import { expect, fixture, html } from '@open-wc/testing';
import './country-picker.js';
import type { LyraCountryPicker } from './country-picker.class.js';

describe('lr-country-picker value normalization', () => {
  it('upper-cases a two-letter code and clears a non-string value', async () => {
    const el = await fixture<LyraCountryPicker>(html`<lr-country-picker label="Country"></lr-country-picker>`);
    el.value = ' fr ';
    expect(el.value).to.equal('FR');
    (el as unknown as { value: unknown }).value = 42;
    expect(el.value).to.equal('');
  });
});
