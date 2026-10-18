import { sendKeys } from '@web/test-runner-commands';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import './scatter-chart.js';
import './bubble-chart.js';
import './lite-chart.js';
import type { LyraChart } from './chart.class.js';
import type { LyraSpatialChartSource, LyraSpatialChartPoint } from '../../../utilities/data-spatial.js';
const bounds = { minX: -Number.MAX_VALUE, maxX: Number.MAX_VALUE, minY: 0, maxY: 100 };
const point: LyraSpatialChartPoint = { id: 'middle', sourceIndex: 500000, seriesId: 's', x: 0, y: 50, radius: 10, label: 'Middle' };
function source(): LyraSpatialChartSource {
  return { kind: 'spatial', revision: 'r', count: 1000000, bounds, series: [{ id: 's', label: 'Signal' }, { id: 'empty', label: 'Empty series' }], radiusDomain: { min: 1, max: Number.MAX_VALUE },
    query: () => ({ matchedCount: 1000000, bins: [{ bounds: { ...bounds, maxY: 99 }, count: 999999 }, { bounds: { ...bounds, minY: 99 }, count: 1 }], points: [point] }),
    getPoint: id => ({ ...point, id, sourceIndex: 999999, x: Number.MAX_VALUE, y: 100, radius: Number.MAX_VALUE }),
  };
}
async function mounted(input = source()) {
  const element = await fixture<LyraChart>(html`<lr-chart type="bubble" without-animation with-data-table style="width:600px" .preparedData=${input}></lr-chart>`);
  await waitUntil(() => !!element.chart || !!element.shadowRoot?.querySelector('[part="error"]'), 'chart did not settle', { timeout: 5000 });
  return element;
}
it('renders bounded full-source density and original bubble radius through table and CSV', async () => {
  const calls: unknown[] = []; const input = source(); const query = input.query, getPoint = input.getPoint; let lookups = 0;
  input.getPoint = (id, request) => { lookups++; return getPoint(id, request); };
  input.query = request => { calls.push(request); return query(request); };
  const element = await mounted(input);
  expect(element.chart !== undefined).to.equal(true);
  expect(calls).to.have.length(1);
  expect(calls[0]).to.include({ maxPoints: 499, maxBins: 499 });
  expect(element.chart!.data.datasets).to.have.length(2);
  expect(element.chart!.data.datasets[0]!.data![0]).to.include({ x: 0.5, y: 0.5, r: 10 });
  expect(element.shadowRoot!.querySelectorAll('tbody td')).to.have.length(3);
  expect(element.exportData('csv')).to.include('kind,seriesId,seriesLabel,id,sourceIndex,label,x,y,radius,minX,maxX,minY,maxY,count');
  expect(element.exportData('csv')).to.include('middle,500000,Middle,0,50,10');
  expect(await element.revealSourcePoint('last')).to.equal(true);
  expect(element.exportData('csv')).to.include(String(Number.MAX_VALUE));
  const radii = element.chart!.data.datasets[0]!.data!.map(value => (value as { r: number }).r);
  expect(radii.every(Number.isFinite)).to.equal(true); expect(Math.max(...radii)).to.be.lessThan(Number.MAX_VALUE);
  recordScaleMeasurement('lr-chart', 'spatial-bubble@1000000:mount-reveal', {
    sourcePositions: 1000000, queryCalls: calls.length, exactLookupCalls: lookups, bins: element.shadowRoot!.querySelectorAll('[data-spatial-bin]').length,
    peerEntries: element.chart!.data.datasets.reduce((sum, dataset) => sum + dataset.data!.length, 0),
    tableCells: element.shadowRoot!.querySelectorAll('tbody td').length, domNodes: renderedNodeCount(element),
  });
});
it('activates stable point/bin identities with representative-only legacy events', async () => {
  const element = await mounted(); const events: unknown[] = []; const bins: unknown[] = []; let legacy = 0;
  element.addEventListener('lr-spatial-point-select', event => events.push((event as CustomEvent).detail));
  element.addEventListener('lr-spatial-bin-select', event => bins.push((event as CustomEvent).detail));
  element.addEventListener('lr-point-activate', () => legacy++);
  const button = element.shadowRoot!.querySelector<HTMLButtonElement>('tbody [data-spatial-id="middle"]');
  expect(button !== null).to.equal(true); button!.click();
  expect(events[0]).to.deep.equal({ revision: 'r', point }); expect(legacy).to.equal(1);
  element.shadowRoot!.querySelector<HTMLButtonElement>('tbody [data-spatial-bin="1"]')!.click();
  expect((bins[0] as { count: number }).count).to.equal(1);
  expect(await element.revealSourcePoint('last')).to.equal(true); await element.updateComplete;
  element.shadowRoot!.querySelector<HTMLButtonElement>('tbody [data-spatial-id="last"]')!.click();
  expect(legacy).to.equal(1); expect(events).to.have.length(2);
});

