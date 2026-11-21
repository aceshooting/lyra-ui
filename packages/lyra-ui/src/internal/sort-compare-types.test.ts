import { expect } from '@open-wc/testing';
import { compareNullable } from './sort-compare.js';

describe('sort-compare typed values', () => {
  it('orders bigints in both directions and treats equal ones as tied', () => {
    expect(compareNullable(1n, 2n, 1, 'en')).to.equal(-1);
    expect(compareNullable(1n, 2n, -1, 'en')).to.equal(1);
    expect(compareNullable(3n, 3n, 1, 'en')).to.equal(0);
  });

  it('orders dates and sorts invalid dates last', () => {
    const early = new Date(1000);
    const late = new Date(2000);
    expect(compareNullable(early, late, 1, 'en')).to.equal(-1);
    expect(compareNullable(early, late, -1, 'en')).to.equal(1);
    expect(compareNullable(early, new Date(1000), 1, 'en')).to.equal(0);
    expect(compareNullable(new Date(NaN), early, 1, 'en')).to.equal(1);
    expect(compareNullable(early, new Date(NaN), 1, 'en')).to.equal(-1);
    expect(compareNullable(new Date(NaN), new Date(NaN), 1, 'en')).to.equal(0);
  });
});
