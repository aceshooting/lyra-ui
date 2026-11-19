import { expect, fixture, html } from '@open-wc/testing';
import './phone-input.js';
import type { LyraPhoneInput, LyraPhoneNumberAdapter } from './phone-input.js';

const adapter: LyraPhoneNumberAdapter = {
  countries: [
    { code: 'LU', callingCode: '352' },
    { code: 'FR', callingCode: '33' },
  ],
  parse: () => ({ status: 'empty' }),
};

describe('lr-phone-input country select', () => {
  it('lets the host see one input event, after the country is applied', async () => {
    const el = await fixture<LyraPhoneInput>(
      html`<lr-phone-input default-country="LU" .adapter=${adapter}></lr-phone-input>`
    );
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector<HTMLSelectElement>('[part="country-select"]')!;
    const seen: string[] = [];
    el.addEventListener('input', () => seen.push(el.country));
    select.value = 'FR';
    select.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(seen).to.deep.equal(['FR']);
  });
});
