import { expect } from '@open-wc/testing';
import {
  loadLibphonenumberAdapter,
  normalizeCountryCatalog,
  normalizeParseResult,
} from './phone-number-adapter.js';

describe('phone-number-adapter result normalization', () => {
  it('treats a non-object adapter result as invalid input', () => {
    expect(normalizeParseResult(null, '555')).to.deep.equal({ status: 'invalid', formatted: '555' });
    expect(normalizeParseResult('valid', '555')).to.deep.equal({ status: 'invalid', formatted: '555' });
  });

  it('keeps the adapter formatting but rejects a non-string country', () => {
    expect(normalizeParseResult({ status: 'incomplete', formatted: '55 5', country: 7 }, '555'))
      .to.deep.equal({ status: 'invalid', formatted: '55 5' });
    expect(normalizeParseResult({ status: 'incomplete', country: 7 }, '555'))
      .to.deep.equal({ status: 'invalid', formatted: '555' });
  });

  it('downgrades a valid status without a well-formed E.164 number, keeping the country', () => {
    expect(normalizeParseResult({ status: 'valid', e164: '12345', country: 'us' }, '12345'))
      .to.deep.equal({ status: 'invalid', formatted: '12345', country: 'US' });
    expect(normalizeParseResult({ status: 'valid', formatted: '1 2', e164: 12 }, '12'))
      .to.deep.equal({ status: 'invalid', formatted: '1 2' });
  });
});

describe('phone-number-adapter country catalog', () => {
  it('skips primitive and null rows while keeping valid ones', () => {
    const rows = normalizeCountryCatalog([null, 'FR', 3, { code: 'fr', callingCode: '+33', label: 'France' }]);
    expect(rows).to.deep.equal([{ code: 'FR', callingCode: '33', label: 'France' }]);
  });
});

describe('loadLibphonenumberAdapter', () => {
  it('accepts a callable namespace that exposes the required capability', async () => {
    const api = Object.assign(() => undefined, {
      getCountries: () => ['us'],
      getCountryCallingCode: () => '1',
      parsePhoneNumberFromString: () => undefined,
    });
    const adapter = await loadLibphonenumberAdapter(async () => api);
    expect((adapter.countries ?? []).map((country) => country.code)).to.deep.equal(['US']);
    expect(adapter.parse('abc')).to.deep.equal({ status: 'invalid', formatted: 'abc' });
  });

  it('rejects a primitive module with a descriptive TypeError', async () => {
    let error: unknown;
    try {
      await loadLibphonenumberAdapter(async () => 42);
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(TypeError);
    expect((error as Error).message).to.contain('getCountries');
  });
});
