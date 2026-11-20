import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { prepareLyraSeriesData, type LyraPreparedSeriesData } from '../../../utilities/data-preparation.js';
import type { LyraSpatialChartPoint, LyraSpatialChartSource } from '../../../utilities/data-spatial.js';
import type { LyraChart, LyraChartFormatterContext, LyraChartPlugin } from './chart.class.js';
import '../../lr-chart.js';

type PreparedChart = LyraChart & { preparedData: LyraPreparedSeriesData | LyraSpatialChartSource | null };

async function preparedSeries(values: (index: number) => number): Promise<LyraPreparedSeriesData> {
  return prepareLyraSeriesData([{ id: 's', label: 'Prepared', input: {
    revision: 'r', count: 100, read: (start, count) => Array.from({ length: count }, (_, offset) => ({ x: start + offset, y: values(start + offset) })),
  } }], { maxPointsPerSeries: 20 });
}

async function mountedPrepared(source: LyraPreparedSeriesData | LyraSpatialChartSource, type = 'line', zoomable = false): Promise<PreparedChart> {
  const element = await fixture<PreparedChart>(html`<lr-chart type=${type} without-animation with-data-table
    ?zoomable=${zoomable} style="width:600px" .preparedData=${source}></lr-chart>`);
  await waitUntil(() => !!element.chart || !!element.shadowRoot?.querySelector('[part="error"]'), 'chart did not settle', { timeout: 5000 });
  await element.updateComplete;
  return element;
}

function description(element: LyraChart): string {
  return element.shadowRoot!.querySelector('[part="description"]')?.textContent ?? '';
}

