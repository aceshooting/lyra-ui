import { expect } from '@open-wc/testing';
import { MAX_NODES, safeValue } from './map-style-value.js';

describe('map style value snapshots', () => {
  it('snapshots bounded plain data with a stable key and its measured cost', () => {
    const input = { 'line-color': ['match', ['get', 'kind'], 'road', '#f00', '#000'], width: 2, dashed: false, empty: null };
    const result = safeValue(input);
    expect(result?.value).to.deep.equal(input);
    expect(result?.key).to.equal(JSON.stringify(input));
    expect(result?.nodes).to.equal(12);
    expect(result?.text).to.equal('line-color'.length + 'match'.length + 'get'.length + 'kind'.length + 'road'.length + 8 + 'width'.length + 'dashed'.length + 'empty'.length);
    expect(safeValue(undefined, true)).to.deep.equal({ value: undefined, key: 'undefined', nodes: 1, text: 0 });
  });

  it('rejects non-plain objects, non-finite numbers, oversized strings and node budgets', () => {
    for (const value of [new Date(0), { at: new (class Point { x = 1; })() }, [Number.NaN], { label: 'x'.repeat(4097) }, undefined]) {
      expect(safeValue(value)?.key, String(value)).to.equal(undefined);
    }
    const wide = (count: number) => Array.from({ length: 32 }, () => Array.from({ length: count }, () => 0));
    expect(safeValue(wide(254))?.nodes).to.equal(1 + 32 * 255);
    expect(1 + 32 * 256).to.be.greaterThan(MAX_NODES);
    expect(safeValue(wide(255))).to.equal(undefined);
  });
});
