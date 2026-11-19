import { expect } from '@open-wc/testing';
import { formatAdaptiveShare, formatLocaleNumber, pluralCategory } from './locale-number.js';

describe('locale-number', () => {
  it('formats per locale and switches with the locale', () => {
    expect(formatLocaleNumber('en', 1234.5)).to.equal('1,234.5');
    expect(formatLocaleNumber('de', 1234.5)).to.equal('1.234,5');
  });
  it('accepts options and is safe for non-finite values', () => {
    expect(formatLocaleNumber('en', 0.5, { style: 'percent' })).to.equal('50%');
    for (const bad of [NaN, Infinity, -Infinity]) expect(formatLocaleNumber('en', bad)).to.equal('0');
  });
  it('keeps small nonzero shares visible', () => {
    expect(formatAdaptiveShare('en', 0.0004)).to.equal('<0.1%');
    expect(formatAdaptiveShare('en', 0.005)).to.equal('0.5%');
    expect(formatAdaptiveShare('en', 0.1234)).to.equal('12%');
    expect(formatAdaptiveShare('en', 0)).to.equal('0%');
    expect(formatAdaptiveShare('en', 1)).to.equal('100%');
    expect(formatAdaptiveShare('en', NaN)).to.equal('0%');
  });
  it('localizes the share', () => {
    expect(formatAdaptiveShare('de', 0.25).replace(/\s/g, ' ')).to.equal('25 %');
  });
  it('selects plural categories', () => {
    expect(pluralCategory('en', 1)).to.equal('one');
    expect(pluralCategory('en', 2)).to.equal('other');
    expect(pluralCategory('ar', 2)).to.equal('two');
    expect(pluralCategory('en', NaN)).to.equal('other');
  });
});
