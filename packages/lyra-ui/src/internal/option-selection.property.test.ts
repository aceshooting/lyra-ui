import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { isOptionElement, normalizeSelectionValues } from './option-selection.js';

it('normalizeSelectionValues keeps every string member, including empty strings and duplicates, in order', () => {
  const member = fc.oneof(fc.string({ maxLength: 4 }), fc.constant(''), fc.integer(), fc.constant(null), fc.constant(undefined));
  fc.assert(fc.property(fc.array(member, { maxLength: 10 }), (values) => {
    const expected = values.filter((value): value is string => typeof value === 'string');
    expect(normalizeSelectionValues(values as string[])).to.deep.equal(expected);
  }), propertyRuns());
  fc.assert(fc.property(fc.string({ maxLength: 6 }), (value) => {
    expect(normalizeSelectionValues(value)).to.deep.equal([value]);
  }), propertyRuns());
  expect(normalizeSelectionValues(null)).to.deep.equal([]);
  expect(normalizeSelectionValues(undefined)).to.deep.equal([]);
});

it('isOptionElement accepts only an option element under the active tag prefix', () => {
  expect(isOptionElement(document.createElement('lr-option'))).to.equal(true);
  expect(isOptionElement(document.createElement('option'))).to.equal(false);
  expect(isOptionElement(document.createElement('lr-select'))).to.equal(false);
  expect(isOptionElement({ localName: 'lr-option' })).to.equal(false);
  expect(isOptionElement(null)).to.equal(false);
});
