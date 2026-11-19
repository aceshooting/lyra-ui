import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { compareNullable, decorateSort } from './sort-compare.js';

const value = fc.oneof(fc.constant(null), fc.constant(undefined), fc.double(), fc.string({ maxLength: 6 }));

describe('sort-compare properties', () => {
  it('is antisymmetric', () => {
    fc.assert(
      fc.property(value, value, fc.constantFrom<1 | -1>(1, -1), (a, b, dir) => {
        expect(Math.sign(compareNullable(a, b, dir, 'en'))).to.equal(-Math.sign(compareNullable(b, a, dir, 'en')) || 0);
      }),
      propertyRuns(),
    );
  });
  it('decorateSort is a stable permutation with missing values last', () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(fc.constant(null), fc.integer({ min: -5, max: 5 }))), fc.constantFrom<1 | -1>(1, -1), (keys, dir) => {
        const rows = keys.map((k, i) => ({ k, i }));
        const out = decorateSort(rows, (r) => r.k, dir);
        expect(out.length).to.equal(rows.length);
        expect(out.map((r) => r.i).sort((x, y) => x - y)).to.deep.equal(rows.map((r) => r.i));
        const firstNull = out.findIndex((r) => r.k === null);
        if (firstNull >= 0) expect(out.slice(firstNull).every((r) => r.k === null)).to.equal(true);
        for (let i = 1; i < out.length; i++) {
          const p = out[i - 1]!;
          const c = out[i]!;
          if (p.k !== null && c.k !== null) {
            expect((p.k - c.k) * dir <= 0).to.equal(true);
            if (p.k === c.k) expect(p.i < c.i).to.equal(true);
          }
        }
      }),
      propertyRuns(),
    );
  });
});
