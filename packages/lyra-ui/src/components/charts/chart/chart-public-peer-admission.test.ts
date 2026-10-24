import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { loadChartJs } from './chart-core-loader.js';
import type { LyraChart } from './chart.class.js';
import type { LyraPreparedSeriesData, LyraSeriesSample } from '../../../utilities/data-preparation.js';
import type { LyraSpatialChartSource } from '../../../utilities/data-spatial.js';
import './chart.js';

async function ready(element: LyraChart): Promise<void> {
  await element.updateComplete;
  await waitUntil(() => element.chart !== undefined && element.getAttribute('aria-busy') === 'false', 'chart did not settle', { timeout: 5_000 });
  await element.updateComplete;
}

async function mount(): Promise<LyraChart> {
  const element = await fixture<LyraChart>(html`<lr-chart without-animation with-data-table
    style="inline-size:500px;block-size:260px" .labels=${['Only']}
    .datasets=${[{ label: 'Retained', data: [3] }]}
    .formatter=${({ value }: { value: number }) => String(value)}></lr-chart>`);
  await ready(element);
  return element;
}

async function generatedLabels(element: LyraChart, reply: unknown): Promise<unknown[]> {
  const module = await loadChartJs();
  const labels = module?.defaults.plugins?.legend?.labels;
  if (!labels?.generateLabels || !element.chart) throw new Error('Chart legend peer is unavailable');
  const original = labels.generateLabels;
  const chart = element.chart;
  const options = chart.options as unknown as { plugins: { legend: { labels: { generateLabels(chart: object): unknown[] } } } };
  labels.generateLabels = () => reply as unknown[];
  try {
    return options.plugins.legend.labels.generateLabels(chart);
  } finally {
    labels.generateLabels = original;
  }
}

async function usable(element: LyraChart): Promise<void> {
  const events: unknown[] = [];
  element.addEventListener('lr-legend-visibility-change', event => events.push(event.detail), { once: true });
  const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="legend-item"]')!;
  expect(button.textContent).to.include('Retained');
  button.click();
  await element.updateComplete;
  expect(events).to.deep.equal([{ datasetIndex: 0, visible: false, hiddenDatasets: [0] }]);
  expect(element.hiddenDatasets).to.deep.equal([0]);
  expect(element.exportData('csv')).to.include('Only,3');
  element.hiddenDatasets = [];
  await element.updateComplete;
  await waitUntil(() => element.chart?.isDatasetVisible(0) === true);
  expect(element.shadowRoot!.querySelector('[part~="legend-item"]')?.getAttribute('aria-pressed')).to.equal('true');
}

it('drops unreadable and over-budget peer legend records without hiding an admitted sibling', async () => {
  const element = await mount();
  const unreadable = new Proxy({ text: 'Unreadable', datasetIndex: 0 }, { ownKeys() { throw new Error('Unavailable legend keys'); } });
  const oversized = Object.fromEntries(Array.from({ length: 10_001 }, (_, index) => [`extra-${index}`, index]));
  const items = await generatedLabels(element, [null, unreadable, oversized, { text: 'Accepted', datasetIndex: 0 }]);
  expect(items.length).to.equal(1);
  expect((items[0] as { text: string }).text).to.include('Accepted');
  expect((items[0] as { datasetIndex: number }).datasetIndex).to.equal(0);
  await usable(element);
});

it('projects peer legend own data fields while omitting dangerous, missing, hidden and accessor fields', async () => {
  const element = await mount();
  let reads = 0;
  const item = { text: 'Accepted', datasetIndex: 0 };
  Object.defineProperties(item, {
    ['__proto__']: { value: 'untrusted', enumerable: true },
    constructor: { value: 'untrusted', enumerable: true },
    hiddenField: { value: 'hidden', enumerable: false },
    fillStyle: { get() { reads++; throw new Error('Legend accessor must not execute'); }, enumerable: true, configurable: true },
  });
  const peerItem = new Proxy(item, { ownKeys(target) { return [...Reflect.ownKeys(target), 'missing']; } });
  const items = await generatedLabels(element, [peerItem]);
  expect(items.length).to.equal(1);
  const copied = items[0] as Record<string, unknown>;
  expect(copied['text']).to.include('Accepted');
  expect(copied['datasetIndex']).to.equal(0);
  for (const key of ['__proto__', 'constructor', 'hiddenField', 'fillStyle', 'missing']) expect(Object.hasOwn(copied, key)).to.equal(false);
  expect(reads).to.equal(0);
  await usable(element);
});

