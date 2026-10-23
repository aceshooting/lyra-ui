import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { snapshotMapStyle } from './map-style-input.js';

describe('map style font snapshot properties', () => {
  it('keeps bounded font-family names as detached own data on an ordinary record', () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 40 }).filter(name => name.trim().length > 0), name => {
      const face = { url: 'font.woff2' };
      const families = Object.fromEntries([[name, [face]]]);
      const result = snapshotMapStyle({ version: 8, sources: {}, layers: [], 'font-faces': families }) as Record<string, unknown>;
      const admitted = result['font-faces'] as Record<string, unknown>;
      face.url = 'changed.woff2';
      expect(Object.getPrototypeOf(admitted) === Object.prototype).to.equal(true);
      expect(Object.keys(admitted)).to.deep.equal([name]);
      expect(Object.getOwnPropertyDescriptor(admitted, name)?.value).to.deep.equal([{ url: 'font.woff2' }]);
      expect(Object.isFrozen(admitted)).to.equal(true);
    }), propertyRuns());
  });
});
