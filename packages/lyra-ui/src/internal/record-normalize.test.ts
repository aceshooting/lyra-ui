import { expect } from '@open-wc/testing';
import { boundedRecordString, normalizeLabeledOptions } from './record-normalize.js';

describe('boundedRecordString', () => {
  it('truncates a string to the bound and treats every other value as empty', () => {
    expect(boundedRecordString('abcdef', 3)).to.equal('abc');
    expect(boundedRecordString('abc', 10)).to.equal('abc');
    for (const value of [undefined, null, 5, {}, ['abc']]) expect(boundedRecordString(value, 10), String(value)).to.equal('');
  });
});

describe('normalizeLabeledOptions', () => {
  it('returns a frozen empty list for input that is not an array', () => {
    for (const value of [undefined, null, 'abc', { length: 1, 0: { value: 'a' } }]) {
      const options = normalizeLabeledOptions(value, 5, 10);
      expect(options.length, String(value)).to.equal(0);
      expect(Object.isFrozen(options)).to.equal(true);
    }
  });

  it('keeps the first of duplicate values, skips blank values and non-records, and bounds count and text', () => {
    const options = normalizeLabeledOptions([
      { value: 'a', label: 'Alpha' },
      { value: 'a', label: 'Duplicate' },
      { value: '   ', label: 'Blank' },
      null,
      'text',
      ['array'],
      { value: 'b' },
      { value: 'c', label: 'Gamma label that is far too long' },
      { value: 'd', label: 'Beyond the count bound' },
    ], 8, 8);
    expect(options).to.deep.equal([{ value: 'a', label: 'Alpha' }, { value: 'b' }, { value: 'c', label: 'Gamma la' }]);
    expect(Object.isFrozen(options)).to.equal(true);
    expect(options.every((option) => Object.isFrozen(option))).to.equal(true);
  });

  it('reads only own data properties and never runs an accessor', () => {
    let reads = 0;
    const accessor = Object.defineProperty({ label: 'Hidden' }, 'value', { enumerable: true, get() { reads += 1; return 'x'; } });
    const labelAccessor = Object.defineProperty({ value: 'kept' }, 'label', { enumerable: true, get() { reads += 1; return 'Label'; } });
    const options = normalizeLabeledOptions([accessor, labelAccessor, Object.create({ value: 'inherited' })], 5, 10);
    expect(options).to.deep.equal([{ value: 'kept' }]);
    expect(reads).to.equal(0);
  });
});