it('uses declared series and original formatter metadata while source geometry wins raw configuration', async () => {
  const element = await mounted(); const seen: unknown[] = [];
  element.config = { type: 'bubble', data: { labels: ['ignored'], datasets: [{ label: 'Raw', data: [999] }] }, options: { indexAxis: 'y', scales: { x: { type: 'logarithmic', min: 12, max: 13 } } } };
  element.formatter = context => context.surface === 'tick' ? `tick:${context.value}` : String(context.value);
  element.tooltipTitleFormatter = contexts => { seen.push(contexts[0]); return 'Original title'; };
  await element.updateComplete;
  await waitUntil(() => element.getAttribute('aria-busy') === 'false'); await element.updateComplete;
  const options = element.chart!.options as { scales: { x: { type: string; min: number; max: number; ticks: { callback(value: number): unknown } } }; indexAxis: string; plugins: { tooltip: { callbacks: { title(value: unknown[]): string } } } };
  expect(options.indexAxis).to.equal('x'); expect(options.scales.x).to.include({ type: 'linear', min: 0, max: 1 });
  expect(element.chart!.data.datasets[0]!.label).to.equal('Signal');
  expect(options.scales.x.ticks.callback(1)).to.equal(`tick:${Number.MAX_VALUE}`);
  expect(options.plugins.tooltip.callbacks.title([{ datasetIndex: 0, dataIndex: 0 }])).to.equal('Original title');
  expect(seen[0]).to.include({ value: 50, index: 500000, seriesLabel: 'Signal', surface: 'tooltip' });
});

it('retains full density when series is hidden and does not mutate selection during reveal', async () => {
  const element = await mounted(); element.selectedPointId = 'selected'; await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.querySelector('[data-spatial-id="selected"]') !== null);
  element.hiddenDatasets = [0]; await element.updateComplete;
  expect(await element.revealSourcePoint('last')).to.equal(false);
  expect(element.selectedPointId).to.equal('selected');
  expect(element.shadowRoot!.querySelectorAll('[data-spatial-bin]')).to.have.length(2);
  expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('1,000,000');
  expect(element.shadowRoot!.querySelector('[data-spatial-id="selected"]')!.textContent).to.include('series hidden');
  expect(element.exportData('csv')).to.include('selected');
});

