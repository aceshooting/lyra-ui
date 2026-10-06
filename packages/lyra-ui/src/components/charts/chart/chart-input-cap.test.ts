import { expect } from '@open-wc/testing';
import './line-chart.js';
import './histogram.js';
import './lite-chart.js';
import './box-plot.js';
import type { LyraChart } from './chart.class.js';
import type { LyraHistogram } from './histogram.class.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';

const CAP = 10_000;
const range = (length: number, value: (index: number) => number = (index) => index): number[] =>
  Array.from({ length }, (_, index) => value(index));
const labelsOf = (length: number): string[] => Array.from({ length }, (_, index) => `t${index}`);
const lastCsvLine = (csv: string): string | undefined => csv.split('\r\n').filter(Boolean).at(-1);

interface BuiltConfig {
  data: { labels: unknown[]; datasets: { data: unknown[] }[] };
}

/** Runs `body` with `key`'s page-wide dedupe cleared, returning the dev warnings it printed. */
function captureDevWarnings(key: string, body: () => void): string[] {
  const issued = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  issued?.delete(key);
  const original = console.warn;
  const messages: string[] = [];
  console.warn = (...args: unknown[]) => { messages.push(args.map(String).join(' ')); };
  try {
    body();
  } finally {
    console.warn = original;
    expectDevWarning(key);
  }
  return messages;
}

describe('chart streaming past the 10,000-entry input cap', () => {
  it('lr-line-chart appendData keeps a rolling window of the newest 10,000 categories', () => {
    const el = document.createElement('lr-line-chart') as LyraChart;
    el.labels = labelsOf(CAP);
    el.datasets = [{ label: 'CPU', data: range(CAP, () => 1) }];
    for (let index = 0; index < 100; index += 1) el.appendData(`n${index}`, [100 + index]);

    expect(el.labels.length).to.equal(CAP);
    expect(el.labels[0]).to.equal('t100');
    expect(el.labels.at(-1)).to.equal('n99');
    const data = el.datasets[0]!.data!;
    expect(data.length).to.equal(CAP);
    expect(data.filter((value) => value !== null && value >= 100).length).to.equal(100);
    const config = (el as unknown as { buildConfig(): BuiltConfig }).buildConfig();
    expect(config.data.labels.at(-1)).to.equal('n99');
    expect(config.data.datasets[0]!.data.at(-1)).to.equal(199);
    expect(lastCsvLine(el.exportData('csv'))).to.equal('n99,199');
  });

  it('lr-line-chart appendData clamps a maxPoints above the cap to the cap', () => {
    const el = document.createElement('lr-line-chart') as LyraChart;
    el.labels = labelsOf(CAP);
    el.datasets = [{ label: 'CPU', data: range(CAP, () => 1) }];
    el.appendData('new', [42], 50_000);
    expect(el.labels.length).to.equal(CAP);
    expect(el.datasets[0]!.data!.length).to.equal(CAP);
    expect(lastCsvLine(el.exportData('csv'))).to.equal('new,42');
  });

  it('lr-chart keeps the first 10,000 entries of a directly assigned longer array and says so', () => {
    const messages = captureDevWarnings('lr-chart-input-cap', () => {
      const el = document.createElement('lr-line-chart') as LyraChart;
      el.labels = labelsOf(CAP + 5);
      el.datasets = [{ label: 'CPU', data: range(CAP + 5) }];
      expect(lastCsvLine(el.exportData('csv'))).to.equal(`t${CAP - 1},${CAP - 1}`);
    });
    expect(messages.length).to.equal(1);
    expect(messages[0]).to.contain('10,000');
  });

  it('lr-histogram appendSamples keeps the newest 10,000 samples', () => {
    const el = document.createElement('lr-histogram') as LyraHistogram;
    el.values = range(CAP, () => 1);
    el.appendSamples([1000, 1000, 1000]);
    expect(el.values.length).to.equal(CAP);
    expect(el.values.at(-1)).to.equal(1000);
    expect(el.values.filter((value) => value === 1000).length).to.equal(3);
    el.appendSamples([2000], 50_000);
    expect(el.values.length).to.equal(CAP);
    expect(el.values.at(-1)).to.equal(2000);
  });

  it('lr-histogram keeps the newest 10,000 samples of a longer assigned array', () => {
    expectDevWarning(collectionTruncationWarningKey('lr-histogram', 'values'));
    const el = document.createElement('lr-histogram') as LyraHistogram;
    el.values = range(CAP + 2_000);
    expect(el.values.length).to.equal(CAP);
    expect(el.values[0]).to.equal(2_000);
    expect(el.values.at(-1)).to.equal(CAP + 1_999);
  });

  it('lr-lite-chart appendData on a 10,000-point series keeps the series and the newest point', () => {
    const el = document.createElement('lr-lite-chart') as LyraLiteChart;
    el.labels = labelsOf(CAP);
    el.datasets = [{ label: 'CPU', data: range(CAP, () => 1) }];
    el.appendData('new', [42]);
    expect(el.datasets.length).to.equal(1);
    expect(el.labels.length).to.equal(CAP);
    expect(el.labels.at(-1)).to.equal('new');
    expect(el.datasets[0]!.data.length).to.equal(CAP);
    expect(el.datasets[0]!.data.at(-1)).to.equal(42);
    expect(lastCsvLine(el.exportData('csv'))).to.equal('new,42');
  });

  it('lr-lite-chart streaming several long series never drops a series', () => {
    expectDevWarning('lr-chart-series-cap');
    const el = document.createElement('lr-lite-chart') as LyraLiteChart;
    const length = 9_990;
    el.labels = labelsOf(length);
    el.datasets = range(5).map((series) => ({ label: `S${series}`, data: range(length, () => series) }));
    expect(el.datasets.length).to.equal(5);
    for (let index = 0; index < 20; index += 1) el.appendData(`n${index}`, [1, 2, 3, 4, 5]);
    expect(el.datasets.map((series) => series.label)).to.deep.equal(['S0', 'S1', 'S2', 'S3', 'S4']);
    const lengths = new Set(el.datasets.map((series) => series.data.length));
    expect(lengths.size).to.equal(1);
    expect(el.labels.length).to.equal(el.datasets[0]!.data.length);
    expect(el.labels.at(-1)).to.equal('n19');
    expect(el.datasets.map((series) => series.data.at(-1))).to.deep.equal([1, 2, 3, 4, 5]);
  });
});

