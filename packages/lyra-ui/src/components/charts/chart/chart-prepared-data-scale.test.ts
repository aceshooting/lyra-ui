import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import { prepareLyraSeriesData, prepareLyraCategoryData, type LyraPreparedSeriesData, type LyraPreparedCategoryData } from '../../../utilities/data-preparation.js';
import './chart.js';
import type { LyraChart } from './chart.class.js';

type PreparedChart = LyraChart & {
  preparedData: LyraPreparedSeriesData | LyraPreparedCategoryData | null;
  revealSourcePoint(ref: { seriesId: string; sourceIndex: number }): Promise<boolean>;
};

it('renders a million-position prepared series with full domains and exact source lookup', async function () {
  this.timeout(20000);
  const reads: [number, number][] = [];
  const count = 1_000_000;
  const prepared = await prepareLyraSeriesData([{ id: 's', label: 'Signal', input: {
    revision: 'r1', count,
    read(start, size) { reads.push([start, size]); return Array.from({ length: size }, (_, offset) => {
      const x = start + offset;
      return { x, y: x === count - 2 ? 9999 : x === 500000 ? -9999 : x % 11 };
    }); },
  } }], { maxPointsPerSeries: 50, batchSize: 8192 });
  const element = await fixture<PreparedChart>(html`<lr-chart type="line" without-animation with-data-table .preparedData=${prepared}></lr-chart>`);
  await waitUntil(() => element.shadowRoot?.querySelector('table') !== null && element.shadowRoot?.textContent?.includes('Signal') === true, 'prepared table missing', { timeout: 5000 });
  await waitUntil(() => element.chart !== undefined, 'peer missing', { timeout: 5000 });
  const peer = element.chart!;
  const scales = peer.options['scales'] as { x: { min: number; max: number }; y: { min: number; max: number } };
  expect([scales.x.min, scales.x.max, scales.y.min, scales.y.max]).to.deep.equal([0, 999999, -9999, 9999]);
  expect(reads.reduce((sum, [, count]) => sum + count, 0)).to.equal(1000000);
  const selected: { sourceIndex: number }[] = [];
  element.addEventListener('lr-source-point-select', event => selected.push((event as CustomEvent).detail));
  (element.shadowRoot!.querySelectorAll('tbody button').item(element.shadowRoot!.querySelectorAll('tbody button').length - 1) as HTMLButtonElement).click();
  expect(selected.at(-1)!.sourceIndex).to.equal(999999);
  expect(peer.data.datasets[0]!.data!.length).to.be.at.most(1000);
  expect(element.shadowRoot!.querySelectorAll('tbody tr').length).to.be.at.most(1000);
  expect(element.shadowRoot!.querySelector('[part="description"]')?.textContent).to.include('1,000,000');
  reads.length = 0;
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 765432 })).to.equal(true);
  expect(reads).to.deep.equal([[765432, 1]]);
  await element.updateComplete;
  expect(element.shadowRoot!.textContent).to.include('765432');
  const buttons = element.shadowRoot!.querySelectorAll<HTMLButtonElement>('tbody button');
  buttons.item(buttons.length - 1).click();
  expect(selected.at(-1)!.sourceIndex).to.equal(765432);
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 999999 })).to.equal(true);
  expect(reads.at(-1)).to.deep.equal([999999, 1]);
  recordScaleMeasurement('lr-chart', 'prepared-series@1000000:mount-reveal', {
    sourcePositions: count, preparationReadPositions: count, exactReadPositions: reads.reduce((sum, [, count]) => sum + count, 0),
    peerEntries: element.chart!.data.datasets.reduce((sum, dataset) => sum + (dataset.data?.length ?? 0), 0),
    tableRows: element.shadowRoot!.querySelectorAll('tbody tr').length, domNodes: renderedNodeCount(element),
  });
  reads.length = 0;
  element.height = '310px';
  await element.updateComplete;
  expect(reads).to.have.length(0);
});

