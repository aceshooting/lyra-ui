import { expect } from '@open-wc/testing';
import {
  byteFormat,
  byteUnitIndex,
  FILE_SIZE_UNIT_KEYS,
  formatByteSize,
  formatFileSize,
  formatLocalizedFileSize,
  localizedNumberLabel,
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

  it('returns an empty string for a value that is not a finite number', () => {
    expect(formatByteSize(Number.NaN, 'en')).to.equal('');
    expect(formatByteSize(Number.POSITIVE_INFINITY, 'en')).to.equal('');
    expect(formatByteSize('12' as unknown as number, 'en')).to.equal('');
  });
});

describe('formatFileSize', () => {
  it('prints whole bytes and one decimal for each binary rung up to terabytes', () => {
    expect(formatFileSize(0)).to.equal('0 B');
    expect(formatFileSize(512)).to.equal('512 B');
    expect(formatFileSize(1023.4)).to.equal('1023 B');
    expect(formatFileSize(1023.6)).to.equal('1024 B');
    expect(formatFileSize(1024)).to.equal('1.0 KB');
    expect(formatFileSize(1536)).to.equal('1.5 KB');
    expect(formatFileSize(2_415_919)).to.equal('2.3 MB');
    expect(formatFileSize(1.5 * 1024 ** 3)).to.equal('1.5 GB');
    expect(formatFileSize(1024 ** 4)).to.equal('1.0 TB');
    expect(formatFileSize(1024 ** 5)).to.equal('1024.0 TB');
  });

  it('returns an empty string for a negative or non-finite size and never prints negative zero', () => {
    for (const bytes of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(formatFileSize(bytes)).to.equal('');
    }
    expect(formatFileSize(-0, undefined, localizedNumberLabel('en'))).to.equal('0 B');
  });

  it('labels units and numbers through the supplied callbacks', () => {
    const units: string[] = [];
    const text = formatFileSize(
      2_415_919,
      (unit) => {
        units.push(unit);
        return `<${unit}>`;
      },
      (value, digits) => `${value.toFixed(3)}/${digits}`,
    );
    expect(text).to.equal('2.304/1 <MB>');
    expect(units).to.deep.equal(['MB']);
  });

  it('formats numbers with exactly the requested fraction digits in a locale', () => {
    expect(localizedNumberLabel('de')(2.25, 1)).to.equal('2,3');
    expect(localizedNumberLabel('en')(1234.5, 1)).to.equal('1,234.5');
    expect(localizedNumberLabel('en')(3, 1)).to.equal('3.0');
  });

  it('resolves localized unit keys and locale digits in one call', () => {
    const keys: string[] = [];
    const label = (key: string): string => {
      keys.push(key);
      return `[${key}]`;
    };
    expect(formatLocalizedFileSize(1536, 'de', label)).to.equal('1,5 [fileSizeUnitKb]');
    expect(formatLocalizedFileSize(3, 'en', label)).to.equal('3 [fileSizeUnitB]');
    expect(formatLocalizedFileSize(-5, 'en', label)).to.equal('');
    expect(keys).to.deep.equal(['fileSizeUnitKb', 'fileSizeUnitB']);
    expect(Object.values(FILE_SIZE_UNIT_KEYS)).to.deep.equal([
      'fileSizeUnitB',
      'fileSizeUnitKb',
      'fileSizeUnitMb',
      'fileSizeUnitGb',
      'fileSizeUnitTb',
    ]);
  });
});
