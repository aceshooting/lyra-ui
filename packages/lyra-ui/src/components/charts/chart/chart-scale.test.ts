import './bar-chart.js';
import './line-chart.js';
import './pie-chart.js';
import './doughnut-chart.js';
import './radar-chart.js';
import './polar-area-chart.js';
import './scatter-chart.js';
import './bubble-chart.js';
import { expect } from '@open-wc/testing';
import './chart.js';
import './histogram.js';
import './box-plot.js';
import type { LyraChart } from './chart.class.js';
import type { LyraHistogram } from './histogram.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import { preloadCharts } from './chart-preload.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';

type ChartProbe = { chartDescription(): string; summarizeSeries(value: unknown): unknown; renderDataTableRows(): unknown; effectiveData(): unknown };

describe('scale', () => {
  it('reuses a 10,000-point description and rows on unrelated updates', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.datasets = [{ label: 'Series', data: Array.from({ length: 10_000 }, (_, i) => i) }];
    const probe = el as unknown as ChartProbe;
    probe.chartDescription();
    const rows = probe.renderDataTableRows();
    const spy = countCalls(probe, 'summarizeSeries');
    try {
      for (let i = 0; i < 100; i++) { (el as unknown as { loading: boolean }).loading = i % 2 === 0; el.refreshTheme(); probe.chartDescription(); }
      expect(probe.renderDataTableRows() === rows).to.equal(true);
      expect(spy.calls).to.equal(0);
      recordScaleMeasurement('lr-chart', 'unrelated-updates@10000', { summaryScans: spy.calls });
    } finally { spy.restore(); }
  });

  it('does not re-admit 10,000 retained numeric points on append', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.datasets = [{ label: 'Series', data: Array.from({ length: 10_000 }, (_, i) => i) }];
    const spy = countCalls(Object, 'getOwnPropertyDescriptor');
    try {
      el.appendData('next', [42]);
      const calls = spy.calls;
      expect(el.datasets[0]!.data!.at(-1)).to.equal(42);
      expect(calls).to.be.below(100);
      recordScaleMeasurement('lr-chart', 'append@10000', { descriptorReads: calls });
    } finally { spy.restore(); }
  });

  it('keeps a canonical 1,000-bin histogram projection across repeated reads', () => {
    const el = document.createElement('lr-histogram') as LyraHistogram;
    el.values = Array.from({ length: 10_000 }, (_, i) => i);
    el.bins = 1000;
    const probe = el as unknown as ChartProbe;
    probe.effectiveData();
    const spy = countCalls(Object, 'getOwnPropertyDescriptor');
    try {
      for (let i = 0; i < 20; i++) (el as unknown as { seriesToDataset(series: unknown, index: number, palette: string[], type: string): unknown }).seriesToDataset(el.datasets[0], 0, ['black'], 'bar');
      expect(spy.calls).to.be.below(100);
      recordScaleMeasurement('lr-histogram', 'summary-reads@10000', { descriptorReads: spy.calls });
    } finally { spy.restore(); }
  });

  it('reuses box plans and datums across 100 keyboard reads of 5,000 boxes', () => {
    const el = document.createElement('lr-box-plot') as LyraBoxPlot;
    el.datasets = [{ label: 'Boxes', data: Array.from({ length: 5000 }, () => ({ min: 0, q1: 1, median: 2, q3: 3, max: 4 })) }];
    const probe = el as unknown as { dataTableSample(): unknown; boxDatums(): unknown; boxPlotDescription(): string; validPoint(value: unknown): boolean };
    const plan = probe.dataTableSample();
    const datums = probe.boxDatums();
    probe.boxPlotDescription();
    const spy = countCalls(probe, 'validPoint');
    try {
      for (let i = 0; i < 100; i++) {
        expect(probe.dataTableSample() === plan).to.equal(true);
        expect(probe.boxDatums() === datums).to.equal(true);
        probe.boxPlotDescription();
      }
      expect(spy.calls).to.equal(0);
      recordScaleMeasurement('lr-box-plot', 'keyboard-reads@5000', { boxValidations: spy.calls });
    } finally { spy.restore(); }
  });
});

describe('bounded chart sampling', () => {
  it('defaults to 1,000 records and shares width-aware extrema across generated and raw data', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    expect((el as LyraChart & { maxRecords: number }).maxRecords).to.equal(1000);
    const data = Array.from({ length: 10_000 }, () => 0);
    data[123] = 900;
    data[456] = -800;
    const probe = el as unknown as { maxRecords: number; samplingWidth: number; dataTableSample(): { rowIndexes: number[] }; buildConfig(): { data: { datasets: { data: number[] }[] } } };
    probe.maxRecords = 100;
    probe.samplingWidth = 40;
    for (const raw of [false, true]) {
      if (raw) el.config = { data: { datasets: [{ label: 'Raw', data }] } };
      else el.datasets = [{ label: 'Series', data }];
      const values = probe.buildConfig().data.datasets[0]!.data;
      expect(values.length).to.be.at.most(40);
      expect(values).to.include(900);
      expect(values).to.include(-800);
      expect(probe.dataTableSample().rowIndexes).to.include(123);
    }
  });
});

