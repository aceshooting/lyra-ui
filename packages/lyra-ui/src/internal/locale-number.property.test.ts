import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { formatAdaptiveShare, formatLocaleNumber, pluralCategory } from './locale-number.js';

const locales = fc.constantFrom('en', 'de', 'fr', 'ar', 'ja', 'hi');

describe('locale-number properties', () => {
  it('never prints NaN/Infinity text and never throws', () => {
    fc.assert(
      fc.property(locales, fc.double(), (locale, value) => {
        expect(formatLocaleNumber(locale, value)).to.not.match(/NaN|Infinity|∞/);
      }),
      propertyRuns(),
    );
  });
  it('a nonzero share below 100% never formats as a plain zero percent', () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-9, max: 1, noNaN: true }), (fraction) => {
        const text = formatAdaptiveShare('en', fraction);
        expect(text, String(fraction)).to.not.equal('0%');
        expect(text, String(fraction)).to.not.equal('0.0%');
      }),
      propertyRuns(),
    );
  });
  it('plural category is always one of the CLDR categories', () => {
    fc.assert(
      fc.property(locales, fc.double(), (locale, n) => {
        expect(['zero', 'one', 'two', 'few', 'many', 'other']).to.include(pluralCategory(locale, n));
      }),
      propertyRuns(),
    );
  });
});
