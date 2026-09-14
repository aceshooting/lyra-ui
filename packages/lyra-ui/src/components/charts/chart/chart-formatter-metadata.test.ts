import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import { sampleChartTableIndexes } from './chart-table-sampling.js';
import type {
  LyraChart,
  LyraChartFormatterContext,
} from './chart.class.js';

type ScaleTicks = { callback?: (value: unknown) => unknown };
type Scale = { ticks?: ScaleTicks };
/** Named rather than indexed so the scale ids read as the axis vocabulary they are. */
type Scales = { x?: Scale; y?: Scale; y2?: Scale; r?: Scale };
type Config = {
  options: {
    scales?: Scales;
    plugins: {
      datalabels?: { formatter: (value: unknown, context: unknown) => string };
      tooltip?: { callbacks?: { label?: (context: unknown) => unknown } };
    };
  };
};

/** Records every context object the unified formatter is handed. */
function record(el: LyraChart): LyraChartFormatterContext[] {
  const seen: LyraChartFormatterContext[] = [];
  el.formatter = (context) => {
    seen.push(context);
    return `#${context.value}`;
  };
  return seen;
}
function config(el: LyraChart): Config {
  return (el as unknown as { buildConfig(): Config }).buildConfig();
}
function bar(): LyraChart {
  const el = document.createElement('lr-chart') as LyraChart;
  el.type = 'bar';
  el.labels = ['Q1', 'Q2'];
  el.datasets = [
    { label: 'Revenue', data: [10, 20] },
    { label: 'Latency', axis: 'y2', data: [30, 40] },
  ];
  return el;
}
function surfaces(seen: LyraChartFormatterContext[], surface: string): LyraChartFormatterContext[] {
  return seen.filter((context) => context.surface === surface);
}