it('discloses admission loss separately from rendered sampling and clears it on replacement', async () => {
  const { fixture, html, waitUntil } = await import('@open-wc/testing');
  const { expectDevWarning } = await import('../../../../test/expected-dev-warnings.js');
  expectDevWarning('lr-chart-input-cap');
  // Admission notices use the loaded chart surface; settle the optional peer before its render wait.
  expect((await preloadCharts()).core).to.equal(true);
  const el = await fixture<LyraChart>(html`<lr-chart .strings=${{ chartInputLimit: 'Input cap reached' }}></lr-chart>`);
  await waitUntil(() => !!el.shadowRoot!.querySelector('canvas'));
  el.datasets = [{ label: 'Series', data: Array.from({ length: 100_000 }, (_, i) => i) }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Input cap reached');
  el.datasets = [{ label: 'Small', data: [1, 2] }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
});

it('defers hidden streamed table rows, then refreshes the accessible alternative', async () => {
  const { fixture, html, waitUntil } = await import('@open-wc/testing');
  const el = await fixture<LyraChart>(html`<lr-chart without-animation .datasets=${[{ label: 'Series', data: Array.from({ length: 5000 }, (_, i) => i) }]}></lr-chart>`);
  await waitUntil(() => !!el.shadowRoot!.querySelector('table'));
  const probe = el as unknown as ChartProbe;
  const previous = probe.renderDataTableRows();
  el.appendData('next', [42]);
  await el.updateComplete;
  expect(probe.renderDataTableRows() === previous).to.equal(true);
  await waitUntil(() => probe.renderDataTableRows() !== previous);
  expect(el.exportData('csv')).to.contain('next,42');
});

it('appends to a raw 10,000-point config without re-admitting its retained window', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.config = { data: { labels: Array.from({ length: 10_000 }, (_, i) => String(i)), datasets: [{ label: 'Raw', data: Array.from({ length: 10_000 }, (_, i) => i) }] } };
  (el as unknown as ChartProbe).effectiveData();
  const spy = countCalls(Object, 'getOwnPropertyDescriptor');
  try {
    el.appendData('next', [42]);
    const calls = spy.calls;
    expect(calls).to.be.below(100);
    recordScaleMeasurement('lr-chart', 'raw-append@10000', { descriptorReads: calls });
  } finally { spy.restore(); }
  expect(el.exportData('csv')).to.contain('next,42');
});

it('builds the histogram append window once without a second full-window slice', () => {
  const el = document.createElement('lr-histogram') as LyraHistogram;
  el.values = Array.from({ length: 10_000 }, (_, i) => i);
  const spy = countCalls(Array.prototype, 'slice');
  try {
    el.appendSamples([10_000]);
    const copies = spy.calls;
    expect(el.values[0]).to.equal(1);
    expect(el.values.at(-1)).to.equal(10_000);
    expect(copies).to.equal(0);
    recordScaleMeasurement('lr-histogram', 'append@10000', { windowSlices: copies });
  } finally { spy.restore(); }
});

for (const tag of ['lr-bar-chart', 'lr-line-chart', 'lr-pie-chart', 'lr-doughnut-chart', 'lr-radar-chart', 'lr-polar-area-chart', 'lr-scatter-chart', 'lr-bubble-chart'] as const) {
  it(`${tag} shares the bounded 10,000-point rendering plan`, () => {
    const el = document.createElement(tag) as LyraChart;
    el.maxRecords = 80;
    el.datasets = [{ label: 'Series', data: Array.from({ length: 10_000 }, (_, i) => i === 123 ? 100_000 : i) }];
    const probe = el as unknown as { samplingWidth: number; buildConfig(): { data: { datasets: { data: unknown[] }[] } } };
    probe.samplingWidth = 60;
    const records = probe.buildConfig().data.datasets.reduce((total, series) => total + series.data.length, 0);
    expect(records).to.be.at.most(60);
    expect(records).to.be.greaterThan(2);
    recordScaleMeasurement(tag, 'render@10000', { plottedRecords: records });
  });
}

it('normalizes invalid record limits and honors the max-records attribute', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.datasets = [{ label: 'Series', data: Array.from({ length: 5000 }, (_, i) => i) }];
  const probe = el as unknown as { dataTableSample(): { rowIndexes: readonly number[] } };
  el.setAttribute('max-records', '12');
  expect(probe.dataTableSample().rowIndexes.length).to.be.at.most(12);
  el.maxRecords = 1;
  expect(probe.dataTableSample().rowIndexes).to.deep.equal([0, 4999]);
  el.maxRecords = Number.NaN;
  expect(probe.dataTableSample().rowIndexes.length).to.equal(1000);
  el.maxRecords = 1_000_000;
  expect(probe.dataTableSample().rowIndexes.length).to.equal(1000);
});