it('renders a million-observation category aggregate and emits category provenance', async function () {
  this.timeout(15000);
  const prepared = await prepareLyraCategoryData({ revision: 'r', count: 1_000_000, read: (start, count) => Array.from({ length: count }, (_, offset) => (start + offset) % 2) }, {
    categories: [{ id: 'a', label: 'A' }, { id: 'other', label: 'Other' }], seriesId: 's', seriesLabel: 'Count',
    aggregation: 'count', categoryOf: value => value ? 'other' : 'a', batchSize: 8192,
  });
  const element = await fixture<PreparedChart>(html`<lr-chart type="pie" without-animation with-data-table .preparedData=${prepared}></lr-chart>`);
  await waitUntil(() => element.shadowRoot?.querySelector('table')?.textContent?.includes('500,000') === true, 'aggregate table missing', { timeout: 5000 });
  await waitUntil(() => element.chart !== undefined, 'peer missing', { timeout: 5000 });
  expect(element.chart!.data.datasets[0]!.data).to.deep.equal([500000, 500000]);
  expect(element.exportData('csv')).to.include('500000');
  const selected: unknown[] = [];
  element.addEventListener('lr-source-category-select', event => selected.push((event as CustomEvent).detail));
  element.shadowRoot!.querySelectorAll<HTMLButtonElement>('tbody button').item(1).click();
  expect(selected[0]).to.deep.equal({ revision: 'r', seriesId: 's', categoryId: 'other', value: 500000, observationCount: 500000 });
  recordScaleMeasurement('lr-chart', 'prepared-categories@1000000:mount-activate', {
    sourcePositions: 1000000, aggregatedObservations: prepared.categoryCounts.reduce((sum, count) => sum + count, 0),
    peerEntries: element.chart!.data.datasets[0]!.data!.length, tableRows: element.shadowRoot!.querySelectorAll('tbody tr').length,
    domNodes: renderedNodeCount(element),
  });
  await expect(element).to.be.accessible();
});

async function smallPrepared(): Promise<LyraPreparedSeriesData> {
  return prepareLyraSeriesData([{ id: 's', label: 'Small', input: {
    revision: 'r', count: 1000, read: (start, count) => Array.from({ length: count }, (_, offset) => ({ x: start + offset, y: (start + offset) % 10 })),
  } }], { maxPointsPerSeries: 20 });
}
async function mounted(source: LyraPreparedSeriesData): Promise<PreparedChart> {
  const element = await fixture<PreparedChart>(html`<lr-chart type="line" without-animation with-data-table .preparedData=${source}></lr-chart>`);
  await waitUntil(() => element.chart !== undefined, 'peer missing', { timeout: 5000 });
  return element;
}

it('uses optional bounded indexed refinement around a revealed source point', async () => {
  const source = await smallPrepared();
  const ranges: { startIndex: number; endIndex: number; maxPoints: number }[] = [];
  const prepared: LyraPreparedSeriesData = { ...source, queryRange(request) {
    ranges.push(request);
    return [{ x: 498, y: 8, sourceIndex: 498, breakBefore: true }, { x: 500, y: 0, sourceIndex: 500, breakBefore: false }];
  } };
  const element = await mounted(prepared);
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 })).to.equal(true);
  expect(ranges).to.have.length(1);
  expect(ranges[0]!.startIndex).to.be.at.most(500);
  expect(ranges[0]!.endIndex).to.be.greaterThan(500);
  expect(ranges[0]!.maxPoints).to.be.at.most(499);
  await element.updateComplete;
  expect(element.shadowRoot!.textContent).to.include('498');
});

it('retains old-view actions while an exact point is pending and rejects obsolete completion', async () => {
  const source = await smallPrepared();
  let resolve!: (point: { x: number; y: number }) => void;
  let aborted = false;
  const prepared: LyraPreparedSeriesData = { ...source, getPoint(_ref, request) {
    request.signal.addEventListener('abort', () => { aborted = true; });
    return new Promise(done => { resolve = done; });
  } };
  const element = await mounted(prepared);
  const events: unknown[] = [];
  element.addEventListener('lr-source-point-select', event => events.push((event as CustomEvent).detail));
  const pending = element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 });
  await element.updateComplete;
  expect(element.getAttribute('aria-busy')).to.equal('true');
  (element.shadowRoot!.querySelector('tbody button') as HTMLButtonElement).click();
  expect(events[0]).to.deep.equal({ revision: 'r', seriesId: 's', sourceIndex: 0, point: { x: 0, y: 0 } });
  element.preparedData = { ...source, revision: 'new' };
  (element.shadowRoot!.querySelector('tbody button') as HTMLButtonElement).click();
  expect((events.at(-1) as { revision: string }).revision).to.equal('r');
  await element.updateComplete;
  expect(aborted).to.equal(true);
  expect(await pending).to.equal(false);
  resolve({ x: 500, y: 0 });
  await Promise.resolve();
  expect(element.shadowRoot!.textContent).not.to.include('500:');
  (element.shadowRoot!.querySelector('tbody button') as HTMLButtonElement).click();
  expect((events.at(-1) as { revision: string }).revision).to.equal('new');
});