describe('lr-chart public surface edges', () => {
  it('ignores a reassignment of the same plugin array without scheduling an update', async () => {
    const plugin: LyraChartPlugin = { id: 'same-plugin-witness' };
    const source = [plugin];
    const element = await fixture<LyraChart>(html`<lr-chart without-animation .plugins=${source}
      .labels=${['A']} .datasets=${[{ label: 'S', data: [1] }]}></lr-chart>`);
    await element.updateComplete;
    const projected = element.plugins;
    expect(projected[0] === plugin).to.equal(true);
    element.plugins = source;
    expect(element.isUpdatePending).to.equal(false);
    element.plugins = projected;
    expect(element.isUpdatePending).to.equal(false);
    expect(element.plugins === projected).to.equal(true);
    element.plugins = [];
    expect(element.isUpdatePending).to.equal(true);
    await element.updateComplete;
    expect(element.plugins.length).to.equal(0);
  });

  it('exports an empty label cell for an unlabelled point beside a labelled one', async () => {
    const element = await fixture<LyraChart>(html`<lr-chart type="scatter" without-animation
      .datasets=${[{ label: 'Points', points: [{ x: 1, y: 2, label: 'first' }, { x: 3, y: 4 }] }]}></lr-chart>`);
    const lines = element.exportData('csv').split('\r\n');
    expect(lines[0]).to.equal('label,Points x,Points y,Points label');
    expect(lines[1]).to.equal('first,1,2,first');
    expect(lines[2]).to.equal(',3,4,');
  });

  it('omits a blank category from stack-total table formatter metadata', async () => {
    const element = await fixture<LyraChart>(html`<lr-chart type="bar" stacked stack-totals without-animation
      style="inline-size:320px;block-size:320px" .labels=${['', 'Q2']}
      .datasets=${[{ label: 'A', data: [1, 2] }, { label: 'B', data: [3, 4] }]}></lr-chart>`);
    await waitUntil(() => !!element.chart, 'Chart.js initialized', { timeout: 5000 });
    const seen: LyraChartFormatterContext[] = [];
    element.formatter = (context) => { seen.push(context); return `#${context.value}`; };
    await element.updateComplete;
    const totals = seen.filter((context) => context.surface === 'table' && context.statistic === 'total');
    const first = totals.find((context) => context.index === 0);
    const second = totals.find((context) => context.index === 1);
    expect(first !== undefined && second !== undefined).to.equal(true);
    expect(first!.value).to.equal(4);
    expect('label' in first!).to.equal(false);
    expect(second!.label).to.equal('Q2');
    const cell = seen.find((context) => context.surface === 'table' && context.statistic !== 'total' && context.index === 0);
    expect(cell?.seriesLabel).to.equal('A');
    expect(cell!.label).to.equal(undefined);
    expect(element.shadowRoot!.querySelector('table')!.textContent).to.include('#4');
  });

  it('leaves preparedData untouched when a stream appends a legacy category', async () => {
    const element = await mountedPrepared(await preparedSeries((index) => index));
    const labels = element.labels;
    const datasets = element.datasets;
    const before = element.exportData('csv');
    element.appendData('late', [99]);
    await element.updateComplete;
    expect(element.labels === labels).to.equal(true);
    expect(element.datasets === datasets).to.equal(true);
    expect(element.exportData('csv')).to.equal(before);
    expect(element.exportData('csv')).not.to.include('late');
  });

  it('resolves a reveal requested just before detachment as false without reading the source', async () => {
    const source = await preparedSeries((index) => index);
    let reads = 0;
    const element = await mountedPrepared({ ...source, getPoint: (ref: { sourceIndex: number }) => { reads++; return { x: ref.sourceIndex, y: ref.sourceIndex }; } });
    element.preparedData = { ...source, revision: 'next', getPoint: (ref: { sourceIndex: number }) => { reads++; return { x: ref.sourceIndex, y: ref.sourceIndex }; } };
    const pending = element.revealSourcePoint({ seriesId: 's', sourceIndex: 50 });
    element.remove();
    expect(await pending).to.equal(false);
    expect(reads).to.equal(0);
  });

  it('describes decreasing and flat prepared series trends from their full-source endpoints', async () => {
    const decreasing = await mountedPrepared(await preparedSeries((index) => 100 - index));
    expect(description(decreasing)).to.include('decreasing trend');
    decreasing.remove();
    const flat = await mountedPrepared(await preparedSeries(() => 5));
    expect(description(flat)).to.include('flat trend');
  });

  it('notes summary-only zoom for a prepared series without indexed refinement', async () => {
    const source = await preparedSeries((index) => index % 7);
    const element = await mountedPrepared(source, 'line', true);
    const note = () => element.shadowRoot!.querySelector('[part="data-truncation"]')?.textContent ?? '';
    expect(note()).to.include('Zoom displays the prepared summary; indexed refinement is unavailable.');
    element.preparedData = { ...source, revision: 'refinable', queryRange: () => [] };
    await element.updateComplete;
    await waitUntil(() => element.getAttribute('aria-busy') !== 'true');
    expect(note()).to.equal('');
    element.zoomable = false;
    element.preparedData = source;
    await element.updateComplete;
    expect(note()).to.equal('');
  });

  it('paints a spatial series in its declared color and falls back to the palette', async () => {
    const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    const source: LyraSpatialChartSource = {
      kind: 'spatial', revision: 'r', count: 2, bounds,
      series: [{ id: 'red', label: 'Red', color: 'rgb(255, 0, 0)' }, { id: 'plain', label: 'Plain' }],
      query: () => ({ matchedCount: 2, bins: [{ bounds, count: 2 }], points: [
        { id: 'a', sourceIndex: 0, seriesId: 'red', x: 1, y: 1 },
        { id: 'b', sourceIndex: 1, seriesId: 'plain', x: 2, y: 2 },
      ] }),
      getPoint: () => null,
    };
    const element = await mountedPrepared(source, 'scatter');
    await waitUntil(() => element.getAttribute('aria-busy') === 'false' && (element.chart?.data.datasets[0]?.data?.length ?? 0) > 0);
    const datasets = element.chart!.data.datasets as unknown as { borderColor: string }[];
    expect(datasets[0]!.borderColor.replace(/\s/g, '')).to.equal('rgb(255,0,0)');
    expect(datasets[1]!.borderColor.replace(/\s/g, '')).not.to.equal('rgb(255,0,0)');
    expect(datasets[1]!.borderColor).not.to.equal('');
  });

  it('resolves a spatial reveal as false when the panned query replaces the source', async () => {
    const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    let queries = 0;
    let element!: PreparedChart;
    const source: LyraSpatialChartSource = {
      kind: 'spatial', revision: 'r', count: 10, bounds, series: [{ id: 's', label: 'Signal' }],
      query: (request) => {
        queries++;
        if (queries > 1) element.preparedData = null;
        return { matchedCount: 1, bins: [{ bounds: request.bounds, count: 1 }], points: [] };
      },
      getPoint: (id) => ({ id, sourceIndex: 4, seriesId: 's', x: 90, y: 50 }),
    };
    element = await mountedPrepared(source, 'scatter');
    element.viewport = { minX: 0, maxX: 20, minY: 40, maxY: 60 };
    queries = 0;
    await element.updateComplete;
    await waitUntil(() => element.getAttribute('aria-busy') === 'false');
    queries = 1;
    expect(await element.revealSourcePoint('far')).to.equal(false);
    expect(element.preparedData).to.equal(null);
  });

  it('skips the points of a hidden spatial series in keyboard navigation', async () => {
    const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    const point: LyraSpatialChartPoint = { id: 'visible-point', sourceIndex: 3, seriesId: 's', x: 50, y: 50, label: 'Point' };
    const source: LyraSpatialChartSource = {
      kind: 'spatial', revision: 'r', count: 10, bounds, series: [{ id: 's', label: 'Signal' }],
      query: () => ({ matchedCount: 10, bins: [{ bounds, count: 10 }], points: [point] }),
      getPoint: () => point,
    };
    const element = await mountedPrepared(source, 'scatter');
    await waitUntil(() => element.getAttribute('aria-busy') === 'false' && element.shadowRoot!.querySelector('[data-spatial-id="visible-point"]') !== null);
    const points: unknown[] = [];
    const bins: { count: number }[] = [];
    element.addEventListener('lr-spatial-point-select', (event) => points.push((event as CustomEvent).detail));
    element.addEventListener('lr-spatial-bin-select', (event) => bins.push((event as CustomEvent<{ count: number }>).detail));
    await focusByKeyboard(element.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!);
    await sendKeys({ press: 'Home' });
    await sendKeys({ press: 'Enter' });
    expect(points.length).to.equal(1);
    expect(bins.length).to.equal(0);
    element.hiddenDatasets = [0];
    await element.updateComplete;
    await sendKeys({ press: 'Home' });
    await sendKeys({ press: 'Enter' });
    expect(points.length).to.equal(1);
    expect(bins.map((bin) => bin.count)).to.deep.equal([10]);
  });
});

