import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import type { Chart } from 'chart.js';
import { sendMouse, resetMouse } from '../../../../test/wtr-mouse.js';
import './chart.js';
import type { LyraChart } from './chart.class.js';
import type { LyraSpatialChartPoint, LyraSpatialChartSource } from '../../../utilities/data-spatial.js';

const peer = (el: LyraChart): Chart => el.chart as unknown as Chart;
async function ready(el: LyraChart): Promise<void> {
  await waitUntil(() => !!el.chart, 'Chart.js initialized', { timeout: 5000 });
  await el.updateComplete;
}

describe('chart category labels', () => {
  it('renders multi-line, hole-y and non-text category labels without breaking the data table', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart without-animation with-data-table></lr-chart>`);
    const sparse: unknown[] = ['first'];
    sparse[2] = 'third';
    el.config = { type: 'pie', data: { labels: [['Line one', 'Line two'], sparse, { not: 'text' }] as unknown as string[], datasets: [{ label: 'Series', data: [1, 2, 3] }] } };
    await ready(el);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('tbody tr').length === 3, 'three data rows', { timeout: 5000 });
    const headers = [...el.shadowRoot!.querySelectorAll('tbody th')].map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(headers[0]).to.equal('Line one Line two');
    expect(headers[1]).to.equal('first third');
    expect(headers[2]!.length, 'an object label falls back to a generated point name').to.be.greaterThan(0);
    const values = [...el.shadowRoot!.querySelectorAll('tbody tr')].map((row) => row.querySelector('td')?.textContent?.trim());
    expect(values).to.deep.equal(['1', '2', '3']);
  });

  it('feeds Chart.js a bounded sample of a large raw configuration while keeping its endpoints', async () => {
    const rows = 3000;
    const el = await fixture<LyraChart>(html`<lr-chart without-animation style="inline-size:600px;block-size:240px"></lr-chart>`);
    el.config = {
      type: 'line',
      data: {
        labels: Array.from({ length: rows }, (_, index) => `t${index}`),
        datasets: [{ label: 'Load', data: Array.from({ length: rows }, (_, index) => index) }],
      },
    };
    await ready(el);
    const drawn = peer(el).data.datasets[0]!.data as number[];
    expect(drawn.length).to.be.lessThan(rows);
    expect(drawn.length).to.be.greaterThan(2);
    expect(drawn[0]).to.equal(0);
    expect(drawn.at(-1)).to.equal(rows - 1);
    expect(peer(el).data.labels!.length).to.equal(drawn.length);
  });
});

describe('chart hidden series and slices', () => {
  it('treats a non-array hiddenDatasets as an empty controlled list', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart type="bar" without-animation
      .config=${{ type: 'bar', data: { labels: ['x'], datasets: [{ label: 'Quiet', data: [1], hidden: true }] } }}></lr-chart>`);
    await ready(el);
    const pressed = () => el.shadowRoot!.querySelector('[part~="legend-item"]')?.getAttribute('aria-pressed');
    expect(pressed(), 'the configuration hides the series').to.equal('false');
    el.hiddenDatasets = { 0: 0, length: 1 } as unknown as number[];
    await el.updateComplete;
    await waitUntil(() => pressed() === 'true', 'the controlled (empty) list shows every series');
    expect(el.hiddenDatasets).to.not.equal(undefined);
  });

  it('keeps reconciling the remaining slices when the peer refuses to toggle one', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart type="doughnut" legend-mode="datum" without-animation style="inline-size:320px;block-size:320px"
      .labels=${['A', 'B', 'C']} .datasets=${[{ label: 'Share', data: [5, 3, 2] }]}></lr-chart>`);
    await ready(el);
    const chart = peer(el);
    const toggle = chart.toggleDataVisibility;
    chart.toggleDataVisibility = function (this: Chart, index: number) {
      if (index === 0) throw new Error('peer refused');
      return toggle.call(this, index);
    };
    try {
      el.hiddenDatums = [0, 1];
      await el.updateComplete;
      await waitUntil(() => chart.getDataVisibility(1) === false, 'the second slice is hidden');
      expect(chart.getDataVisibility(0), 'the refused slice is left as it was').to.equal(true);
    } finally { chart.toggleDataVisibility = toggle; }
  });
});

describe('chart value-percentage legend', () => {
  it('shows the formatted value and its share together', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart type="doughnut" legend-display="value-percentage" without-animation style="inline-size:320px;block-size:320px"
      .labels=${['A', 'B']} .datasets=${[{ label: 'Share', data: [3, 1] }]}
      .valueFormatter=${(value: number) => `${value} units`}></lr-chart>`);
    await ready(el);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part~="legend-item"]').length === 2);
    const texts = [...el.shadowRoot!.querySelectorAll('[part~="legend-item"]')].map((item) => item.textContent!.replace(/\s+/g, ' ').trim());
    expect(texts[0]).to.contain('A').and.to.contain('3 units').and.to.contain('75');
    expect(texts[1]).to.contain('B').and.to.contain('1 units').and.to.contain('25');
  });

  it('falls back to the category colour for a legend swatch whose configured colours are not text', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart type="doughnut" legend-mode="datum" without-animation style="inline-size:320px;block-size:320px"
      .config=${{ type: 'doughnut', data: { labels: ['A', 'B'], datasets: [{ label: 'Share', data: [3, 1], backgroundColor: [7, null] }] } }}></lr-chart>`);
    await ready(el);
    const swatches = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="legend-swatch"]')];
    expect(swatches.length).to.equal(2);
    expect(swatches.every((swatch) => swatch.style.backgroundColor !== '')).to.equal(true);
  });
});

describe('chart streamed table refresh without idle callbacks', () => {
  async function streaming(): Promise<LyraChart> {
    const chart = await fixture<LyraChart>(html`<lr-chart without-animation without-legend
      .labels=${['First']} .datasets=${[{ label: 'Series', data: [10] }]}></lr-chart>`);
    await ready(chart);
    await aTimeout(0);
    await chart.updateComplete;
    return chart;
  }
  const withoutIdleCallbacks = async (run: () => Promise<void>): Promise<void> => {
    const request = Object.getOwnPropertyDescriptor(window, 'requestIdleCallback');
    const cancel = Object.getOwnPropertyDescriptor(window, 'cancelIdleCallback');
    Object.defineProperty(window, 'requestIdleCallback', { configurable: true, value: undefined });
    Object.defineProperty(window, 'cancelIdleCallback', { configurable: true, value: undefined });
    try { await run(); } finally {
      if (request) Object.defineProperty(window, 'requestIdleCallback', request); else Reflect.deleteProperty(window, 'requestIdleCallback');
      if (cancel) Object.defineProperty(window, 'cancelIdleCallback', cancel); else Reflect.deleteProperty(window, 'cancelIdleCallback');
    }
  };

  it('commits hidden streamed rows from a zero-delay timer', async () => {
    const chart = await streaming();
    await withoutIdleCallbacks(async () => {
      chart.appendData('Newest', [42]);
      await chart.updateComplete;
      await waitUntil(() => chart.shadowRoot!.querySelector('tbody')!.textContent!.includes('Newest'), 'rows committed by the timer');
      expect(chart.shadowRoot!.querySelector('tbody')!.textContent).to.contain('42');
    });
  });

  it('shows pending streamed rows immediately when the table becomes visible', async () => {
    const chart = await streaming();
    await withoutIdleCallbacks(async () => {
      chart.appendData('Newest', [42]);
      chart.withDataTable = true;
      await chart.updateComplete;
      expect(chart.shadowRoot!.querySelector('table')!.classList.contains('sr-only')).to.equal(false);
      expect(chart.shadowRoot!.querySelector('tbody')!.textContent).to.contain('Newest');
    });
  });
});

const bounds = { minX: -Number.MAX_VALUE, maxX: Number.MAX_VALUE, minY: 0, maxY: 100 };
const point: LyraSpatialChartPoint = { id: 'middle', sourceIndex: 500000, seriesId: 's', x: 0, y: 50, radius: 10, label: 'Middle' };
function spatialSource(): LyraSpatialChartSource {
  return {
    kind: 'spatial', revision: 'r', count: 1000000, bounds,
    series: [{ id: 's', label: 'Signal' }],
    radiusDomain: { min: 1, max: Number.MAX_VALUE },
    query: () => ({ matchedCount: 1000000, bins: [{ bounds: { ...bounds, maxY: 99 }, count: 999999 }, { bounds: { ...bounds, minY: 99 }, count: 1 }], points: [point] }),
    getPoint: (id) => ({ ...point, id }),
  };
}
type TooltipCallbacks = {
  footer(items: unknown[]): string;
  label(item: unknown): string;
};
async function spatialChart(): Promise<LyraChart> {
  const el = await fixture<LyraChart>(html`<lr-chart type="bubble" without-animation style="inline-size:600px"
    .preparedData=${spatialSource()}></lr-chart>`);
  await waitUntil(() => !!el.chart, 'spatial chart initialized', { timeout: 5000 });
  await waitUntil(() => el.getAttribute('aria-busy') === 'false');
  await el.updateComplete;
  return el;
}
const tooltip = (el: LyraChart): TooltipCallbacks =>
  (peer(el).options as unknown as { plugins: { tooltip: { callbacks: TooltipCallbacks } } }).plugins.tooltip.callbacks;
const hovered = [{ datasetIndex: 0, dataIndex: 0 }];

describe('spatial chart tooltips and density activation', () => {
  it('builds the tooltip footer from the original point through tooltipFooterFormatter', async () => {
    const el = await spatialChart();
    expect(tooltip(el).footer(hovered)).to.equal('');
    const seen: unknown[] = [];
    el.tooltipFooterFormatter = (items) => { seen.push(items[0]); return `Footer ${items[0]!.label}`; };
    await el.updateComplete;
    expect(tooltip(el).footer(hovered)).to.equal('Footer Middle');
    expect(seen[0]).to.include({ value: 50, index: 500000, seriesLabel: 'Signal', surface: 'tooltip' });
    expect(tooltip(el).footer([{ datasetIndex: 9, dataIndex: 9 }])).to.equal('');
  });

  it('labels a hovered point with its description, or with the configured formatter', async () => {
    const el = await spatialChart();
    expect(tooltip(el).label({ datasetIndex: 0, dataIndex: 0 })).to.contain('source position');
    expect(tooltip(el).label({ datasetIndex: 9, dataIndex: 9 })).to.equal('');
    el.valueFormatter = (value, surface) => `${surface}:${value}`;
    await el.updateComplete;
    expect(tooltip(el).label({ datasetIndex: 0, dataIndex: 0 })).to.equal('tooltip:50');
    el.formatter = (context) => `${context.seriesLabel}/${context.label}/${context.value}`;
    await el.updateComplete;
    expect(tooltip(el).label({ datasetIndex: 0, dataIndex: 0 })).to.equal('Signal/Middle/50');
  });
});

describe('spatial chart density activation by pointer', () => {
  const regionSource = (): LyraSpatialChartSource => ({
    kind: 'spatial', revision: 'r', count: 1000, bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
    series: [{ id: 's', label: 'Signal' }],
    radiusDomain: { min: 1, max: 10 },
    query: () => ({
      matchedCount: 1000,
      bins: [
        { bounds: { minX: 0, maxX: 50, minY: 0, maxY: 100 }, count: 600 },
        { bounds: { minX: 50, maxX: 100, minY: 0, maxY: 100 }, count: 400 },
      ],
      points: [{ id: 'p', sourceIndex: 1, seriesId: 's', x: 75, y: 50, radius: 5, label: 'Only' }],
    }),
    getPoint: (id) => ({ id, sourceIndex: 1, seriesId: 's', x: 75, y: 50, radius: 5 }),
  });

  it('selects the density region under a click away from any point', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart type="bubble" without-animation style="inline-size:600px"
      .preparedData=${regionSource()}></lr-chart>`);
    await waitUntil(() => !!el.chart, 'spatial chart initialized', { timeout: 5000 });
    await waitUntil(() => el.getAttribute('aria-busy') === 'false');
    await el.updateComplete;
    const area = peer(el).chartArea;
    const box = el.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!.getBoundingClientRect();
    const counts: number[] = [];
    el.addEventListener('lr-spatial-bin-select', (event) => counts.push((event as CustomEvent<{ count: number }>).detail.count));
    try {
      await sendMouse({ type: 'click', position: [Math.round(box.left + area.left + area.width * 0.2), Math.round(box.top + area.top + area.height * 0.6)] });
      await waitUntil(() => counts.length === 1, 'density region selected');
      expect(counts).to.deep.equal([600]);
    } finally { await resetMouse(); }
  });
});