it('revalidates same-reference assignments and coalesced keyless mutable refreshes', async () => {
  const original = await smallPrepared();
  const source = { ...original, revision: 'first', series: original.series.map(series => ({ ...series })) };
  const element = await mounted(source);
  const events: { revision: string }[] = [];
  element.addEventListener('lr-source-point-select', event => events.push((event as CustomEvent).detail));
  source.revision = 'second';
  source.series[0]!.label = 'Reassigned label';
  element.preparedData = source;
  await element.updateComplete;
  (element.shadowRoot!.querySelector('tbody button') as HTMLButtonElement).click();
  expect(events.at(-1)!.revision).to.equal('second');
  expect(element.shadowRoot!.textContent).to.include('Reassigned label');
  source.revision = 'third';
  element.requestUpdate();
  element.height = '320px';
  await element.updateComplete;
  (element.shadowRoot!.querySelector('tbody button') as HTMLButtonElement).click();
  expect(events.at(-1)!.revision).to.equal('third');
});

it('does not read legacy data while prepared rendering/export/style paths are active', async () => {
  const element = await mounted(await smallPrepared());
  let reads = 0;
  Object.defineProperty(element, 'labels', { configurable: true, get() { reads++; throw new Error('Legacy labels read'); } });
  Object.defineProperty(element, 'datasets', { configurable: true, get() { reads++; throw new Error('Legacy datasets read'); } });
  try {
    element.requestUpdate();
    element.height = '330px';
    await element.updateComplete;
    expect(element.exportData('csv')).to.include('Small');
    element.appendData('ignored', [4]);
    expect(reads).to.equal(0);
  } finally {
    delete (element as Partial<PreparedChart>).labels;
    delete (element as Partial<PreparedChart>).datasets;
  }
});

it('keeps real line and fill segments separated and charges the overlay peer entries', async () => {
  const source = await smallPrepared();
  const samples = source.series[0]!.samples.map((point, index) => ({ ...point, breakBefore: index === 0 || index === 5 }));
  const prepared = { ...source, series: [{ ...source.series[0]!, samples }] };
  const element = await mounted(prepared);
  element.area = true;
  await element.updateComplete;
  const meta = element.chart!.getDatasetMeta!(0) as unknown as { dataset: { segments: { start: number; end: number }[] }; data: { skip: boolean }[] };
  expect(meta.data[5]!.skip).to.equal(true);
  expect(meta.dataset.segments).to.have.length(2);
  expect(element.chart!.data.datasets[0]!.fill).to.equal(true);
  const before = element.chart!.data.datasets[0]!.data!.length;
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 })).to.equal(true);
  await element.updateComplete;
  expect(element.chart!.data.datasets[0]!.data).to.have.length(before + 2);
});

it('aborts pending point reads on keyless refresh and disconnect, then reconnects cleanly', async () => {
  const source = await smallPrepared();
  const signals: AbortSignal[] = [];
  const prepared = { ...source, getPoint(_ref: unknown, request: { signal: AbortSignal }) { signals.push(request.signal); return new Promise<null>(() => {}); } };
  const element = await mounted(prepared);
  const first = element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 });
  element.requestUpdate(); element.height = '340px';
  expect(await first).to.equal(false);
  expect(signals[0]!.aborted).to.equal(true);
  await element.updateComplete;
  const second = element.revealSourcePoint({ seriesId: 's', sourceIndex: 600 });
  const parent = element.parentElement!;
  element.remove();
  expect(await second).to.equal(false);
  expect(signals[1]!.aborted).to.equal(true);
  element.preparedData = source;
  parent.append(element);
  await waitUntil(() => element.chart !== undefined);
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 700 })).to.equal(true);
});

