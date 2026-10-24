import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { snapshotViewerRows } from './delimited-data.js';
import { LyraResourceLimitError } from './resource-loader.js';

const text = fc.array(fc.constantFrom('a', ' ', 'é', '日', '😀', '\n', '\t'), { maxLength: 12 }).map(parts => parts.join(''));
const scalar = fc.oneof(text, fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined));
const grid = fc.array(fc.array(scalar, { maxLength: 8 }), { maxLength: 6 });

describe('bounded scalar table snapshot properties', () => {
  it('preserves every scalar and accounts for its encoded bytes across independently snapshotted chunks', () => {
    fc.assert(fc.property(grid, fc.nat(), (generated, split) => {
      const bytes = generated.flat().reduce<number>((sum, value) => sum + new TextEncoder().encode(value == null ? '' : String(value)).byteLength, 0);
      const cells = generated.reduce((sum, row) => sum + row.length, 0);
      const input = generated.map(row => [...row]);
      const budget = { cells: 0, bytes: 0 };
      const middle = split % (input.length + 1);
      const first = snapshotViewerRows(input.slice(0, middle), 6, 8, bytes, budget);
      const second = snapshotViewerRows(input.slice(middle), 6, 8, bytes, budget);
      expect([...first, ...second]).to.deep.equal(generated);
      expect(budget).to.deep.equal({ cells, bytes });
      expect(Object.isFrozen(first) && Object.isFrozen(second)).to.equal(true);
      expect([...first, ...second].every(Object.isFrozen)).to.equal(true);
      for (const row of input) row.splice(0);
      expect([...first, ...second]).to.deep.equal(generated);
    }), propertyRuns());
  });

  it('rejects a byte ceiling below the complete encoded payload without mutating caller rows', () => {
    fc.assert(fc.property(grid, generated => {
      const bytes = generated.flat().reduce<number>((sum, value) => sum + new TextEncoder().encode(value == null ? '' : String(value)).byteLength, 0);
      if (bytes === 0) return;
      const input = generated.map(row => [...row]);
      expect(() => snapshotViewerRows(input, 6, 8, bytes - 1)).to.throw(LyraResourceLimitError);
      expect(input).to.deep.equal(generated);
      expect(input.every(row => !Object.isFrozen(row))).to.equal(true);
    }), propertyRuns());
  });
});
