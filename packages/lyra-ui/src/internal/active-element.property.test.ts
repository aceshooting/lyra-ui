import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { isUsableActiveElement } from './active-element.js';

it('never accepts plain provider data as a genuine focused element', () => {
  const lookalike = fc.record({ nodeType: fc.constant(1), ownerDocument: fc.constant(null), tagName: fc.string() });
  fc.assert(fc.property(fc.oneof(fc.jsonValue(), lookalike), value => {
    expect(isUsableActiveElement(value)).to.equal(false);
  }), propertyRuns());
});
