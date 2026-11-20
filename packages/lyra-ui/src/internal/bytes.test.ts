import { expect } from '@open-wc/testing';
import {
  byteFormat,
  byteUnitIndex,
  formatByteSize,
  formatFileSize,
  safeByteUnitStep,
} from './bytes.js';

describe('byte unit ladder', () => {
  it('falls back to the decimal step for a step that cannot scale', () => {
    expect(safeByteUnitStep(1024)).to.equal(1024);
    expect(safeByteUnitStep(1.5)).to.equal(1.5);
    for (const step of [1, 0.5, 0, -8, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(safeByteUnitStep(step)).to.equal(1000);
    }
  });

  it('selects the highest rung the magnitude reaches, capped at the ladder top', () => {
    expect(byteUnitIndex(999, 1000)).to.equal(0);
    expect(byteUnitIndex(1000, 1000)).to.equal(1);
    expect(byteUnitIndex(-1_500_000, 1000)).to.equal(2);
    expect(byteUnitIndex(1000, 10)).to.equal(3);
    expect(byteUnitIndex(1e30, 1000)).to.equal(5);
    expect(byteUnitIndex(1024 ** 5, 1024, 5)).to.equal(4);
    expect(byteUnitIndex(Number.NaN, 1000)).to.equal(0);
  });

  it('builds validated Intl unit options for bytes and bits', () => {
    expect(byteFormat(1500, 'byte', 'short', 1000, 1)).to.deep.equal({
      index: 1,
      amount: 1.5,
      options: { style: 'unit', unit: 'kilobyte', unitDisplay: 'short', maximumFractionDigits: 1 },
    });
    const bits = byteFormat(3 * 1024 ** 2, 'bit', 'long', 1024, 2.9);
    expect([bits.index, bits.amount, bits.options.unit, bits.options.unitDisplay, bits.options.maximumFractionDigits])
      .to.deep.equal([2, 3, 'megabit', 'long', 2]);
    const hostile = byteFormat(5, 'nibble' as 'byte', 'tiny' as 'short', Number.NaN, Number.NaN);
    expect([hostile.options.unit, hostile.options.unitDisplay, hostile.options.maximumFractionDigits])
      .to.deep.equal(['byte', 'short', 1]);
    expect(byteFormat(1, 'byte', 'narrow', 1000, 40).options.maximumFractionDigits).to.equal(10);
  });
});

describe('formatByteSize', () => {
  it('formats through Intl unit names in the requested locale', () => {
    expect(formatByteSize(1500, 'en')).to.match(/^1\.5\s?kB$/);
    expect(formatByteSize(1536, 'en', { unitStep: 1024 })).to.match(/^1\.5\s?kB$/);
    expect(formatByteSize(1536, 'de', { unitStep: 1024 })).to.match(/^1,5\s?kB$/);
    expect(formatByteSize(2e6, 'en', { unit: 'bit', display: 'long' })).to.match(/^2\smegabits$/);
    expect(formatByteSize(1234, 'en', { decimals: 0 })).to.match(/^1\s?kB$/);
    expect(formatByteSize(-1500, 'en')).to.match(/^-1\.5\s?kB$/);
  });

  it('words the short base rung with the symbol its kilo rung abbreviates to', () => {
    expect([formatByteSize(1, 'en'), formatByteSize(20, 'en'), formatByteSize(1500, 'en')]).to.deep.equal(['1 B', '20 B', '1.5 kB']);
    expect(['ja', 'pt-PT', 'fr'].map((locale) => formatByteSize(20, locale).replace(/\s/gu, ' '))).to.deep.equal(['20 B', '20 B', '20 o']);
    // A locale whose kilo rung is itself a word keeps Intl's consistent short wording.
    const arabic = (amount: number) => new Intl.NumberFormat('ar', { style: 'unit', unit: 'byte', unitDisplay: 'short' }).format(amount);
    expect(formatByteSize(20, 'ar')).to.equal(arabic(20));
    expect(formatByteSize(20, 'en', { unit: 'bit' })).to.equal('20 bit');
    expect(formatByteSize(20, 'en', { display: 'long' })).to.equal('20 bytes');
  });

  it('returns an empty string for a value that is not a finite number', () => {
    expect(formatByteSize(Number.NaN, 'en')).to.equal('');
    expect(formatByteSize(Number.POSITIVE_INFINITY, 'en')).to.equal('');
    expect(formatByteSize('12' as unknown as number, 'en')).to.equal('');
  });
});

describe('formatFileSize', () => {
  it('scales on binary rungs through PB with Intl unit wording and at most one fraction digit', () => {
    const intl = (amount: number, unit: string) =>
      new Intl.NumberFormat('en', { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 }).format(amount);
    expect(formatFileSize(0, 'en')).to.equal('0 B');
    expect(formatFileSize(512, 'en')).to.equal('512 B');
    expect(formatFileSize(1023.96, 'en')).to.equal(intl(1, 'kilobyte'));
    expect(formatFileSize(1536, 'en')).to.equal(intl(1.5, 'kilobyte'));
    expect(formatFileSize(2_415_919, 'en')).to.equal(intl(2.3, 'megabyte'));
    expect(formatFileSize(1024 ** 4, 'en')).to.equal(intl(1, 'terabyte'));
    expect(formatFileSize(1024 ** 5, 'en')).to.equal(intl(1, 'petabyte'));
  });

  it('matches the shared byte formatter at a binary step in any locale', () => {
    for (const [bytes, locale] of [[1536, 'de'], [5 * 1024 ** 3, 'fr'], [999, 'ja']] as const) {
      expect(formatFileSize(bytes, locale)).to.equal(formatByteSize(bytes, locale, { unitStep: 1024 }));
    }
    expect(formatFileSize(1536, 'de')).to.match(/^1,5\s?kB$/);
  });

  it('returns an empty string for a negative or non-finite size and never prints negative zero', () => {
    for (const bytes of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(formatFileSize(bytes, 'en')).to.equal('');
    }
    expect(formatFileSize(-0, 'en')).to.equal(formatFileSize(0, 'en'));
  });
});
