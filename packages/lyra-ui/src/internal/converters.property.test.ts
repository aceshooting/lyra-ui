import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { lengthOrNumberConverter } from './converters.js';

const read = (value: string | null) => (lengthOrNumberConverter.fromAttribute as (value: string | null) => unknown)(value);

it('never yields a non-finite number, and keeps any non-numeric text verbatim', () => {
  fc.assert(fc.property(fc.oneof(fc.string(), fc.double().map(String), fc.constantFrom('Infinity', '-Infinity', 'NaN', ' ', '12rem')), (text) => {
    const value = read(text);
    if (text.trim() === '') expect(value).to.equal(null);
    else if (typeof value === 'number') expect(Number.isFinite(value) && value === Number(text)).to.equal(true);
    else expect(value).to.equal(text);
  }), propertyRuns());
});