it('reuses numeric summary statistics when the visual sample changes width', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.datasets = [{ label: 'Points', points: Array.from({ length: 10_000 }, (_, i) => ({ x: i, y: i })) }];
  const probe = el as unknown as ChartProbe;
  const effective = probe.effectiveData() as { datasets: unknown[] };
  const summary = probe.summarizeSeries(effective.datasets[0]);
  const spy = countCalls(Object, 'getOwnPropertyDescriptor');
  try {
    for (let i = 0; i < 100; i++) expect(probe.summarizeSeries(effective.datasets[0]) === summary).to.equal(true);
    expect(spy.calls).to.equal(0);
    recordScaleMeasurement('lr-chart', 'summary-reuse@10000', { descriptorReads: spy.calls });
  } finally { spy.restore(); }
});

it('projects raw indexable options through source indexes while preserving cycling and scriptable options', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.maxRecords = 2;
  const callback = () => 4;
  const rawDataset = { data: [10, 20, 30, 40, 50], borderWidth: [1, 2, 3, 4, 5], hoverBackgroundColor: ['red', 'blue', 'green'], pointHitRadius: [10, 20, 30, 40, 50], pointHoverBorderWidth: [2, 4, 6, 8, 10], borderDash: [3, 5], radius: callback };
  el.config = { data: { datasets: [rawDataset] } };
  const sampled = (el as unknown as { buildConfig(): { data: { datasets: Record<string, unknown>[] } } }).buildConfig().data.datasets[0]!;
  expect(sampled['borderWidth']).to.deep.equal([1, 5]);
  expect(sampled['hoverBackgroundColor']).to.deep.equal(['red', 'blue']);
  expect(sampled['pointHitRadius']).to.deep.equal([10, 50]);
  expect(sampled['pointHoverBorderWidth']).to.deep.equal([2, 10]);
  expect(sampled['borderDash']).to.deep.equal([3, 5]);
  expect(sampled['radius']).to.equal(callback);
});

for (const refresh of ['fallback', 'bare', 'replacement'] as const) {
  it(`refreshes a streamed table immediately for ${refresh} before held idle work`, async () => {
    const { fixture, html, waitUntil } = await import('@open-wc/testing');
    let suffix = 'old';
    const el = await fixture<LyraChart>(html`<lr-chart without-animation .labels=${['first']} .datasets=${[{ label: 'Series', data: [1] }]} .formatter=${({ value }: { value: unknown }) => `${value} ${suffix}`}></lr-chart>`);
    await waitUntil(() => !!el.chart);
    await el.updateComplete;
    const request = Object.getOwnPropertyDescriptor(window, 'requestIdleCallback');
    const cancel = Object.getOwnPropertyDescriptor(window, 'cancelIdleCallback');
    let held: (() => void) | undefined;
    Object.defineProperty(window, 'requestIdleCallback', { configurable: true, value: (callback: () => void) => { held = callback; return 1; } });
    Object.defineProperty(window, 'cancelIdleCallback', { configurable: true, value: () => {} });
    try {
      el.appendData('next', [2]);
      await el.updateComplete;
      expect(held !== undefined).to.equal(true);
      if (refresh === 'fallback') {
        (el as unknown as { canvasUnavailable: boolean }).canvasUnavailable = true;
        el.appendData('latest', [3]);
      } else if (refresh === 'bare') {
        suffix = 'new';
        el.requestUpdate();
      } else {
        el.labels = ['replacement'];
        el.datasets = [{ label: 'Changed', data: [99] }];
      }
      await el.updateComplete;
      const expected = refresh === 'fallback' ? '3 old' : refresh === 'bare' ? '2 new' : '99 old';
      expect(el.shadowRoot!.querySelector('tbody')!.textContent).to.contain(expected);
      held?.();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('tbody')!.textContent).to.contain(expected);
    } finally {
      if (request) Object.defineProperty(window, 'requestIdleCallback', request); else Reflect.deleteProperty(window, 'requestIdleCallback');
      if (cancel) Object.defineProperty(window, 'cancelIdleCallback', cancel); else Reflect.deleteProperty(window, 'cancelIdleCallback');
    }
  });
}

for (const type of ['pie', 'doughnut'] as const) {
  it(`preserves non-indexable ${type} option arrays while sampling border widths`, () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.maxRecords = 2;
    const opaque = [1, 2, 3, 4, 5];
    const rawDataset = { data: [10, 20, 30, 40, 50], borderWidth: opaque,
      borderDash: opaque, hoverBorderDash: opaque, spacing: opaque, borderDashOffset: opaque, hoverBorderDashOffset: opaque };
    el.config = { type, data: { datasets: [rawDataset] } };
    const dataset = (el as unknown as { buildConfig(): { data: { datasets: Record<string, unknown>[] } } }).buildConfig().data.datasets[0]!;
    expect(dataset['borderWidth']).to.deep.equal([1, 5]);
    for (const key of ['borderDash', 'hoverBorderDash', 'spacing', 'borderDashOffset', 'hoverBorderDashOffset']) {
      expect(dataset[key], key).to.deep.equal(opaque);
    }
  });
}
