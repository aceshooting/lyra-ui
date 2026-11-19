import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { prepareChartModel } from './chart-prepared-data.js';
import { prepareSparklineSeries } from './chart-prepared-series.js';

it('admits the same bounded series for a sparkline and a chart without gap separators', () => {
  fc.assert(fc.property(fc.array(fc.integer(), { maxLength: 40 }), values => {
    const count = values.length;
    const series = {
      id: 's', label: 'Signal', counts: { sourceCount: count, validCount: count, invalidCount: 0 },
      xDomain: count ? { min: 0, max: count - 1 } : null,
      yDomain: count ? { min: Math.min(...values), max: Math.max(...values) } : null,
      samples: values.map((y, x) => ({ x, y, sourceIndex: x, breakBefore: x % 2 === 0 })),
    };
    const input = { kind: 'series', revision: 1, series: [series], getPoint: () => null };
    expect(prepareSparklineSeries(input, 40)).to.deep.equal(prepareChartModel(input, 'bar', 42).series[0]);
    if (count > 0) expect(() => prepareSparklineSeries(input, count - 1)).to.throw(RangeError);
  }), propertyRuns());
});
