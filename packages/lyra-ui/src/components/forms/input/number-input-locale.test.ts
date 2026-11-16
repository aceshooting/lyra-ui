import { expect } from '@open-wc/testing';
import { formatLocaleNumber, localeNumberSymbols, parseLocaleNumber } from './number-input-locale.js';

describe('locale number parsing', () => {
  it('reads grouping and decimal separators of dot-grouping locales', () => {
    for (const locale of ['de', 'ro']) {
      expect(parseLocaleNumber('25.000', locale), locale).to.equal('25000');
      expect(parseLocaleNumber('10,24', locale), locale).to.equal('10.24');
      expect(parseLocaleNumber('1.234.567,5', locale), locale).to.equal('1234567.5');
      expect(parseLocaleNumber('-0,5', locale), locale).to.equal('-0.5');
    }
  });

  it('reads comma-grouping locales and rejects the other convention instead of misreading it', () => {
    expect(parseLocaleNumber('25,000', 'en')).to.equal('25000');
    expect(parseLocaleNumber('10.24', 'en')).to.equal('10.24');
    expect(parseLocaleNumber('10,24', 'en')).to.equal(null);
    expect(parseLocaleNumber('10.24', 'de')).to.equal(null);
    expect(parseLocaleNumber('1.2.3', 'en')).to.equal(null);
    expect(parseLocaleNumber('1,000.5.2', 'en')).to.equal(null);
  });

  it('accepts every space as the group of a space-grouping locale', () => {
    for (const text of ['25 000,5', '25 000,5', '25 000,5']) {
      expect(parseLocaleNumber(text, 'fr'), JSON.stringify(text)).to.equal('25000.5');
    }
  });

  it('follows two-digit secondary grouping in en-IN', () => {
    expect(parseLocaleNumber('12,34,567', 'en-IN')).to.equal('1234567');
    expect(parseLocaleNumber('1,234,567', 'en-IN')).to.equal(null);
  });

  it('accepts ungrouped digits, signs, U+2212, locale digits and blank text', () => {
    expect(parseLocaleNumber('  1234567,25 ', 'de')).to.equal('1234567.25');
    expect(parseLocaleNumber('+7', 'de')).to.equal('7');
    expect(parseLocaleNumber('−7,5', 'de')).to.equal('-7.5');
    expect(parseLocaleNumber(',5', 'de')).to.equal('0.5');
    expect(parseLocaleNumber('١٢٫٥', 'ar-EG')).to.equal('12.5');
    expect(parseLocaleNumber('', 'de')).to.equal('');
    expect(parseLocaleNumber('   ', 'de')).to.equal('');
  });

  it('rejects stray text, misplaced separators and exponents', () => {
    for (const text of ['abc', '12a', '.000', '1..2', '1.,2', '1,2,3', '1e3', '-', '12.', '1 2']) {
      expect(parseLocaleNumber(text, 'de'), text).to.equal(null);
    }
  });
});

describe('locale number formatting', () => {
  it('groups the integer part and keeps every fraction digit', () => {
    expect(formatLocaleNumber('25000', 'de')).to.equal('25.000');
    expect(formatLocaleNumber('10.50', 'de')).to.equal('10,50');
    expect(formatLocaleNumber('-1234567.125', 'en')).to.equal('-1,234,567.125');
    expect(formatLocaleNumber('-0.5', 'de')).to.equal('-0,5');
    expect(formatLocaleNumber('1234567', 'en-IN')).to.equal('12,34,567');
  });

  it('returns non-decimal values unchanged', () => {
    for (const value of ['', '1e3', 'abc', '-', '.']) expect(formatLocaleNumber(value, 'de'), value).to.equal(value);
  });

  it('round-trips formatted values through the parser', () => {
    for (const locale of ['de', 'en', 'fr', 'ro', 'en-IN', 'ar-EG', 'de-CH']) {
      for (const value of ['0', '7', '1234', '25000.5', '-98765432.01']) {
        expect(parseLocaleNumber(formatLocaleNumber(value, locale), locale), `${locale} ${value}`).to.equal(value);
      }
    }
  });

  it('caches symbols per locale', () => {
    expect(localeNumberSymbols('de')).to.equal(localeNumberSymbols('de'));
    expect(localeNumberSymbols('de').decimal).to.equal(',');
  });
});
