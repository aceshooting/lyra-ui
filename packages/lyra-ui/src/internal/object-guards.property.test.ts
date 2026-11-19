import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { isConstructor, isRuntimeArray } from './object-guards.js';

it('isRuntimeArray agrees with Array.isArray for every ordinary value', () => {
  fc.assert(fc.property(fc.anything(), (value) => {
    expect(isRuntimeArray(value)).to.equal(Array.isArray(value));
  }), propertyRuns());
});

it('isConstructor never accepts a value that is not a function', () => {
  fc.assert(fc.property(fc.anything().filter((value) => typeof value !== 'function'), (value) => {
    expect(isConstructor(value)).to.equal(false);
  }), propertyRuns());
});