describe('lr-chart formatter metadata', () => {
  it('names the scale each tick belongs to', () => {
    const el = bar();
    const seen = record(el);
    const scales = config(el).options.scales!;
    scales.y!.ticks!.callback!(2);
    scales.y2!.ticks!.callback!(3);

    expect(
      surfaces(seen, 'tick').map((context) => context.axis),
      'every tick call names its own scale',
    ).to.deep.equal(['y', 'y2']);
  });

  it('names the value x scale of a chart whose x axis carries numbers', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'scatter';
    el.datasets = [{ label: 'Points', points: [{ x: 1, y: 2 }] }];
    const seen = record(el);
    config(el).options.scales!.x!.ticks!.callback!(1);
    expect(surfaces(seen, 'tick')[0]?.axis, 'the linear x scale is named').to.equal('x');
  });

  it('names the radial scale on a radar chart tick', () => {
    const el = bar();
    el.type = 'radar';
    const seen = record(el);
    config(el).options.scales!.r!.ticks!.callback!(1);
    expect(surfaces(seen, 'tick')[0]?.axis, 'the radial scale is named').to.equal('r');
  });

  it('identifies the series and datum a visual data label belongs to', () => {
    const el = bar();
    (el as unknown as { dataLabels: boolean }).dataLabels = true;
    const seen = record(el);
    config(el).options.plugins.datalabels!.formatter(40, { datasetIndex: 1, dataIndex: 1 });

    const visual = surfaces(seen, 'visual')[0];
    expect(visual?.datasetIndex, 'the dataset index reaches the visual surface').to.equal(1);
    expect(visual?.index, 'the datum index reaches the visual surface').to.equal(1);
    expect(visual?.label, 'the category label reaches the visual surface').to.equal('Q2');
    expect(visual?.seriesLabel, 'the series label reaches the visual surface').to.equal('Latency');
    expect(visual?.axis, "the series' own value axis reaches the visual surface").to.equal('y2');
  });

  it('identifies the series and datum a tooltip value belongs to', () => {
    const el = bar();
    const seen = record(el);
    const label = config(el).options.plugins.tooltip!.callbacks!.label!;
    label({
      datasetIndex: 0,
      dataIndex: 1,
      parsed: { x: 1, y: 20 },
      raw: 20,
      dataset: { label: 'Revenue' },
    });

    const tooltip = surfaces(seen, 'tooltip')[0];
    expect(tooltip?.datasetIndex, 'the dataset index reaches the tooltip surface').to.equal(0);
    expect(tooltip?.index, 'the datum index reaches the tooltip surface').to.equal(1);
    expect(tooltip?.label, 'the category label reaches the tooltip surface').to.equal('Q2');
    expect(tooltip?.seriesLabel, 'the series label reaches the tooltip surface').to.equal('Revenue');
    expect(tooltip?.axis, "the series' own value axis reaches the tooltip surface").to.equal('y');
  });

  it('identifies the series behind each rendered legend entry', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart
      type="bar"
      legend-display="value"
      without-animation
      style="inline-size:320px;block-size:320px"
      .labels=${['Q1', 'Q2']}
      .datasets=${[
        { label: 'Revenue', data: [10, 20] },
        { label: 'Latency', axis: 'y2', data: [30, 40] },
      ]}
    ></lr-chart>`);
    await waitUntil(() => !!el.chart, 'Chart.js initialized', { timeout: 5000 });
    const seen = record(el);
    el.requestUpdate();
    await el.updateComplete;
    // One clean render's worth of calls: the fixture and the formatter assignment above have each
    // already driven a legend pass.
    seen.length = 0;
    el.requestUpdate();
    await el.updateComplete;

    const legend = surfaces(seen, 'legend');
    expect(
      legend.map((context) => context.datasetIndex),
      'each legend entry names its own dataset',
    ).to.deep.equal([0, 1]);
    expect(
      legend.map((context) => context.seriesLabel),
      'each legend entry names its own series',
    ).to.deep.equal(['Revenue', 'Latency']);
    expect(
      legend.map((context) => context.axis),
      'each legend entry names its own value axis',
    ).to.deep.equal(['y', 'y2']);
  });

  it('identifies the category behind each per-slice legend entry', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart
      type="doughnut"
      legend-mode="datum"
      legend-display="value"
      without-animation
      style="inline-size:320px;block-size:320px"
      .labels=${['A', 'B']}
      .datasets=${[{ label: 'Distribution', data: [5, 3] }]}
    ></lr-chart>`);
    await waitUntil(() => !!el.chart, 'Chart.js initialized', { timeout: 5000 });
    const seen = record(el);
    el.requestUpdate();
    await el.updateComplete;
    seen.length = 0;
    el.requestUpdate();
    await el.updateComplete;

    const legend = surfaces(seen, 'legend');
    expect(
      legend.map((context) => context.index),
      'each slice entry names its own category index',
    ).to.deep.equal([0, 1]);
    expect(
      legend.map((context) => context.label),
      'each slice entry names its own category',
    ).to.deep.equal(['A', 'B']);
    expect(
      legend.map((context) => context.seriesLabel),
      'each slice entry still names its series',
    ).to.deep.equal(['Distribution', 'Distribution']);
  });

  it('reports SOURCE series indexes on a legend whose series were sampled away', async () => {
    // Past the shared 1000-cell budget the legend renders one entry per SAMPLED series, and those
    // entries are built from `dataTableSample()`, whose indexes are already source indexes. Mapping
    // them through the visual tables a second time renumbers each entry onto a different series, so
    // an entry would report the label and index of a series other than the one its swatch paints.
    const seriesCount = 40;
    const rowCount = 30;
    const el = await fixture<LyraChart>(html`<lr-chart
      type="line"
      legend-display="value"
      without-animation
      style="inline-size:320px;block-size:320px"
      .labels=${Array.from({ length: rowCount }, (_value, row) => `R${row}`)}
      .datasets=${Array.from({ length: seriesCount }, (_value, series) => ({
        label: `S${series}`,
        data: Array.from({ length: rowCount }, (_cell, row) => series + row),
      }))}
    ></lr-chart>`);
    await waitUntil(() => !!el.chart, 'Chart.js initialized', { timeout: 5000 });
    const seen = record(el);
    el.requestUpdate();
    await el.updateComplete;
    seen.length = 0;
    el.requestUpdate();
    await el.updateComplete;

    // The entries the legend actually paints, in source space, straight from the shared planner.
    const painted = [...sampleChartTableIndexes(rowCount, seriesCount).seriesIndexes];
    expect(
      painted.length < seriesCount,
      'the fixture is past the shared cell budget, so sampling really is live',
    ).to.equal(true);

    const legend = surfaces(seen, 'legend');
    expect(
      legend.map((context) => context.datasetIndex),
      'each entry reports the source index of the series its own swatch paints',
    ).to.deep.equal(painted);
    expect(
      legend.map((context) => context.seriesLabel),
      'and the matching series label, not a renumbered neighbour',
    ).to.deep.equal(painted.map((series) => `S${series}`));
  });

  it('gives a stack total no series identity, because it belongs to no single series', () => {
    const el = bar();
    el.stacked = true;
    el.stackTotals = true;
    el.dataLabels = true;
    const seen = record(el);
    // Dataset 1 is the topmost (and only) series on `y2`, so it draws that stack's total.
    config(el).options.plugins.datalabels!.formatter(40, { datasetIndex: 1, dataIndex: 1 });

    const total = surfaces(seen, 'visual').find((context) => context.statistic === 'total');
    expect(total !== undefined, 'the stack total reaches the formatter').to.equal(true);
    expect(
      total?.datasetIndex,
      'a cross-series sum names no dataset, so a formatter cannot render one series\' unit for it',
    ).to.equal(undefined);
    expect(total?.seriesLabel, 'and names no series').to.equal(undefined);
    expect(total?.index, 'the category index survives').to.equal(1);
    expect(total?.label, 'so does the category label').to.equal('Q2');
    expect(total?.axis, "and the stack's own scale, which every series in it shares").to.equal('y2');
  });

  it('names the scale of each generated table stack total', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart
      type="bar"
      stacked
      stack-totals
      without-animation
      style="inline-size:320px;block-size:320px"
      .labels=${['Q1', 'Q2']}
      .datasets=${[
        { label: 'Revenue', data: [10, 20] },
        { label: 'Latency', axis: 'y2', data: [30, 40] },
      ]}
    ></lr-chart>`);
    await waitUntil(() => !!el.chart, 'Chart.js initialized', { timeout: 5000 });
    const seen = record(el);
    el.requestUpdate();
    await el.updateComplete;
    seen.length = 0;
    el.requestUpdate();
    await el.updateComplete;

    const totals = surfaces(seen, 'table').filter((context) => context.statistic === 'total');
    expect(totals.length > 0, 'the total columns reach the formatter').to.equal(true);
    expect(
      [...new Set(totals.map((context) => context.axis))].sort(),
      'each total column names the scale its own stack is plotted on',
    ).to.deep.equal(['y', 'y2']);
    expect(
      totals.every((context) => context.datasetIndex === undefined),
      'and none of them claims a dataset',
    ).to.equal(true);
  });

  it('leaves a metadata-blind formatter working exactly as before', () => {
    const el = bar();
    el.formatter = ({ value, surface }) => `${surface}:${value}`;
    const scales = config(el).options.scales!;
    expect(scales.y!.ticks!.callback!(7), 'the tick surface still formats').to.equal('tick:7');
    expect(
      (el as unknown as { formatDataLabel(value: number): string }).formatDataLabel(4),
      'the visual surface still formats',
    ).to.equal('visual:4');
  });
});
