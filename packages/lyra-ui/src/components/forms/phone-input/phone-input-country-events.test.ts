import { expect, fixture, html } from '@open-wc/testing';
import './phone-input.js';
import { loadFlagUrlResolver, setFlagUrlResolver } from '../../media/flag/flag-url-resolver.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import type { OptionalPeerLoader } from '../../../internal/optional-peer-capabilities.js';
import { LyraPhoneInput, type LyraPhoneNumberAdapter } from './phone-input.js';

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

it('retries a failed flag registration on update and shares its successful import', async () => {
  const { flagRegistration } = LyraPhoneInput as unknown as { flagRegistration: OptionalPeerLoader<CustomElementConstructor> };
  const previousResolver = await loadFlagUrlResolver();
  const holder = await fixture<HTMLElement>(html`<div></div>`);
  setFlagUrlResolver(async () => 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E');
  let attempts = 0;
  expectDevWarning('phone-input-flag-registration');
  flagRegistration.override(async () => {
    if (++attempts === 1) throw new Error('Chunk unavailable');
    return (await import('../../media/flag/flag.js')).LyraFlag;
  });
  try {
    const el = document.createElement('lr-phone-input');
    el.adapter = adapter;
    holder.append(el);
    await el.updateComplete;
    expect(attempts).to.equal(0);
    el.flags = true;
    await el.updateComplete;
    expect(attempts).to.equal(1);
    el.requestUpdate();
    await el.updateComplete;
    await customElements.whenDefined('lr-flag');
    expect(el.shadowRoot!.querySelector('lr-flag')?.matches(':defined')).to.equal(true);
    const other = document.createElement('lr-phone-input');
    other.flags = true;
    other.adapter = adapter;
    holder.append(other);
    await other.updateComplete;
    expect(attempts).to.equal(2);
  } finally {
    holder.replaceChildren();
    setFlagUrlResolver(previousResolver);
    flagRegistration.override();
  }
});