it('shows translated admission failures and restores the unchanged legacy route when unset', async () => {
  const element = await fixture<PreparedChart>(html`<lr-chart type="line" without-animation with-data-table .labels=${['First', 'Last']} .datasets=${[{ label: 'Legacy', data: [3, 8] }]}></lr-chart>`);
  await waitUntil(() => element.chart !== undefined);
  const exported = element.exportData('csv');
  element.preparedData = await smallPrepared();
  await element.updateComplete;
  expect(element.shadowRoot!.textContent).to.include('Small');
  element.maxRecords = 5;
  element.strings = { chartPreparedUnavailable: 'Summary rejected' };
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Summary rejected');
  element.preparedData = null;
  element.maxRecords = 1000;
  await element.updateComplete;
  expect(element.exportData('csv')).to.equal(exported);
  expect(element.shadowRoot!.textContent).to.include('Legacy');
});

it('rejects malformed indexed refinements and preserves the completed view', async () => {
  const source = await smallPrepared();
  const element = await mounted({ ...source, queryRange: request => [{ x: 0, y: 0, sourceIndex: request.endIndex, breakBefore: true }] });
  const before = element.exportData('csv');
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 })).to.equal(false);
  await element.updateComplete;
  expect(element.exportData('csv')).to.equal(before);
  expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.include('Prepared chart data');
});

it('invalidates pending reads across owner-document adoption', async () => {
  const source = await smallPrepared();
  let signal: AbortSignal | undefined;
  const element = await mounted({ ...source, getPoint(_ref, request) { signal = request.signal; return new Promise(() => {}); } });
  const pending = element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 });
  const target = document.implementation.createHTMLDocument('Adopted chart');
  target.body.append(element);
  expect(await pending).to.equal(false);
  expect(signal!.aborted).to.equal(true);
  element.remove();
});

it('retains typed-tag writable type compatibility for each prepared kind', async function () {
  this.timeout(15000);
  await Promise.all([
    import('./line-chart.js'), import('./bar-chart.js'), import('./pie-chart.js'), import('./doughnut-chart.js'),
    import('./radar-chart.js'), import('./polar-area-chart.js'), import('./scatter-chart.js'), import('./bubble-chart.js'),
  ]);
  const { tag } = await import('../../../internal/prefix.js');
  const prepared = await smallPrepared();
  const category = await prepareLyraCategoryData({ revision: 'r', count: 2, read: () => [0, 1] }, {
    categories: [{ id: 'a', label: 'A' }], seriesId: 's', seriesLabel: 'Counts', categoryOf: () => 'a', aggregation: 'count',
  });
  const host = await fixture<HTMLDivElement>(html`<div></div>`);
  for (const name of ['line', 'bar', 'pie', 'doughnut', 'radar', 'polar-area', 'scatter', 'bubble']) {
    const element = document.createElement(tag(`${name}-chart`)) as PreparedChart;
    element.withoutAnimation = true;
    element.preparedData = ['line', 'bar', 'scatter', 'bubble'].includes(name) ? prepared : category;
    host.append(element);
    await element.updateComplete;
    if (name === 'scatter' || name === 'bubble') expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.include('Prepared chart data');
    else await waitUntil(() => element.chart !== undefined, `${name} peer missing`, { timeout: 5000 });
    element.type = 'line';
    element.preparedData = prepared;
    await element.updateComplete;
    await waitUntil(() => element.chart?.config.type === 'line', `${name} writable type failed`, { timeout: 5000 });
    element.remove();
  }
});


it('keeps the full-source endpoint trend when an interior exact point is overlaid', async () => {
  const element = await mounted(await smallPrepared());
  expect(element.shadowRoot!.querySelector('[part="description"]')?.textContent).to.include('increasing trend');
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 })).to.equal(true);
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="description"]')?.textContent).to.include('increasing trend');
});


