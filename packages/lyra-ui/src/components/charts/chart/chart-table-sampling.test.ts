import { expect } from '@open-wc/testing';
import { sampleChartTableIndexes } from './chart-table-sampling.js';

function expectWithinCellBudget(
  sample: ReturnType<typeof sampleChartTableIndexes>,
): void {
  if (sample.seriesIndexes.length === 0) return;
  expect(sample.rowIndexes.length).to.be.at.most(
    Math.floor(1_000 / sample.seriesIndexes.length),
  );
}

it('retains every source index when the table fits the rendering budget', () => {
  const sample = sampleChartTableIndexes(5, 3);

  expect(sample.rowIndexes).to.deep.equal([0, 1, 2, 3, 4]);
  expect(sample.seriesIndexes).to.deep.equal([0, 1, 2]);
  expectWithinCellBudget(sample);
});

it('samples both axes deterministically with their endpoints intact', () => {
  const first = sampleChartTableIndexes(10_000, 10_000);
  const second = sampleChartTableIndexes(10_000, 10_000);

  expect(first.rowIndexes).to.deep.equal(second.rowIndexes);
  expect(first.seriesIndexes).to.deep.equal(second.seriesIndexes);
  expect(first.rowIndexes[0]).to.equal(0);
  expect(first.rowIndexes.at(-1)).to.equal(9_999);
  expect(first.seriesIndexes[0]).to.equal(0);
  expect(first.seriesIndexes.at(-1)).to.equal(9_999);
  expect(first.rowIndexes.length).to.be.greaterThan(2);
  expect(first.seriesIndexes.length).to.be.greaterThan(2);
  expectWithinCellBudget(first);
});

it('uses the budget along the large axis without dropping a small nontrivial axis', () => {
  const tall = sampleChartTableIndexes(10_000, 2);
  const wide = sampleChartTableIndexes(2, 10_000);

  expect(tall.seriesIndexes).to.deep.equal([0, 1]);
  expect(tall.rowIndexes).to.have.length(500);
  expect(tall.rowIndexes[0]).to.equal(0);
  expect(tall.rowIndexes.at(-1)).to.equal(9_999);
  expectWithinCellBudget(tall);

  expect(wide.rowIndexes).to.deep.equal([0, 1]);
  expect(wide.seriesIndexes).to.have.length(500);
  expect(wide.seriesIndexes[0]).to.equal(0);
  expect(wide.seriesIndexes.at(-1)).to.equal(9_999);
  expectWithinCellBudget(wide);
});

it('retains endpoints on a nonempty axis even when the other axis is empty', () => {
  const rowsOnly = sampleChartTableIndexes(10_000, 0);
  const seriesOnly = sampleChartTableIndexes(0, 10_000);

  expect(rowsOnly.rowIndexes).to.have.length(1_000);
  expect(rowsOnly.rowIndexes[0]).to.equal(0);
  expect(rowsOnly.rowIndexes.at(-1)).to.equal(9_999);
  expect(rowsOnly.seriesIndexes).to.deep.equal([]);

  expect(seriesOnly.rowIndexes).to.deep.equal([]);
  expect(seriesOnly.seriesIndexes).to.have.length(1_000);
  expect(seriesOnly.seriesIndexes[0]).to.equal(0);
  expect(seriesOnly.seriesIndexes.at(-1)).to.equal(9_999);
});

it('normalizes non-finite counts and handles enormous source dimensions without overflow', () => {
  expect(sampleChartTableIndexes(Number.NaN, Number.POSITIVE_INFINITY)).to.deep.equal({
    rowIndexes: [],
    seriesIndexes: [],
  });

  const sample = sampleChartTableIndexes(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  expect(sample.rowIndexes[0]).to.equal(0);
  expect(sample.rowIndexes.at(-1)).to.equal(Number.MAX_SAFE_INTEGER - 1);
  expect(sample.seriesIndexes[0]).to.equal(0);
  expect(sample.seriesIndexes.at(-1)).to.equal(Number.MAX_SAFE_INTEGER - 1);
  expectWithinCellBudget(sample);
});
