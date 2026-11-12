import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { resolveLocalizedParts } from './localization-runtime.js';

it('preserves arbitrary UTF-16 text around repeated rich localized values', () => {
  const text = fc.array(fc.integer({ min: 0, max: 0xffff }), { maxLength: 200 })
    .map(units => units.map(unit => String.fromCharCode(unit)).join(''));
  fc.assert(fc.property(text, text, text, (prefix, middle, suffix) => {
    const template = `${prefix}{value}${middle}{value}${suffix}`;
    const result = resolveLocalizedParts(template, marker => `${prefix}${marker}${middle}${marker}${suffix}`);
    expect(result).to.deep.equal([prefix, middle, suffix]);
  }), propertyRuns());
});