it('activates prepared observations from the focused canvas keyboard route', async () => {
  const element = await mounted(await smallPrepared());
  const events: { sourceIndex: number }[] = [];
  element.addEventListener('lr-source-point-select', event => events.push((event as CustomEvent).detail));
  await focusByKeyboard(element.shadowRoot!.querySelector('canvas')!);
  await sendKeys({ press: 'ArrowRight' });
  await sendKeys({ press: 'Enter' });
  expect(events.at(-1)!.sourceIndex).to.equal(element.preparedData!.kind === 'series' ? element.preparedData!.series[0]!.samples[1]!.sourceIndex : -1);
});

it('keeps zero and all-invalid prepared sources as valid empty summaries', async () => {
  for (const count of [0, 10]) {
    const prepared = await prepareLyraSeriesData([{ id: 'empty', label: 'Empty', input: { revision: 'r', count, read: (_start, size) => Array.from({ length: size }, () => ({ x: NaN, y: null })) } }]);
    const element = await mounted(prepared);
    expect(element.shadowRoot!.querySelector('[part="error"]')).to.equal(null);
    expect(element.chart!.data.datasets[0]!.data).to.have.length(0);
    expect(element.shadowRoot!.querySelector('[part="description"]')?.textContent).to.include('0 valid observations');
    element.remove();
  }
});


it('bounds multi-series refinement by the rectangular table capacity before requesting', async () => {
  const original = await smallPrepared();
  let requested = 0;
  const source: LyraPreparedSeriesData = { ...original, getPoint: ref => ({ x: ref.sourceIndex, y: 1 }),
    series: Array.from({ length: 50 }, (_, index) => ({ ...original.series[0]!, id: `s${index}`, samples: [original.series[0]!.samples[0]!] })),
    queryRange(request) {
      requested = request.maxPoints;
      return Array.from({ length: request.maxPoints }, (_, index) => ({ x: request.startIndex + index, y: 1, sourceIndex: request.startIndex + index, breakBefore: true }));
    },
  };
  const element = await mounted(source);
  expect(await element.revealSourcePoint({ seriesId: 's0', sourceIndex: 500 })).to.equal(true);
  await element.updateComplete;
  expect(requested).to.be.greaterThan(0);
  expect((requested * 2 - 1 + 2) * 50).to.be.at.most(1000);
  expect(element.chart!.data.datasets.reduce((sum, series) => sum + (series.data?.length ?? 0), 0)).to.be.at.most(1000);
  expect(element.shadowRoot!.querySelectorAll('tbody td').length).to.be.at.most(1000);
});

for (const rebuild of [false, true]) it(`rejects retained peer callbacks after ${rebuild ? 'type rebuild and destruction' : 'prepared replacement'}`, async () => {
  const source = await smallPrepared();
  const element = await mounted(source);
  const oldPeer = element.chart!;
  const oldCallback = oldPeer.options['onClick'] as (event: unknown, elements: unknown[], peer: typeof oldPeer) => void;
  const oldHitTest = oldPeer.getElementsAtEventForMode;
  oldPeer.getElementsAtEventForMode = () => [{ datasetIndex: 0, index: 0 }];
  const revisions: unknown[] = [];
  element.addEventListener('lr-source-point-select', event => revisions.push((event as CustomEvent).detail.revision));
  try {
    element.preparedData = { ...source, revision: 'replacement' };
    if (rebuild) element.type = 'bar';
    oldCallback({}, [], oldPeer);
    expect(revisions).to.deep.equal(['r']);
    await element.updateComplete;
    await waitUntil(() => (element.chart!.options['onClick'] as unknown) !== oldCallback, 'peer callback did not refresh');
    oldCallback({}, [], oldPeer);
    expect(revisions).to.deep.equal(['r']);
    const currentPeer = element.chart!;
    const currentHitTest = currentPeer.getElementsAtEventForMode;
    currentPeer.getElementsAtEventForMode = () => [{ datasetIndex: 0, index: 0 }];
    try {
      const currentCallback = currentPeer.options['onClick'] as typeof oldCallback;
      currentCallback({}, [], currentPeer);
      expect(revisions).to.deep.equal(['r', 'replacement']);
      element.remove();
      currentCallback({}, [], currentPeer);
      expect(revisions).to.deep.equal(['r', 'replacement']);
    } finally { currentPeer.getElementsAtEventForMode = currentHitTest; }
  } finally { oldPeer.getElementsAtEventForMode = oldHitTest; }
});
