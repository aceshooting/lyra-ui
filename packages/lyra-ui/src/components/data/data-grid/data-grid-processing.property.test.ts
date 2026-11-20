import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { filterRows, pathValue, searchRows, sortRows } from './data-grid-processing.js';
import type { DataGridColumn } from './data-grid-types.js';

interface Row {
  readonly id: number;
  readonly name: string;
  readonly score: number | undefined;
}

const columns: DataGridColumn<Row>[] = [
  { id: 'name', field: 'name' },
  { id: 'score', field: 'score', sortFn: 'basic' },
];
const row = fc.record({
  name: fc.string({ maxLength: 6 }),
  score: fc.oneof(fc.integer({ min: -20, max: 20 }), fc.constant(undefined)),
});
const rows = fc
  .array(row, { maxLength: 40 })
  .map((list): Row[] => list.map((entry, id) => ({ id, ...entry })));
const ids = (list: readonly Row[]): number[] => list.map((entry) => entry.id);

describe('data grid processing properties', () => {
  it('sorts into a permutation of the input and leaves the input untouched', () => {
    fc.assert(fc.property(rows, fc.boolean(), (list, desc) => {
      const before = ids(list);
      const sorted = sortRows(list, columns, [{ id: 'score', desc }], 'en');
      expect(ids(list), 'input untouched').to.deep.equal(before);
      expect(ids(sorted).sort((a, b) => a - b), 'permutation').to.deep.equal([...before].sort((a, b) => a - b));
    }), propertyRuns());
  });

  it('orders by the sort key and keeps ties in source order', () => {
    fc.assert(fc.property(rows, (list) => {
      const sorted = sortRows(list, columns, [{ id: 'score', desc: false }], 'en');
      const scored = sorted.filter((entry) => entry.score !== undefined);
      for (let index = 1; index < scored.length; index++) {
        const previous = scored[index - 1]!;
        const current = scored[index]!;
        expect(previous.score! <= current.score!, 'ascending').to.equal(true);
        if (previous.score === current.score) expect(previous.id < current.id, 'stable ties').to.equal(true);
      }
    }), propertyRuns());
  });

  it('descending order is the reverse key order of ascending', () => {
    fc.assert(fc.property(rows, (list) => {
      const keys = (desc: boolean): Array<number | undefined> =>
        sortRows(list, columns, [{ id: 'score', desc }], 'en').filter((entry) => entry.score !== undefined).map((entry) => entry.score);
      expect(keys(true)).to.deep.equal([...keys(false)].reverse());
    }), propertyRuns());
  });

  it('filters and searches to an order-preserving subset', () => {
    fc.assert(fc.property(rows, fc.string({ maxLength: 3 }), (list, needle) => {
      const subsetOf = (result: readonly Row[]): boolean => {
        let cursor = 0;
        return result.every((entry) => {
          while (cursor < list.length && list[cursor] !== entry) cursor++;
          return cursor++ < list.length;
        });
      };
      expect(subsetOf(filterRows(list, columns, [{ id: 'name', value: needle }], 'en')), 'filter subset in order').to.equal(true);
      expect(subsetOf(searchRows(list, columns, needle, 'en', null)), 'search subset in order').to.equal(true);
      expect(ids(filterRows(list, columns, [], 'en')), 'no filters keep every row').to.deep.equal(ids(list));
    }), propertyRuns());
  });

  it('reads a nested value through a dotted path and yields undefined for a missing one', () => {
    fc.assert(fc.property(fc.jsonValue(), (value) => {
      expect(pathValue({ a: { b: value } }, 'a.b')).to.deep.equal(value);
      expect(pathValue({ a: { b: value } }, 'a.missing.b')).to.equal(undefined);
      expect(pathValue(value, '')).to.equal(undefined);
    }), propertyRuns());
  });
});
