import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-chart.js';
import type { LyraChart } from './chart.class.js';
import type { LyraChartSeries } from './chart-types.js';
import { chartBandOpacity, drawChartBands } from './chart-band.js';

interface Scale { min: number; max: number; getPixelForValue(value: number): number }
interface Runtime {
  data: { datasets: Record<string, unknown>[] };
  scales: Record<string, Scale>;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  options: { plugins: { tooltip: { callbacks?: { label?(context: unknown): unknown } } } };
}
const runtime = (el: LyraChart): Runtime => el.chart as unknown as Runtime;
const LABELS = ['Mon', 'Tue', 'Wed', 'Thu'];
const BAND: LyraChartSeries = { label: 'Envelope', type: 'band', lower: [2, 2, 2, 2], upper: [8, 8, 8, 8], color: 'rgb(255, 0, 0)' };

async function mount(datasets: readonly LyraChartSeries[], extra: Partial<LyraChart> = {}): Promise<LyraChart> {
  const host = await fixture<HTMLElement>(html`<div style="inline-size:400px;--lr-chart-band-opacity:1"></div>`);
  const el = document.createElement('lr-chart') as LyraChart;
  Object.assign(el, { type: 'line', withoutAnimation: true, labels: LABELS, datasets, ...extra });
  host.append(el);
  await waitUntil(() => !!el.chart, 'Chart.js initializes', { timeout: 5000 });
  await el.updateComplete;
  await new Promise(resolve => requestAnimationFrame(resolve));
  return el;
}

function pixelAt(el: LyraChart, x: number, y: number): readonly number[] {
  const chart = runtime(el);
  const ratio = chart.canvas.width / chart.canvas.getBoundingClientRect().width;
  return [...chart.ctx.getImageData(Math.round(x * ratio), Math.round(y * ratio), 1, 1).data];
}

const cells = (el: LyraChart): string[] =>
  [...el.shadowRoot!.querySelectorAll('tbody tr')].map(row => row.querySelector('td')!.textContent!.trim());

