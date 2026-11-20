import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { MAX_RENDERED_CHART_RECORDS, normalizeChartRecordLimit, sampleChartTableIndexes } from './chart-table-sampling.js';

const dimension = fc.integer({ min: 0, max: 3000 });
const limit = fc.oneof(fc.integer({ min: -5, max: 5000 }), fc.constantFrom(Number.NaN, Infinity, undefined));

const strictlyAscending = (indexes: readonly number[]): boolean =>
  indexes.every((value, position) => position === 0 || value > indexes[position - 1]!);

describe('chart table sampling properties', () => {
  it('clamps any record limit into [2, MAX_RENDERED_CHART_RECORDS]', () => {
    fc.assert(fc.property(limit, (value) => {
      const budget = normalizeChartRecordLimit(value);
      expect(budget >= 2 && budget <= MAX_RENDERED_CHART_RECORDS, String(value)).to.equal(true);
    }), propertyRuns());
  });

  it('selects ordered, in-range indexes inside the record budget and keeps both row endpoints', () => {
    fc.assert(fc.property(dimension, fc.integer({ min: 0, max: 40 }), limit, (rows, series, maxRecords) => {
      const picked = sampleChartTableIndexes(rows, series, { maxRecords: maxRecords as number | undefined });
      expect(strictlyAscending(picked.rowIndexes), 'rows ascending and unique').to.equal(true);
      expect(strictlyAscending(picked.seriesIndexes), 'series ascending and unique').to.equal(true);
      expect(picked.rowIndexes.every((index) => index >= 0 && index < rows)).to.equal(true);
      expect(picked.seriesIndexes.every((index) => index >= 0 && index < series)).to.equal(true);
      expect(picked.rowIndexes.length * picked.seriesIndexes.length <= Math.max(normalizeChartRecordLimit(maxRecords), 0) || rows * series === 0, 'within budget').to.equal(true);
      if (rows > 1 && series > 0) {
        expect(picked.rowIndexes[0], 'first row kept').to.equal(0);
        expect(picked.rowIndexes.at(-1), 'last row kept').to.equal(rows - 1);
      }
    }), propertyRuns());
  });

  it('keeps the global extrema of a numeric accessor when thinning', () => {
    fc.assert(fc.property(fc.array(fc.double({ min: -1000, max: 1000, noNaN: true }), { minLength: 50, maxLength: 400 }), (values) => {
      const picked = sampleChartTableIndexes(values.length, 1, { maxRecords: 20, valueAt: (row) => values[row] });
      expect(strictlyAscending(picked.rowIndexes)).to.equal(true);
      expect(picked.rowIndexes.length <= 20, 'within budget').to.equal(true);
      const kept = picked.rowIndexes.map((row) => values[row]!);
      expect(Math.max(...kept), 'global maximum kept').to.equal(Math.max(...values));
      expect(Math.min(...kept), 'global minimum kept').to.equal(Math.min(...values));
    }), propertyRuns());
  });
});