it('rejects unsupported type, logarithmic scale and source-only minimum while leaving raw budget two usable', async () => {
  const raw = await fixture<LyraChart>(html`<lr-chart type="scatter" .maxRecords=${2} .datasets=${[{ label: 'Raw', points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] }]}></lr-chart>`);
  await waitUntil(() => raw.chart !== undefined); expect(raw.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  const element = await mounted();
  element.maxRecords = 2; await element.updateComplete; expect(element.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  element.maxRecords = 1000; element.scaleType = 'logarithmic'; await element.updateComplete; expect(element.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  element.scaleType = 'linear'; element.type = 'bar'; await element.updateComplete; expect(element.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  element.preparedData = null; await element.updateComplete; expect(element.shadowRoot!.textContent).not.to.include('Prepared data is unavailable');
});

it('routes scatter and bubble subclasses and visibly rejects lite spatial input', async () => {
  const scatter = await fixture<LyraChart>(html`<lr-scatter-chart without-animation .preparedData=${source()}></lr-scatter-chart>`);
  const bubble = await fixture<LyraChart>(html`<lr-bubble-chart without-animation .preparedData=${source()}></lr-bubble-chart>`);
  const lite = await fixture<HTMLElement>(html`<lr-lite-chart .preparedData=${source()}></lr-lite-chart>`);
  await waitUntil(() => !!scatter.chart && !!bubble.chart);
  expect(scatter.chart!.config.type).to.equal('scatter'); expect(bubble.chart!.config.type).to.equal('bubble');
  expect(lite.shadowRoot!.querySelector('[part="description"]')!.textContent!.trim().length).to.be.greaterThan(0);
  expect(lite.shadowRoot!.querySelector('svg') === null).to.equal(true);
});

it('invalidates detached table and peer callbacks immediately on replacement and source clear', async () => {
  const element = await mounted(); let count = 0;
  element.addEventListener('lr-spatial-point-select', () => count++); element.addEventListener('lr-spatial-bin-select', () => count++);
  const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[data-spatial-id="middle"]')!;
  const bin = element.shadowRoot!.querySelector<HTMLButtonElement>('[data-spatial-bin="1"]')!;
  const click = element.chart!.options['onClick'] as (event: unknown, hits: unknown, chart: unknown) => void;
  const peer = element.chart!;
  element.preparedData = { ...source(), revision: 'new' };
  button.click(); bin.click(); click({ x: 5, y: 5 }, [], peer); expect(count).to.equal(0);
  await element.updateComplete; await waitUntil(() => element.shadowRoot!.querySelector('[data-spatial-id="middle"]') !== null);
  button.click(); bin.click(); expect(count).to.equal(0);
  element.preparedData = null; await element.updateComplete; click({}, [], peer); expect(count).to.equal(0);
});

it('keeps source/style/table operations independent of raw arrays and does not requery on resize', async () => {
  let queries = 0; const input = source(), query = input.query; input.query = request => { queries++; return query(request); };
  const element = await mounted(input); const before = queries; let reads = 0;
  Object.defineProperty(element, 'labels', { configurable: true, get() { reads++; throw new Error('Raw labels'); } });
  Object.defineProperty(element, 'datasets', { configurable: true, get() { reads++; throw new Error('Raw datasets'); } });
  try {
    element.height = '320px'; element.xLabel = 'Horizontal'; await element.updateComplete;
    element.exportData('csv'); element.appendData('ignored', [1]);
    expect(queries).to.equal(before); expect(reads).to.equal(0);
  } finally { delete (element as Partial<LyraChart>).labels; delete (element as Partial<LyraChart>).datasets; }
});

it('pans an explicit viewport to an exact point while retaining the independent selected slot', async () => {
  const requests: { bounds: { minX: number; maxX: number; minY: number; maxY: number } }[] = [];
  const small = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
  const input: LyraSpatialChartSource = { ...source(), bounds: small,
    query: request => { requests.push(request); return { matchedCount: 5, bins: [{ bounds: request.bounds, count: 5 }], points: [] }; },
    getPoint: id => ({ ...point, id, x: id === 'selected' ? 10 : 90, y: 50 }),
  };
  const element = await mounted(input); element.viewport = { minX: 0, maxX: 20, minY: 40, maxY: 60 }; element.selectedPointId = 'selected'; await element.updateComplete;
  let activated = 0; element.addEventListener('lr-spatial-point-select', () => activated++);
  expect(await element.revealSourcePoint('last')).to.equal(true); await element.updateComplete;
  expect(element.viewport).to.deep.equal({ minX: 70, maxX: 90, minY: 40, maxY: 60 }); expect(element.selectedPointId).to.equal('selected');
  expect(element.shadowRoot!.querySelectorAll('[data-spatial-id]')).to.have.length(2); expect(activated).to.equal(0);
  expect(requests.at(-1)!.bounds).to.deep.equal(element.viewport);
});

it('preserves collapsed global axes without invented semantic tick precision', async () => {
  const collapsed = { minX: 7, maxX: 7, minY: 8, maxY: 8 };
  const element = await mounted({ ...source(), bounds: collapsed, query: () => ({ matchedCount: 1000000, bins: [{ bounds: collapsed, count: 1000000 }], points: [{ ...point, x: 7, y: 8 }] }) });
  const scales = element.chart!.options['scales'] as { x: { ticks: { callback(value: number): unknown }; afterBuildTicks(scale: { ticks: { value: number }[] }): void } };
  expect(scales.x.ticks.callback(0.5)).to.equal('7'); const state = { ticks: [] }; scales.x.afterBuildTicks(state); expect(state.ticks).to.deep.equal([{ value: 0.5 }]);
  expect(element.exportData('csv')).to.include('Middle,7,8,10');
  await expect(element).to.be.accessible();
});


it('cancels an older pan reveal promptly without releasing an ignored-abort query permit', async () => {
  let queries = 0, finish!: (result: { matchedCount: number; bins: { bounds: typeof bounds; count: number }[]; points: LyraSpatialChartPoint[] }) => void;
  const input: LyraSpatialChartSource = { ...source(), bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
    query: request => { queries++; const response = { matchedCount: 1, bins: [{ bounds: request.bounds, count: 1 }], points: [] };
      return queries < 3 ? response : new Promise(resolve => { finish = resolve; }); },
    getPoint: id => ({ ...point, id, x: id === 'first' ? 90 : 80, y: 50 }),
  };
  const element = await mounted(input); element.viewport = { minX: 0, maxX: 20, minY: 40, maxY: 60 }; await element.updateComplete;
  await waitUntil(() => element.getAttribute('aria-busy') === 'false');
  let old: boolean | undefined; const first = element.revealSourcePoint('first').then(value => { old = value; });
  await waitUntil(() => queries === 3);
  const second = element.revealSourcePoint('second'); await waitUntil(() => old !== undefined);
  expect(old).to.equal(false); expect(queries).to.equal(3);
  element.remove(); expect(await second).to.equal(false); await first;
  finish({ matchedCount: 0, bins: [], points: [] }); await Promise.resolve(); expect(queries).to.equal(3);
});

it('keeps newest source authority when a kind descriptor reenters replacement', async () => {
  const element = await mounted(); let replaced = false;
  const replacement = { ...source(), revision: 'replacement' };
  const prior = new Proxy(source(), { getOwnPropertyDescriptor(target, key) {
    if (key === 'kind' && !replaced) { replaced = true; element.preparedData = replacement; }
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  element.preparedData = prior; await element.updateComplete;
  await waitUntil(() => element.getAttribute('aria-busy') === 'false'); await element.updateComplete;
  let revision: unknown; element.addEventListener('lr-spatial-point-select', event => { revision = (event as CustomEvent).detail.revision; });
  element.shadowRoot!.querySelector<HTMLButtonElement>('[data-spatial-id="middle"]')!.click(); expect(revision).to.equal('replacement');
});

it('covers density regions in keyboard navigation and routes localized source strings to the DOM', async () => {
  const element = await mounted(); element.dir = 'rtl';
  element.strings = { chartSpatialSummary: 'Source {count}; view {matchedCount}', chartSpatialBin: 'Region {count}', chartSpatialDensityLegend: 'All series density', chartSpatialPoint: 'Original {id}' };
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('Source 1,000,000');
  expect(element.shadowRoot!.textContent).to.include('All series density');
  await waitUntil(() => element.getAttribute('aria-busy') === 'false' && element.shadowRoot!.querySelector('[data-spatial-id="middle"]') !== null);
  expect(element.shadowRoot!.querySelector('[data-spatial-id="middle"]')!.textContent).to.equal('Original middle');
  let selected: unknown; element.addEventListener('lr-spatial-bin-select', event => { selected = (event as CustomEvent).detail; });
  await focusByKeyboard(element.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!);
  await sendKeys({ press: 'End' }); await sendKeys({ press: 'Enter' }); expect(selected).to.include({ revision: 'r', count: 1 });
  await expect(element).to.be.accessible();
});


it('allocates one bin and two exact slots at the spatial minimum without oversampling', async () => {
  let quotas: unknown;
  const input: LyraSpatialChartSource = { ...source(), query: request => { quotas = request; return { matchedCount: 1000000, bins: [{ bounds: request.bounds, count: 1000000 }], points: [] }; } };
  const element = await fixture<LyraChart>(html`<lr-chart type="bubble" without-animation with-data-table .maxRecords=${3} .preparedData=${input} .selectedPointId=${'selected'}></lr-chart>`);
  await waitUntil(() => !!element.chart && element.getAttribute('aria-busy') === 'false');
  expect(await element.revealSourcePoint('last')).to.equal(true); await element.updateComplete;
  expect(quotas).to.include({ maxBins: 1, maxPoints: 0 }); expect(element.shadowRoot!.querySelectorAll('tbody td')).to.have.length(3);
  expect(element.chart!.data.datasets.reduce((sum, dataset) => sum + dataset.data!.length, 0)).to.equal(2);
});

it('restores global viewport on reset and retains source geometry during x zoom', async () => {
  const input: LyraSpatialChartSource = { ...source(), bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
    query: request => ({ matchedCount: 100, bins: [{ bounds: request.bounds, count: 100 }], points: [] }) };
  const element = await mounted(input); element.zoomable = true; await element.updateComplete;
  await waitUntil(() => !!(element.chart!.options['plugins'] as { zoom?: unknown }).zoom);
  const zoom = (element.chart!.options['plugins'] as { zoom: { zoom: { onZoomComplete(value: unknown): void } } }).zoom.zoom;
  zoom.onZoomComplete({ chart: { scales: { x: { min: 0.2, max: 0.4 } } } });
  await element.updateComplete; await waitUntil(() => element.getAttribute('aria-busy') === 'false');
  expect(element.viewport).to.deep.equal({ minX: 20, maxX: 40, minY: 0, maxY: 100 });
  element.resetZoom(); await element.updateComplete; await waitUntil(() => element.getAttribute('aria-busy') === 'false');
  expect(element.viewport).to.equal(null);
});

it('stops legacy aliases after a spatial selection listener clears the source', async () => {
  const element = await mounted(); let legacy = 0; const errors: string[] = [];
  const onError = (event: ErrorEvent) => { errors.push(event.message); event.preventDefault(); };
  window.addEventListener('error', onError);
  try {
    element.addEventListener('lr-spatial-point-select', () => { element.preparedData = null; });
    element.addEventListener('lr-point-activate', () => legacy++);
    element.shadowRoot!.querySelector<HTMLButtonElement>('tbody [data-spatial-id="middle"]')!.click();
    expect(errors).to.deep.equal([]); expect(legacy).to.equal(0);
  } finally { window.removeEventListener('error', onError); }
});
it('stops the datum alias after a legacy point listener clears the source', async () => {
  const element = await mounted(); let aliases = 0;
  element.addEventListener('lr-point-activate', () => { element.preparedData = null; });
  element.addEventListener('lr-datum-activate', () => aliases++);
  element.shadowRoot!.querySelector<HTMLButtonElement>('tbody [data-spatial-id="middle"]')!.click();
  expect(aliases).to.equal(0);
});
it('reports reveal cancellation when canvas focus clears the source', async () => {
  const element = await mounted();
  element.shadowRoot!.querySelector('canvas')!.addEventListener('focus', () => { element.preparedData = null; }, { once: true });
  expect(await element.revealSourcePoint('last')).to.equal(false);
});
