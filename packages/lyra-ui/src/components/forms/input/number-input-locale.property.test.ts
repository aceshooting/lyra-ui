import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { formatLocaleNumber, parseLocaleNumber } from './number-input-locale.js';

const locale = fc.constantFrom('de', 'en', 'fr', 'ro', 'en-IN', 'ar-EG', 'de-CH', 'es', 'pl');
const canonical = fc
  .tuple(fc.boolean(), fc.stringMatching(/^[1-9][0-9]{0,14}$|^0$/), fc.option(fc.stringMatching(/^[0-9]{1,6}$/), { nil: undefined }))
  .map(([negative, integer, fraction]) => `${negative ? '-' : ''}${integer}${fraction === undefined ? '' : `.${fraction}`}`);

it('parses every formatted canonical value back to itself', () => {
  fc.assert(fc.property(locale, canonical, (tag, value) => {
    expect(parseLocaleNumber(formatLocaleNumber(value, tag), tag)).to.equal(value);
  }), propertyRuns());
});

it('only ever yields blank, null or a canonical decimal string', () => {
  fc.assert(fc.property(locale, fc.string(), (tag, text) => {
    const parsed = parseLocaleNumber(text, tag);
    if (parsed === null || parsed === '') return;
    expect(/^-?\d+(\.\d+)?$/.test(parsed), parsed).to.equal(true);
  }), propertyRuns());
});