it('skips sparse and accessor positions in peer legend arrays without evaluating position getters', async () => {
  const element = await mount();
  let reads = 0;
  const reply: unknown[] = [{ text: 'Accepted', datasetIndex: 0 }];
  reply.length = 3;
  Object.defineProperty(reply, '2', { get() { reads++; throw new Error('Legend position must not execute'); }, enumerable: true });
  const items = await generatedLabels(element, reply);
  expect(items.length).to.equal(1);
  expect((items[0] as { text: string }).text).to.include('Accepted');
  expect(reads).to.equal(0);
  await usable(element);
});

it('falls back to current dataset labels for a non-array peer legend reply', async () => {
  const element = await mount();
  const items = await generatedLabels(element, { text: 'Not a sequence', datasetIndex: 0 });
  expect(items.length).to.equal(1);
  expect((items[0] as { text: string }).text).to.include('Retained');
  expect((items[0] as { datasetIndex: number }).datasetIndex).to.equal(0);
  await usable(element);
});

it('revokes compatibility activation when a spatial selection listener replaces the source', async () => {
  const source = (revision: string): LyraSpatialChartSource => ({
    kind: 'spatial', revision, count: 1, bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    series: [{ id: 's', label: 'Series' }],
    query: request => ({ matchedCount: 1, points: [{ id: revision, seriesId: 's', sourceIndex: 0, x: 2, y: 3 }], bins: [{ bounds: request.bounds, count: 1 }] }),
    getPoint: id => ({ id, seriesId: 's', sourceIndex: 0, x: 2, y: 3 }),
  });
  const element = await fixture<LyraChart>(html`<lr-chart type="scatter" without-animation with-data-table
    style="inline-size:500px;block-size:260px" .preparedData=${source('initial')}></lr-chart>`);
  await ready(element);
  const selections: unknown[] = [], aliases: unknown[] = [];
  element.addEventListener('lr-spatial-point-select', event => selections.push(event.detail.revision));
  element.addEventListener('lr-datum-activate', event => aliases.push(event.detail));
  element.addEventListener('lr-spatial-point-select', () => { element.preparedData = source('replacement'); }, { once: true });
  element.shadowRoot!.querySelector<HTMLButtonElement>('[data-spatial-id="initial"]')!.click();
  expect(selections).to.deep.equal(['initial']);
  expect(aliases).to.deep.equal([]);
  await ready(element);
  element.shadowRoot!.querySelector<HTMLButtonElement>('[data-spatial-id="replacement"]')!.click();
  expect(selections).to.deep.equal(['initial', 'replacement']);
  expect(aliases).to.deep.equal([{ datasetIndex: 0, index: 0, label: undefined, value: { x: 2, y: 3 }, kind: 'point' }]);
  expect(element.exportData('csv')).to.include('replacement');
});

it('discards a completed refinement whose source revision changed during its public query and recovers after reassignment', async () => {
  let finish: (points: readonly LyraSeriesSample[]) => void = () => { throw new Error('Range query did not start'); };
  let requested = false;
  const source: Omit<LyraPreparedSeriesData, 'revision'> & { revision: string } = {
    kind: 'series', revision: 'initial', series: [{ id: 's', label: 'Series',
      counts: { sourceCount: 12, validCount: 12, invalidCount: 0 }, xDomain: { min: 0, max: 11 }, yDomain: { min: 0, max: 22 },
      samples: [{ sourceIndex: 0, x: 0, y: 0, breakBefore: true }, { sourceIndex: 11, x: 11, y: 22, breakBefore: false }],
    }],
    getPoint: ref => ({ x: ref.sourceIndex, y: ref.sourceIndex * 2 }),
    queryRange: () => { requested = true; return new Promise(resolve => { finish = resolve; }); },
  };
  const element = await fixture<LyraChart>(html`<lr-chart type="line" without-animation with-data-table
    style="inline-size:500px;block-size:260px" .preparedData=${source}></lr-chart>`);
  await ready(element);
  const before = element.exportData('csv');
  const pending = element.revealSourcePoint({ seriesId: 's', sourceIndex: 6 });
  await waitUntil(() => requested);
  source.revision = 'replacement';
  finish([{ sourceIndex: 6, x: 6, y: 12, breakBefore: true }]);
  expect(await pending).to.equal(false);
  expect(element.exportData('csv')).to.equal(before);
  const replacement: LyraPreparedSeriesData = { kind: source.kind, revision: source.revision, series: source.series, getPoint: source.getPoint };
  element.preparedData = replacement;
  await ready(element);
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 6 })).to.equal(true);
  await ready(element);
  expect(element.exportData('csv')).to.include('6,12');
  expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
});
