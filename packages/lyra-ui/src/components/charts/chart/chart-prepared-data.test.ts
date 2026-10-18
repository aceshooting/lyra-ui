import { expect } from '@open-wc/testing';
import { prepareChartModel, withPreparedPoint } from './chart-prepared-data.js';
import type { LyraPreparedSeriesData } from '../../../utilities/data-preparation.js';

function source(): LyraPreparedSeriesData {
  return { kind: 'series', revision: 'r', series: [{ id: 's', label: 'S', counts: { sourceCount: 1000, validCount: 999, invalidCount: 1 }, xDomain: { min: 0, max: 999 }, yDomain: { min: -5, max: 8 }, samples: [
    { x: 0, y: 1, sourceIndex: 0, breakBefore: true },
    { x: 200, y: -5, sourceIndex: 200, breakBefore: false },
    { x: 800, y: 8, sourceIndex: 800, breakBefore: true },
    { x: 999, y: 2, sourceIndex: 999, breakBefore: false },
  ] }], getPoint: () => null };
}

it('keeps source provenance and explicit gap separators in a bounded immutable model', () => {
  const model = prepareChartModel(source(), 'line', 1000);
  expect(model.series[0]!.samples.map(point => point?.sourceIndex ?? null)).to.deep.equal([0, 200, null, 800, 999]);
  expect(model.validCount).to.equal(999);
  expect(model.peerCount).to.equal(5);
  expect(Object.isFrozen(model.series[0]!.samples)).to.equal(true);
  const overlay = withPreparedPoint(model, { seriesId: 's', sourceIndex: 500 }, { x: 500, y: 3 });
  expect(overlay.series[0]!.samples.at(-1)?.sourceIndex).to.equal(500);
  expect(overlay.validCount).to.equal(999);
});

it('rejects incompatible types, malformed counts and nonfinite samples', () => {
  expect(() => prepareChartModel(source(), 'pie', 1000)).to.throw();
  const invalid = source();
  (invalid.series[0]!.counts as { validCount: number }).validCount = 1001;
  expect(() => prepareChartModel(invalid, 'line', 1000)).to.throw();
  const sample = source();
  (sample.series[0]!.samples[0] as { y: number }).y = Infinity;
  expect(() => prepareChartModel(sample, 'line', 1000)).to.throw();
});

it('charges gap separators, overlays and rectangular multi-series cells to existing budgets', () => {
  expect(() => prepareChartModel(source(), 'line', 6)).to.throw(/budget|capacity/i);
  expect(prepareChartModel(source(), 'line', 7).peerCount).to.equal(5);
  const base = source();
  const many = { ...base, series: Array.from({ length: 150 }, (_, index) => ({ ...base.series[0]!, id: String(index) })) };
  expect(() => prepareChartModel(many, 'line', 1000)).to.throw(/budget|capacity/i);
});

it('rejects sparse/accessor summary arrays without evaluating them', () => {
  const base = source();
  let reads = 0;
  const samples = [...base.series[0]!.samples];
  Object.defineProperty(samples, 0, { get() { reads++; return base.series[0]!.samples[0]; } });
  expect(() => prepareChartModel({ ...base, series: [{ ...base.series[0]!, samples }] }, 'line', 1000)).to.throw();
  expect(reads).to.equal(0);
});

it('rejects aggregate category overflow before copying discarded series values', () => {
  let inspected = 0;
  const values = new Proxy(new Array<number>(1000).fill(1), {
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === 'string' && /^\d+$/u.test(key)) inspected++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const prepared = { kind: 'categories', revision: 'r', counts: { sourceCount: 1000, validCount: 1000, invalidCount: 0 },
    categories: Array.from({ length: 1000 }, (_, index) => ({ id: String(index), label: String(index) })), categoryCounts: new Array<number>(1000).fill(1), aggregation: 'count',
    series: Array.from({ length: 1000 }, (_, index) => ({ id: String(index), label: String(index), values })),
  };
  expect(() => prepareChartModel(prepared, 'bar', 1000)).to.throw(/budget|capacity/i);
  expect(inspected).to.be.at.most(1000);
});