describe('chart series longer than the snapshot bound', () => {
  it('lr-lite-chart keeps the first 10,000 values of a longer series instead of dropping it', () => {
    const messages = captureDevWarnings('lr-chart-series-cap', () => {
      const el = document.createElement('lr-lite-chart') as LyraLiteChart;
      el.datasets = [{ label: 'CPU', data: range(CAP + 1) }];
      expect(el.datasets.length).to.equal(1);
      expect(el.datasets[0]!.data.length).to.equal(CAP);
      expect(el.datasets[0]!.data.at(-1)).to.equal(CAP - 1);
      expect(Object.isFrozen(el.datasets[0]!.data)).to.equal(true);
    });
    expect(messages.length).to.equal(1);
  });

  it('lr-lite-chart keeps the series after an over-long one', () => {
    expectDevWarning('lr-chart-series-cap');
    const el = document.createElement('lr-lite-chart') as LyraLiteChart;
    el.datasets = [
      { label: 'A', data: [1, 2, 3] },
      { label: 'B', data: range(CAP + 1, () => 1) },
      { label: 'C', data: [4, 5, 6] },
    ];
    expect(el.datasets.map((series) => series.label)).to.deep.equal(['A', 'B', 'C']);
    expect(el.datasets[2]!.data).to.deep.equal([4, 5, 6]);
  });

  it('lr-lite-chart keeps all five of five 10,000-value series', () => {
    expectDevWarning('lr-chart-series-cap');
    const el = document.createElement('lr-lite-chart') as LyraLiteChart;
    el.datasets = range(5).map((series) => ({ label: `S${series}`, data: range(CAP, () => series) }));
    expect(el.datasets.map((series) => series.label)).to.deep.equal(['S0', 'S1', 'S2', 'S3', 'S4']);
    expect(el.datasets.every((series) => series.data.length === 9_000)).to.equal(true);
  });

  it('lr-lite-chart ignores a same-reference datasets rebind', () => {
    const el = document.createElement('lr-lite-chart') as LyraLiteChart;
    const source = [{ label: 'A', data: [1, 2, 3] }];
    el.datasets = source;
    const snapshot = el.datasets;
    el.datasets = source;
    expect(el.datasets === snapshot).to.equal(true);
    el.datasets = snapshot;
    expect(el.datasets === snapshot).to.equal(true);
  });

  it('lr-box-plot keeps both of two 5,000-box series', () => {
    expectDevWarning('lr-chart-series-cap');
    const el = document.createElement('lr-box-plot') as LyraBoxPlot;
    const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    el.datasets = [
      { label: 'A', data: range(5_000).map(() => ({ ...box })) },
      { label: 'B', data: range(5_000).map(() => ({ ...box })) },
    ];
    expect(el.datasets.map((series) => series.label)).to.deep.equal(['A', 'B']);
    expect(el.datasets.every((series) => series.data.length > 0)).to.equal(true);
  });
});