describe('lr-chart range band series', () => {
  it('fills between lower and upper, widens the scale and lists both bounds everywhere', async () => {
    const el = await mount([{ ...BAND, lower: [-5, 2, null, 2] }, { label: 'Median', data: [5, 5, 5, 5] }]);
    const chart = runtime(el);
    expect(chart.data.datasets[0]!['showLine']).to.equal(false);
    expect(chart.data.datasets[0]!['lyraBandLower']).to.deep.equal([-5, 2, null, 2]);
    expect(chart.scales['y']!.min).to.be.at.most(-5);
    const x = (chart.scales['x']!.getPixelForValue(0) + chart.scales['x']!.getPixelForValue(1)) / 2;
    const inside = pixelAt(el, x, chart.scales['y']!.getPixelForValue(6.5));
    const outside = pixelAt(el, x, chart.scales['y']!.getPixelForValue(9.5));
    expect([inside[0], inside[1], inside[2]]).to.deep.equal([255, 0, 0]);
    expect(outside[0] === 255 && outside[1] === 0).to.equal(false);
    // A row missing a bound is a gap in the fill as well as in the table.
    const gapX = (chart.scales['x']!.getPixelForValue(2) + chart.scales['x']!.getPixelForValue(2.4)) / 2;
    expect(pixelAt(el, gapX, chart.scales['y']!.getPixelForValue(6.5)).slice(0, 3)).to.not.deep.equal([255, 0, 0]);

    expect(cells(el)).to.deep.equal(['-5 to 8', '2 to 8', 'No data', '2 to 8']);
    const label = chart.options.plugins.tooltip.callbacks!.label!;
    expect(label({ datasetIndex: 0, dataIndex: 1, parsed: { x: 1, y: 8 }, raw: 8, dataset: chart.data.datasets[0] }))
      .to.equal('Envelope: 2 to 8');
    expect(label({ datasetIndex: 1, dataIndex: 1, parsed: { x: 1, y: 5 }, raw: 5, dataset: chart.data.datasets[1] }))
      .to.equal(undefined);
    expect(label({ datasetIndex: 0, dataIndex: 2, parsed: { x: 2, y: null }, raw: null, dataset: chart.data.datasets[0] }))
      .to.equal(undefined);
    expect(label({ datasetIndex: 9, dataIndex: 0, dataset: chart.data.datasets[0] })).to.equal(undefined);
    const announce = (el as unknown as { datumAnnouncement(datum: unknown, position: number, total: number): string })
      .datumAnnouncement({ datasetIndex: 0, index: 0, label: 'Mon', value: 8 }, 0, 4);
    expect(announce).to.contain('-5 to 8');
    expect(el.shadowRoot!.querySelector('[part="description"]')!.textContent).to.contain('range -5 to 8');
    expect(el.exportData('csv').split('\r\n').slice(0, 2)).to.deep.equal(['label,Envelope lower,Envelope upper,Median', 'Mon,-5,8,5']);

    const [band, median] = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
    expect(band!.hasAttribute('data-band')).to.equal(true);
    expect(getComputedStyle(band!).boxShadow).to.contain('rgb(255, 0, 0)');
    expect(median!.hasAttribute('data-band')).to.equal(false);
  });

  it('formats both bounds through formatter with min and max statistics', async () => {
    const seen: string[] = [];
    const el = await mount([BAND], {
      formatter: ({ value, surface, statistic }) => { seen.push(`${surface}:${statistic}`); return `${value}%`; },
    });
    expect(cells(el)[0]).to.equal('2% to 8%');
    expect(seen).to.include('table:min').and.to.include('table:max');
    const label = runtime(el).options.plugins.tooltip.callbacks!.label!;
    expect(label({ datasetIndex: 0, dataIndex: 0, parsed: { x: 0, y: 8 }, raw: 8, dataset: runtime(el).data.datasets[0] }))
      .to.equal('Envelope: 2% to 8%');
    expect(el.exportData('csv').split('\r\n')[1]).to.equal('Mon,2%,8%');
  });

  it('clamps mismatched bounds with a development warning and reorders reversed rows', async () => {
    const messages: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => { messages.push(args.map(String).join(' ')); };
    try {
      const el = await mount([{ label: 'Envelope', type: 'band', lower: [9, 1, 1], upper: [3, 4] }]);
      expect(cells(el)).to.deep.equal(['3 to 9', '1 to 4', 'No data', 'No data']);
      expect(el.datasets[0]!.lower).to.deep.equal([9, 1, 1]);
      const empty = await mount([{ label: 'Empty', type: 'band' }]);
      expect(cells(empty)).to.deep.equal(['No data', 'No data', 'No data', 'No data']);
      expect('lower' in empty.datasets[0]!).to.equal(false);
    } finally {
      console.warn = original;
    }
    expect(messages.some(message => message.includes('band series has lower and upper arrays of different lengths'))).to.equal(true);
  });

  it('never widens a scale for a hidden band or past explicit limits', async () => {
    const hidden = await mount([{ ...BAND, lower: [-50, 2, 2, 2] }, { label: 'Median', data: [5, 5, 5, 5] }], { hiddenDatasets: [0] });
    expect(runtime(hidden).scales['y']!.min).to.be.greaterThan(-50);

    const bounded = await mount([{ ...BAND, lower: [-50, 2, 2, 2], upper: [80, 8, 8, 8] }], {
      config: { options: { scales: { y: { min: 0, max: 10 } } } },
    });
    expect([runtime(bounded).scales['y']!.min, runtime(bounded).scales['y']!.max]).to.deep.equal([0, 10]);
  });

  it('fills a horizontal band along the value axis', async () => {
    const horizontal = await mount([BAND], { indexAxis: 'y' });
    const chart = runtime(horizontal);
    const y = (chart.scales['y']!.getPixelForValue(0) + chart.scales['y']!.getPixelForValue(1)) / 2;
    expect(pixelAt(horizontal, chart.scales['x']!.getPixelForValue(5), y).slice(0, 3)).to.deep.equal([255, 0, 0]);
  });

  it('draws bands on bar charts only as lines and never on radial charts', async () => {
    const bar = await mount([BAND, { label: 'Count', data: [1, 2, 3, 4] }], { type: 'bar' });
    expect(runtime(bar).data.datasets[0]!['type']).to.equal('line');
    expect(runtime(bar).data.datasets[1]!['lyraBandLower']).to.equal(undefined);

    const pie = await mount([BAND], { type: 'pie' });
    expect(runtime(pie).data.datasets[0]!['lyraBandLower']).to.equal(undefined);
    expect(runtime(pie).data.datasets[0]!['type']).to.equal(undefined);
  });

  it('leaves fill-to-axis series unchanged and streams a band row as a gap', async () => {
    const el = await mount([{ label: 'Area', data: [1, 2, 3, 4], fill: true }, BAND]);
    expect(runtime(el).data.datasets[0]!['fill']).to.equal(true);
    expect(runtime(el).data.datasets[0]!['lyraBandLower']).to.equal(undefined);
    el.appendData('Fri', [5, 6], 4);
    await el.updateComplete;
    expect(el.labels).to.deep.equal(['Tue', 'Wed', 'Thu', 'Fri']);
    expect(el.datasets[1]!.lower).to.deep.equal([2, 2, 2, null]);
    expect(el.datasets[1]!.upper).to.deep.equal([8, 8, 8, null]);
    const bandCells = (): string => [...el.shadowRoot!.querySelectorAll('tbody tr')].map(row => row.querySelectorAll('td')[1]!.textContent!.trim()).join('|');
    await waitUntil(() => bandCells() === '2 to 8|2 to 8|2 to 8|No data', 'the streamed band row is a gap', { timeout: 3000 });
  });

  it('reads the band opacity token and tolerates a missing context', () => {
    expect(chartBandOpacity('')).to.equal(0.2);
    expect(chartBandOpacity('0.5')).to.equal(0.5);
    expect(chartBandOpacity('3')).to.equal(1);
    let read = 0;
    drawChartBands({ data: { datasets: [{ lyraBandLower: [1] }] }, ctx: null, isDatasetVisible: () => true }, () => ++read);
    expect(read).to.equal(0);
    // A peer-replaced controller or an incomplete meta never draws; a band without a fill stays clear.
    const ctx = document.createElement('canvas').getContext('2d')!;
    const vScale = { axis: 'y', min: 0, getPixelForValue: (value: number) => value };
    const data = [{ x: 0, y: 0 }, { x: 4, y: 0 }];
    for (const meta of [{ type: 'bar', vScale, data }, { type: 'line', data }, { type: 'line', vScale }, { type: 'line', vScale, data }]) {
      drawChartBands({ data: { datasets: [{ lyraBandLower: [4, 4] }] }, ctx, isDatasetVisible: () => true, getDatasetMeta: () => meta }, () => ++read);
    }
    expect(read).to.equal(1);
    expect(ctx.getImageData(2, 2, 1, 1).data[3]).to.equal(0);
  });
});
