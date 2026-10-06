import { expect } from '@open-wc/testing';
import './box-plot.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import type { LyraChartFormatterContext } from './chart.class.js';

type TooltipLabel = (context: {
  raw: unknown;
  datasetIndex: number;
  dataIndex: number;
  dataset: { label: string };
}) => string[] | undefined;

const box = (offset: number) => ({ min: offset, q1: offset + 1, median: offset + 2, q3: offset + 3, max: offset + 4 });

function tooltipLabel(el: LyraBoxPlot): TooltipLabel {
  return (el as unknown as {
    buildConfig(): { options: { plugins: { tooltip: { callbacks: { label: TooltipLabel } } } } };
  }).buildConfig().options.plugins.tooltip.callbacks.label;
}

describe('lr-box-plot formatted tooltip', () => {
  it('reports the source indexes of a sampled box to the formatter for all five statistics', () => {
    const el = document.createElement('lr-box-plot') as LyraBoxPlot;
    const seen: LyraChartFormatterContext[] = [];
    el.formatter = (context) => {
      seen.push(context);
      return `${context.value} ms`;
    };
    el.labels = Array.from({ length: 1_500 }, (_, index) => `c${index}`);
    el.datasets = [{ label: 'A', data: Array.from({ length: 1_500 }, (_, index) => box(index)) }];
    const text = tooltipLabel(el)({ raw: box(1_499), datasetIndex: 0, dataIndex: 999, dataset: { label: 'A' } });
    expect(seen.map((context) => [context.statistic, context.datasetIndex, context.index, context.label]))
      .to.deep.equal(['min', 'q1', 'median', 'q3', 'max'].map((statistic) => [statistic, 0, 1_499, 'c1499']));
    expect(text).to.deep.equal(['A', 'Min: 1499 ms', 'Q1: 1500 ms', 'Median: 1501 ms', 'Q3: 1502 ms', 'Max: 1503 ms']);
  });
});
