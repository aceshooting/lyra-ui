import { expect } from '@open-wc/testing';
import './line-chart.js';
import type { LyraChart, LyraChartSeries } from './chart.class.js';
import { sampleChartTableIndexes } from './chart-table-sampling.js';

interface DataProjection {
  labels: unknown[];
  datasets: { data: unknown[] }[];
}

interface PreparationProbe {
  canonicalLabels(): readonly string[];
  effectiveData(): DataProjection;
  chartDescription(): string;
  buildConfig(): { data: DataProjection };
  seriesToDataset(
    series: LyraChartSeries,
    index: number,
    palette: string[],
    type: 'line',
    style: undefined,
    indexes: readonly number[],
  ): { data: unknown[] };
}

function descriptorReads(body: () => void): number {
  const original = Object.getOwnPropertyDescriptor;
  let reads = 0;
  Object.getOwnPropertyDescriptor = ((target: object, key: PropertyKey) => {
    reads += 1;
    return original(target, key);
  }) as typeof Object.getOwnPropertyDescriptor;
  try {
    body();
  } finally {
    Object.getOwnPropertyDescriptor = original;
  }
  return reads;
}

it('prepares sampled numeric values in proportion to the plotted records', () => {
  const chart = document.createElement('lr-line-chart') as LyraChart;
  const data = Array.from({ length: 10_000 }, (_, index) => 1_000_000 + index);
  chart.datasets = [{ label: 'Values', data }];
  const indexes = sampleChartTableIndexes(data.length, 1).rowIndexes;
  const original = Number.isFinite;
  let valueChecks = 0;
  let projected: unknown[] = [];
  Number.isFinite = (value: unknown): boolean => {
    if (typeof value === 'number' && value >= 1_000_000) valueChecks += 1;
    return original(value);
  };
  try {
    projected = (chart as unknown as PreparationProbe)
      .seriesToDataset(chart.datasets[0]!, 0, ['red'], 'line', undefined, indexes).data;
  } finally {
    Number.isFinite = original;
  }
  expect(projected).to.deep.equal(indexes.map((index) => data[index]));
  expect(valueChecks, 'only plotted values need visual normalization').to.be.at.most(indexes.length);
});

it('prepares sampled points without inspecting every retained point again', () => {
  const chart = document.createElement('lr-line-chart') as LyraChart;
  const points = Array.from({ length: 10_000 }, (_, index) => ({ x: index, y: index + 1 }));
  chart.datasets = [{ label: 'Points', points }];
  const indexes = sampleChartTableIndexes(points.length, 1).rowIndexes;
  let projected: unknown[] = [];
  const reads = descriptorReads(() => {
    projected = (chart as unknown as PreparationProbe)
      .seriesToDataset(chart.datasets[0]!, 0, ['red'], 'line', undefined, indexes).data;
  });
  expect(projected).to.deep.equal(indexes.map((index) => points[index]));
  expect(reads, 'visual projection work follows the sampled point count').to.be.lessThan(15_000);
});

it('reuses admitted simplified values in the complete semantic model', () => {
  const chart = document.createElement('lr-line-chart') as LyraChart;
  chart.labels = Array.from({ length: 10_000 }, (_, index) => `Category ${index}`);
  const source = Array.from({ length: 10_000 }, (_, index) => index + 1);
  source[1] = -500;
  chart.datasets = [{ label: 'Values', data: source }];
  const probe = chart as unknown as PreparationProbe;
  probe.canonicalLabels();
  source[1] = -100;
  let projected: DataProjection | undefined;
  const reads = descriptorReads(() => { projected = probe.effectiveData(); });
  expect(projected?.labels.length).to.equal(10_000);
  expect(projected?.datasets[0]?.data.length).to.equal(10_000);
  expect(projected?.datasets[0]?.data[1]).to.equal(-500);
  expect(projected?.datasets[0]?.data.at(-1)).to.equal(10_000);
  expect(Object.isFrozen(projected?.datasets[0]?.data)).to.equal(true);
  expect(probe.chartDescription()).to.contain('-500');
  const peerConfig = probe.buildConfig();
  peerConfig.data.datasets[0]!.data[0] = -999;
  expect(probe.effectiveData().datasets[0]!.data[0]).to.equal(1);
  expect(chart.exportData('csv')).to.contain('Category 1,-500');
  expect(chart.exportData('csv').split('\r\n').filter(Boolean).at(-1)).to.equal('Category 9999,10000');
  expect(reads, 'safe admitted numeric data does not need descriptor reprojection').to.be.lessThan(1_000);
});

it('preserves sampled gaps and non-finite values without changing retained data or source indexes', () => {
  const chart = document.createElement('lr-line-chart') as LyraChart;
  const data: (number | null)[] = Array.from({ length: 10_000 }, (_, index) => index);
  const indexes = sampleChartTableIndexes(data.length, 1).rowIndexes;
  data[indexes[1]!] = null;
  data[indexes[2]!] = Number.NaN;
  data[indexes[3]!] = Number.POSITIVE_INFINITY;
  delete data[indexes[4]!];
  chart.labels = Array.from({ length: data.length }, (_, index) => `Category ${index}`);
  chart.datasets = [{ label: 'Values', data }];
  const config = (chart as unknown as PreparationProbe).buildConfig();
  const retainedIndexes = config.data.labels.map(label => Number(String(label).slice('Category '.length)));
  expect(retainedIndexes[0]).to.equal(0);
  expect(retainedIndexes.at(-1)).to.equal(9999);
  expect(retainedIndexes.length).to.be.at.most(1000);
  expect(config.data.datasets[0]!.data).to.deep.equal(retainedIndexes.map((index) =>
    typeof data[index] === 'number' && Number.isFinite(data[index]) ? data[index] : null,
  ));
  expect(config.data.datasets[0]!.data).to.include(null);
  expect(chart.datasets[0]!.data?.length).to.equal(10_000);
  expect(chart.exportData('csv').split('\r\n').filter(Boolean).at(-1)).to.equal('Category 9999,9999');
});
