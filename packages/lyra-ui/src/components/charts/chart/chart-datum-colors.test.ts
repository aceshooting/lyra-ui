import { expect, fixture, waitUntil } from '@open-wc/testing';
import type { LyraChart, LyraChartSeries } from './chart.class.js';
import './bar-chart.js';
import './line-chart.js';
import './pie-chart.js';
import './doughnut-chart.js';
import './scatter-chart.js';
import './bubble-chart.js';
import './radar-chart.js';
import './polar-area-chart.js';

interface ColorRuntime {
  data: {
    labels: string[];
    datasets: { backgroundColor: unknown; borderColor: unknown; pointBackgroundColor: unknown }[];
  };
  getDatasetMeta(index: number): {
    dataset?: { options: { borderColor: unknown } };
    data: { options: { backgroundColor: string; borderColor: string } }[];
  };
}

function runtime(el: LyraChart): ColorRuntime | undefined {
  return (el as unknown as { chart?: ColorRuntime }).chart;
}

const chartTags = [
  'lr-bar-chart', 'lr-line-chart', 'lr-pie-chart', 'lr-doughnut-chart',
  'lr-scatter-chart', 'lr-bubble-chart', 'lr-radar-chart', 'lr-polar-area-chart',
] as const;
const resolvedColors = ['rgb(57, 65, 255)', 'rgb(217, 119, 87)', 'rgb(115, 115, 115)'];

async function coloredChart(
  chartTag: typeof chartTags[number],
  color: LyraChartSeries['color'],
  maxRecords = 1000,
): Promise<LyraChart> {
  const el = await fixture<LyraChart>(`<${chartTag} without-animation without-legend></${chartTag}>`);
  el.style.setProperty('--datum-second', 'rgb(217, 119, 87)');
  el.labels = ['A', 'B', 'C'];
  el.maxRecords = maxRecords;
  el.datasets = [{
    label: 'Series',
    ...(chartTag === 'lr-scatter-chart' || chartTag === 'lr-bubble-chart'
      ? { points: [{ x: 1, y: 1, r: 4 }, { x: 2, y: 2, r: 5 }, { x: 3, y: 3, r: 6 }] }
      : { data: [1, 2, 3] }),
    color,
  }];
  await el.updateComplete;
  await waitUntil(
    () => runtime(el)?.getDatasetMeta(0).data.length === Math.min(3, maxRecords),
    'chart did not render its data items',
  );
  return el;
}

describe('chart datum colors', () => {
  for (const chartTag of chartTags) {
    it(`${chartTag} matches each rendered border to its resolved datum color`, async () => {
      const el = await coloredChart(chartTag, ['#3941ff', 'var(--datum-second)', '#737373']);
      const chart = runtime(el)!;
      expect(chart.data.datasets[0]!.backgroundColor).to.deep.equal(resolvedColors);
      expect(chart.data.datasets[0]!.borderColor).to.deep.equal(
        chartTag === 'lr-line-chart' || chartTag === 'lr-radar-chart' ? resolvedColors[0] : resolvedColors,
      );
      expect(chart.getDatasetMeta(0).data.map((item) => item.options.backgroundColor)).to.deep.equal(resolvedColors);
      expect(chart.getDatasetMeta(0).data.map((item) => item.options.borderColor)).to.deep.equal(resolvedColors);
      if (chartTag === 'lr-line-chart' || chartTag === 'lr-radar-chart') {
        expect(chart.getDatasetMeta(0).dataset?.options.borderColor).to.equal(resolvedColors[0]);
      }
    });

    it(`${chartTag} returns to a scalar border when an array is replaced by a series color`, async () => {
      const el = await coloredChart(chartTag, resolvedColors);
      el.datasets = [{ ...el.datasets[0]!, color: '#3941ff' }];
      await el.updateComplete;
      const chart = runtime(el)!;
      expect(chart.data.datasets[0]!.borderColor).to.equal(resolvedColors[0]);
      expect(chart.getDatasetMeta(0).data.map((item) => item.options.borderColor)).to.deep.equal(
        Array.from({ length: 3 }, () => resolvedColors[0]),
      );
    });

    it(`${chartTag} preserves repeating color palettes at sampled source indexes`, async () => {
      const el = await fixture<LyraChart>(`<${chartTag} without-animation without-legend></${chartTag}>`);
      const indexes = Array.from({ length: 12 }, (_, index) => index);
      el.maxRecords = 4;
      el.labels = indexes.map(String);
      el.datasets = [{
        label: 'Series',
        ...(chartTag === 'lr-scatter-chart' || chartTag === 'lr-bubble-chart'
          ? { points: indexes.map((index) => ({ x: index, y: index + 1, r: 4 })) }
          : { data: indexes.map((index) => index + 1) }),
        color: resolvedColors,
        pointColors: [...resolvedColors].reverse(),
      }];
      await el.updateComplete;
      await waitUntil(() => runtime(el) !== undefined, 'sampled chart did not initialize');
      const chart = runtime(el)!;
      expect(chart.data.labels.length).to.be.within(2, 4);
      const expectedColors = chart.data.labels.map((label) => resolvedColors[Number(label) % 3]);
      const expectedPointColors = chart.data.labels.map((label) => resolvedColors[2 - Number(label) % 3]);
      expect(chart.data.datasets[0]!.backgroundColor).to.deep.equal(expectedColors);
      expect(chart.data.datasets[0]!.borderColor).to.deep.equal(
        chartTag === 'lr-line-chart' || chartTag === 'lr-radar-chart' ? expectedColors[0] : expectedColors,
      );
      expect(chart.data.datasets[0]!.pointBackgroundColor).to.deep.equal(expectedPointColors);
      expect(chart.getDatasetMeta(0).data.map((item) => item.options.borderColor)).to.deep.equal(expectedColors);
    });
  }

  for (const chartTag of ['lr-bar-chart', 'lr-pie-chart'] as const) {
    for (const maxRecords of [2, 1000]) {
      it(`${chartTag} keeps empty color arrays and default borders with a ${maxRecords}-record budget`, async () => {
        const el = await coloredChart(chartTag, undefined, maxRecords);
        const defaultBorder = runtime(el)!.data.datasets[0]!.borderColor;
        el.datasets = [{ label: 'Series', data: [1, 2, 3], color: [], pointColors: [] }];
        await el.updateComplete;
        const dataset = runtime(el)!.data.datasets[0]!;
        expect(dataset.borderColor).to.deep.equal(defaultBorder);
        expect(dataset.backgroundColor).to.deep.equal([]);
        expect(dataset.pointBackgroundColor).to.deep.equal([]);
      });
    }
  }

  for (const chartTag of ['lr-line-chart', 'lr-radar-chart'] as const) {
    it(`${chartTag} keeps each connected stroke on its first color across multiple series`, async () => {
      const el = await coloredChart(chartTag, resolvedColors);
      el.datasets = [
        { label: 'First', data: [1, 2, 3], color: resolvedColors },
        { label: 'Second', data: [3, 2, 1], color: [...resolvedColors].reverse() },
      ];
      await el.updateComplete;
      const chart = runtime(el)!;
      expect(chart.getDatasetMeta(0).dataset?.options.borderColor).to.equal(resolvedColors[0]);
      expect(chart.getDatasetMeta(1).dataset?.options.borderColor).to.equal(resolvedColors[2]);
      expect(chart.getDatasetMeta(1).data.map((item) => item.options.borderColor)).to.deep.equal(
        [...resolvedColors].reverse(),
      );
    });

  }
});