describe('lr-chart canvas activation on a sampled rendering', () => {
  it('maps visual hits to source datasets and rows, with blank labels and missing values omitted', async () => {
    const labels = ['', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const element = await fixture<LyraChart>(html`<lr-chart type="bar" without-animation max-records="4"
      style="inline-size:500px;block-size:240px" .labels=${labels}
      .datasets=${[
        { label: 'First', data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { label: 'Middle', data: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
        { label: 'Short', data: [5, 4, 3, 2, 1] },
      ]}></lr-chart>`);
    await waitUntil(() => element.chart !== undefined, 'initial chart is drawn');
    const chart = element.chart as unknown as {
      data: { labels: unknown[]; datasets: { label?: string }[] };
      getElementsAtEventForMode: (...args: unknown[]) => unknown;
      options: { onClick?: (this: unknown, event: unknown, elements: unknown[], chart: unknown) => void };
    };
    expect(chart.data.datasets.map((dataset) => dataset.label)).to.deep.equal(['First', 'Short']);
    expect(chart.data.labels.length).to.equal(2);
    const original = chart.getElementsAtEventForMode;
    const points: { datasetIndex: number; index: number; label?: string; value: unknown }[] = [];
    element.addEventListener('lr-point-activate', (event) => points.push((event as CustomEvent).detail));
    const clickAt = (datasetIndex: number, index: number) => {
      chart.getElementsAtEventForMode = () => [{ datasetIndex, index }];
      chart.options.onClick?.call(chart, { type: 'click', x: 10, y: 10, native: new MouseEvent('click') }, [], chart);
    };
    try {
      clickAt(0, 0);
      clickAt(1, 1);
    } finally {
      chart.getElementsAtEventForMode = original;
    }
    expect(points.map(({ datasetIndex, index, value }) => [datasetIndex, index, value])).to.deep.equal([[0, 0, 1], [2, 9, null]]);
    expect('label' in points[0]! && points[0]!.label !== undefined).to.equal(false);
    expect(points[1]!.label).to.equal('J');
  });
});

describe('lr-chart raw data configuration under a record budget', () => {
  type Rendered = { data: { labels: unknown[]; datasets: { label?: string; data: unknown[] }[] } };
  const buildConfig = (element: LyraChart) => (element as unknown as { buildConfig(): Rendered }).buildConfig();

  it('pads sampled rows a short raw label or value list does not reach', () => {
    const element = document.createElement('lr-chart') as LyraChart;
    element.type = 'bar';
    (element as unknown as { maxRecords: number }).maxRecords = 4;
    element.config = { data: {
      labels: ['A', 'B', 'C', 'D', 'E'],
      datasets: [{ label: 'Long', data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, { label: 'Short', data: [9, 8] }],
    } };
    const rendered = buildConfig(element);
    expect(rendered.data.labels).to.deep.equal(['A', '']);
    expect(rendered.data.datasets.map((dataset) => dataset.data)).to.deep.equal([[1, 10], [9, null]]);
  });

  it('keeps every raw row when only the series are thinned', () => {
    const element = document.createElement('lr-chart') as LyraChart;
    element.type = 'bar';
    (element as unknown as { maxRecords: number }).maxRecords = 4;
    element.config = { data: {
      labels: ['A', 'B'],
      datasets: [{ label: 'One', data: [1, 2] }, { label: 'Two', data: [3, 4] }, { label: 'Three', data: [5, 6] }],
    } };
    const rendered = buildConfig(element);
    expect(rendered.data.labels).to.deep.equal(['A', 'B']);
    expect(rendered.data.datasets.map((dataset) => dataset.label)).to.deep.equal(['One', 'Three']);
    expect(rendered.data.datasets.map((dataset) => dataset.data)).to.deep.equal([[1, 2], [5, 6]]);
  });
});

describe('lr-chart keyboard datums and visibility on bounded renderings', () => {
  it('skips a non-finite raw value during keyboard navigation', async () => {
    const element = await fixture<LyraChart>(html`<lr-chart type="bar" without-animation
      .config=${{ data: { labels: ['a', 'b', 'c'], datasets: [{ label: 'S', data: [3, Number.NaN, 2] }] } }}></lr-chart>`);
    await waitUntil(() => element.chart !== undefined, 'chart did not initialize', { timeout: 5000 });
    await element.updateComplete;
    const activated: number[] = [];
    element.addEventListener('lr-point-activate', (event) => activated.push((event as CustomEvent<{ index: number }>).detail.index));
    await focusByKeyboard(element.shadowRoot!.querySelector('canvas')!);
    await sendKeys({ press: 'ArrowRight' });
    await sendKeys({ press: 'Enter' });
    expect(activated).to.deep.equal([2]);
  });

  it('applies controlled dataset visibility through the visual series sample', async () => {
    const element = await fixture<LyraChart>(html`<lr-chart type="bar" without-animation max-records="4"
      style="inline-size:400px;block-size:240px" .labels=${['A', 'B']}
      .datasets=${[{ label: 'One', data: [1, 2] }, { label: 'Two', data: [3, 4] }, { label: 'Three', data: [5, 6] }]}
      .hiddenDatasets=${[2]}></lr-chart>`);
    await waitUntil(() => element.chart !== undefined, 'chart did not initialize', { timeout: 5000 });
    await element.updateComplete;
    const chart = element.chart as unknown as { data: { datasets: { label?: string }[] }; isDatasetVisible(index: number): boolean };
    expect(chart.data.datasets.map((dataset) => dataset.label)).to.deep.equal(['One', 'Three']);
    expect([chart.isDatasetVisible(0), chart.isDatasetVisible(1)]).to.deep.equal([true, false]);
    element.hiddenDatasets = [0];
    await element.updateComplete;
    await waitUntil(() => !chart.isDatasetVisible(0) && chart.isDatasetVisible(1), 'visibility follows the source index');
  });
});

describe('lr-chart synchronization compatibility of combined datasets', () => {
  it('keeps explicit bar and line datasets synchronizable and rejects another controller', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-chart height="8rem" sync-group="combo" without-animation .labels=${['A', 'B']}
        .config=${{ data: { labels: ['A', 'B'], datasets: [{ type: 'bar', label: 'Bars', data: [1, 2] }, { type: 'line', label: 'Line', data: [2, 3] }] } }}></lr-chart>
      <lr-chart height="8rem" sync-group="combo" without-animation .labels=${['A', 'B']}
        .config=${{ data: { labels: ['A', 'B'], datasets: [{ type: 'bar', label: 'Bars', data: [1, 2] }, { type: 'bubble', label: 'Bubbles', data: [{ x: 0, y: 1, r: 2 }] }] } }}></lr-chart>
    </div>`);
    const [combined, mixed] = [...host.querySelectorAll<LyraChart>('lr-chart')];
    await waitUntil(() => !!combined!.chart && !!mixed!.chart, 'charts rendered', { timeout: 5000 });
    const sync = (chart: LyraChart) => (chart as unknown as { chartSync: { enabled: boolean } }).chartSync.enabled;
    await waitUntil(() => sync(combined!), 'the bar and line combination joins its group');
    await combined!.updateComplete;
    await mixed!.updateComplete;
    expect(sync(mixed!)).to.equal(false);
  });
});
