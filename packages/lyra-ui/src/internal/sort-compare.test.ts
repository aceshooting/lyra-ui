import { expect } from '@open-wc/testing';
import { compareNullable, decorateSort, normalizeSortValue } from './sort-compare.js';

describe('sort-compare', () => {
  it('folds missing values', () => {
    for (const v of [null, undefined, NaN, Infinity]) expect(normalizeSortValue(v)).to.equal(null);
    expect(normalizeSortValue(0)).to.equal(0);
    expect(normalizeSortValue('')).to.equal('');
  });
  it('puts nulls last in both directions', () => {
    expect(compareNullable(null, 1, 1, 'en')).to.equal(1);
    expect(compareNullable(null, 1, -1, 'en')).to.equal(1);
    expect(compareNullable(1, undefined, -1, 'en')).to.equal(-1);
    expect(compareNullable(null, NaN, 1, 'en')).to.equal(0);
  });
  it('orders numbers, mixed types and strings with numeric collation', () => {
    expect(compareNullable(2, 10, 1, 'en')).to.be.lessThan(0);
    expect(compareNullable(2, 10, -1, 'en')).to.be.greaterThan(0);
    expect(compareNullable('item2', 'item10', 1, 'en')).to.be.lessThan(0);
    expect(compareNullable(5, 'abc', 1, 'en')).to.be.lessThan(0);
  });
  it('is locale aware', () => {
    expect(compareNullable('z', 'ä', 1, 'sv')).to.be.lessThan(0);
    expect(compareNullable('z', 'ä', 1, 'de')).to.be.greaterThan(0);
  });
  it('sorts stably without mutating, evaluating the key once per row', () => {
    const rows = [{ k: 3, n: 'a' }, { k: null, n: 'b' }, { k: 1, n: 'c' }, { k: 3, n: 'd' }];
    let calls = 0;
    const sorted = decorateSort(rows, (r) => (calls++, r.k));
    expect(sorted.map((r) => r.n).join('')).to.equal('cadb');
    expect(calls).to.equal(4);
    expect(rows[0]!.n).to.equal('a');
    expect(decorateSort(rows, (r) => r.k, -1).map((r) => r.n).join('')).to.equal('adcb');
  });
});
