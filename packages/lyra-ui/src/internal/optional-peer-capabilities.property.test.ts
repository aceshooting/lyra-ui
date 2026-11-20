import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { hasPeerMethods } from './optional-peer-capabilities.js';

const names = fc.uniqueArray(fc.constantFrom('parse', 'create', 'sanitize', 'render'), { minLength: 1, maxLength: 4 });
const member = fc.oneof(fc.constant(() => undefined), fc.anything());

it('accepts exactly the objects and functions whose every named member is callable', () => {
  fc.assert(fc.property(names, fc.dictionary(fc.constantFrom('parse', 'create', 'sanitize', 'render'), member),
    fc.boolean(), (required, members, asFunction) => {
      const candidate: object = asFunction ? Object.assign(() => undefined, members) : { ...members };
      const expected = required.every((name) => typeof (members as Record<string, unknown>)[name] === 'function');
      expect(hasPeerMethods(candidate, ...required)).to.equal(expected);
    }), propertyRuns());
});

it('rejects every primitive, whatever members it inherits', () => {
  fc.assert(fc.property(names, fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null),
    fc.constant(undefined), fc.bigInt()), (required, value) => {
    expect(hasPeerMethods(value, ...required)).to.equal(false);
  }), propertyRuns());
});
