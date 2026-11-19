import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { contrastRatio, relativeLuminance } from './color-math.js';

const rgb = fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }));

describe('color-math properties', () => {
  it('luminance is within 0..1 and contrast is symmetric within 1..21', () => {
    fc.assert(
      fc.property(rgb, rgb, (a, b) => {
        const l = relativeLuminance(a);
        expect(l >= 0 && l <= 1 + 1e-12).to.equal(true);
        const c = contrastRatio(a, b);
        expect(c).to.equal(contrastRatio(b, a));
        expect(c >= 1 && c <= 21 + 1e-9).to.equal(true);
      }),
      propertyRuns(),
    );
  });
});
