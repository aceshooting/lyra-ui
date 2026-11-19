import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { opaqueId } from './opaque-id.js';

describe('opaque-id properties', () => {
  it('always starts with its prefix, is non-empty beyond it and has no whitespace', () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom('a', 'b', '-', ':', '_'), maxLength: 8 }), (prefix) => {
        const id = opaqueId(prefix);
        expect(id.startsWith(prefix) && id.length > prefix.length && !/\s/.test(id)).to.equal(true);
      }),
      propertyRuns(),
    );
  });
});
