import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { prepareLyraHistogram, type LyraHistogramDistribution, type LyraPreparedCategoryData } from '../../../utilities/data-preparation.js';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import './histogram.js';
import './chart.js';
import type { LyraHistogram } from './histogram.class.js';
import type { LyraChart } from './chart.class.js';

type DistributionHistogram = LyraHistogram & { distribution: LyraHistogramDistribution | null };

it('renders exact million-observation bins while preserving explicit full distribution outlier counts', async function () {
  this.timeout(20000);
  let reads = 0;
  const distribution = await prepareLyraHistogram({ revision: 'million', count: 1000000, read(start, count) {
    reads += count; return Array.from({ length: count }, (_, offset) => start + offset === 999999 ? NaN : (start + offset) % 10);
  } }, { edges: [2,5,7], batchSize: 8192 });
  const element = await fixture<DistributionHistogram>(html`<lr-histogram without-animation with-data-table .distribution=${distribution}></lr-histogram>`);
  await waitUntil(() => element.chart !== undefined, 'histogram peer missing', { timeout: 5000 });
  expect(element.chart!.data.datasets[0]?.data).to.deep.equal([300000,300000]);
  expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('999,999');
  const visible = element.shadowRoot!.querySelector('[part="limit"]')!.textContent!;
  expect(visible).to.include('200,000'); expect(visible).to.include('199,999'); expect(visible).to.include('1 invalid');
  expect(element.exportData('csv')).to.include('300000');
  const bins: { index: number; value: number }[] = []; let sourceEvents = 0;
  element.addEventListener('lr-point-activate', event => bins.push((event as CustomEvent).detail));
  element.addEventListener('lr-source-category-select', () => sourceEvents++);
  element.addEventListener('lr-source-point-select', () => sourceEvents++);
  element.shadowRoot!.querySelectorAll<HTMLButtonElement>('tbody button')[1]!.click();
  expect(bins[0]!.index).to.equal(1); expect(bins[0]!.value).to.equal(300000); expect(sourceEvents).to.equal(0);
  expect(reads).to.equal(1000000); reads = 0;
  element.height = '310px'; element.bins = 1; await element.updateComplete;
  expect(element.chart!.data.datasets[0]!.data).to.deep.equal([300000,300000]); expect(reads).to.equal(0);
  recordScaleMeasurement('lr-histogram', 'distribution@1000000:mount-activate', {
    sourcePositions: 1000000, preparationReadPositions: 1000000, renderedReadPositions: reads,
    binnedObservations: distribution.binCounts.reduce((sum, value) => sum + value, 0),
    belowCount: distribution.belowCount, aboveCount: distribution.aboveCount, invalidCount: distribution.counts.invalidCount,
    peerEntries: element.chart!.data.datasets[0]!.data!.length, tableRows: element.shadowRoot!.querySelectorAll('tbody tr').length,
    domNodes: renderedNodeCount(element),
  });
});

it('retains ordinary prepared chart summary and exact source category events with default specialization hooks', async () => {
  const prepared: LyraPreparedCategoryData = { kind: 'categories', revision: 'base', aggregation: 'count',
    counts: { sourceCount: 30, validCount: 30, invalidCount: 0 }, categories: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    categoryCounts: [10,20], series: [{ id: 's', label: 'Count', values: [10,20] }],
  };
  const element = await fixture<LyraChart>(html`<lr-chart without-animation with-data-table .preparedData=${prepared}></lr-chart>`);
  await waitUntil(() => element.chart !== undefined, 'base peer missing', { timeout: 5000 });
  expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.equal('Summary of 30 valid observations (0 invalid); 2 displayed.');
  const events: unknown[] = []; element.addEventListener('lr-source-category-select', event => events.push((event as CustomEvent).detail));
  element.shadowRoot!.querySelectorAll<HTMLButtonElement>('tbody button')[1]!.click();
  expect(events).to.deep.equal([{ revision: 'base', seriesId: 's', categoryId: 'b', value: 20, observationCount: 20 }]);
});

function smallDistribution(): LyraHistogramDistribution {
  return { revision: 'small', counts: { sourceCount: 10, validCount: 8, invalidCount: 2 },
    domain: { min: -1, max: 3 }, edges: [0,1,2], binCounts: [2,3], belowCount: 1, aboveCount: 2 };
}
async function mounted(distribution: LyraHistogramDistribution | null = smallDistribution()): Promise<DistributionHistogram> {
  const element = await fixture<DistributionHistogram>(html`<lr-histogram without-animation with-data-table .distribution=${distribution}></lr-histogram>`);
  await waitUntil(() => element.chart !== undefined || element.shadowRoot!.querySelector('[part="error"]') !== null, 'histogram did not settle', { timeout: 5000 });
  return element;
}

it('bypasses raw samples and bins, preserves existing bin exports, and visibly rejects inherited prepared data alone', async () => {
  const element = await mounted();
  let reads = 0;
  Object.defineProperty(element, 'values', { configurable: true, get() { reads++; throw new Error('raw values read'); } });
  Object.defineProperty(element, 'bins', { configurable: true, get() { reads++; throw new Error('raw bins read'); } });
  element.height = '300px'; element.requestUpdate(); await element.updateComplete;
  expect(element.chart!.data.datasets[0]!.data).to.deep.equal([2,3]);
  expect(element.exportData('csv')).to.include('3');
  element.appendSamples([9]); element.appendData('', [8]); expect(reads).to.equal(0);
  const { binnedBuckets } = await import('./histogram-buckets.js');
  expect(binnedBuckets(element).map(bucket => bucket.count)).to.deep.equal([2,3]); expect(reads).to.equal(0);
  delete (element as unknown as Record<string, unknown>)['values']; delete (element as unknown as Record<string, unknown>)['bins'];
  element.preparedData = { kind: 'categories', revision: 'inherited', aggregation: 'count', counts: { sourceCount: 1, validCount: 1, invalidCount: 0 }, categories: [{ id: 'a', label: 'A' }], categoryCounts: [1], series: [{ id: 's', label: 'S', values: [1] }] };
  await element.updateComplete; expect(element.chart!.data.datasets[0]!.data).to.deep.equal([2,3]);
  element.distribution = null; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="error"]')!.textContent).to.include('unavailable');
});

it('rejects malformed and overbudget distributions before reading accessors or drawing partial bins', async () => {
  const element = await mounted(); let reads = 0;
  const accessor = { ...smallDistribution(), get binCounts() { reads++; throw new Error('accessor evaluated'); } };
  const invalids: unknown[] = [accessor, { ...smallDistribution(), binCounts: [2,4] },
    { ...smallDistribution(), edges: [0,0,2] }, { ...smallDistribution(), domain: { min: -Infinity, max: 3 } },
    { ...smallDistribution(), binCounts: new Array(2) },
    { ...smallDistribution(), edges: new Array(1002), binCounts: new Array(1001) },
    { ...smallDistribution(), counts: { sourceCount: 10, validCount: 9, invalidCount: 2 } }];
  element.strings = { chartPreparedUnavailable: 'Distribution unavailable' };
  for (const invalid of invalids) {
    element.distribution = invalid as LyraHistogramDistribution; await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Distribution unavailable');
    expect(element.chart === undefined).to.equal(true);
  }
  expect(reads).to.equal(0);
  element.distribution = { ...smallDistribution(), edges: [0,0.5,1,2], binCounts: [1,1,3] }; element.maxRecords = 2; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Distribution unavailable');
  element.maxRecords = 3; await element.updateComplete;
  await waitUntil(() => element.chart !== undefined, 'valid bounded bins missing');
  expect(element.chart!.data.datasets[0]!.data).to.deep.equal([1,1,3]);
});

it('preserves empty, all-invalid, extreme finite and final-inclusive explicit-edge distributions', async () => {
  const element = await mounted();
  for (const values of [[], [NaN, Infinity], [-Number.MAX_VALUE, 0, Number.MAX_VALUE]]) {
    const distribution = await prepareLyraHistogram({ revision: 'edge', count: values.length, read: (start, count) => values.slice(start, start + count) }, { edges: [-Number.MAX_VALUE, 0, Number.MAX_VALUE] });
    element.distribution = distribution; await element.updateComplete;
    await waitUntil(() => element.chart !== undefined, 'edge peer missing');
    expect(element.chart!.data.datasets[0]!.data).to.deep.equal(values.length === 3 ? [1,2] : [0,0]);
    expect(element.shadowRoot!.querySelector('[part="limit"]')!.textContent).not.to.include('Infinity');
    expect(element.shadowRoot!.querySelector('[part="limit"]')!.textContent!.includes('Observed sample range')).to.equal(values.length === 3);
  }
  element.distribution = await prepareLyraHistogram({ revision: 'empty', count: 0, read: () => [] }, { binCount: 2 });
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
  expect(element.chart!.data.datasets[0]!.data).to.deep.equal([]);
});

it('refreshes mutable distribution counts, labels and locale strings on coalesced explicit updates', async () => {
  const { registerLyraLocale } = await import('../../../internal/localization-runtime.js');
  const source = smallDistribution() as { -readonly [K in keyof LyraHistogramDistribution]: LyraHistogramDistribution[K] };
  const element = await mounted(source);
  source.revision = 'next'; source.binCounts = [3,2];
  element.requestUpdate(); element.height = '301px'; await element.updateComplete;
  expect(element.chart!.data.datasets[0]!.data).to.deep.equal([3,2]);
  source.binCounts = [4,1]; element.distribution = source; await element.updateComplete;
  expect(element.chart!.data.datasets[0]!.data).to.deep.equal([4,1]);
  expectLocaleFallback('de', [
    'histogramDistributionSummary', 'histogramDistributionRange', 'chartSummarySeparator',
    'chart', 'chartData', 'chartCategory',
  ]);
  element.seriesLabel = 'Observations'; element.locale = 'de'; await element.updateComplete;
  expect(element.chart!.data.datasets[0]!.label).to.equal('Observations');
  element.strings = { histogramDistributionSummary: 'Valid {validCount}; outside {belowCount}/{aboveCount}; invalid {invalidCount}', histogramDistributionRange: 'Domain {min}/{max}' };
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('Valid 8; outside 1/2; invalid 2');
  expect(element.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.include('Domain -1/3');
  element.strings = {}; element.locale = 'en-GB';
  registerLyraLocale('en-GB', { histogramDistributionSummary: 'First {validCount}', histogramDistributionRange: 'Range {min}/{max}' });
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('First 8');
  registerLyraLocale('en-GB', { histogramDistributionSummary: 'Second {validCount}' });
  element.requestUpdate(); element.height = '302px'; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('Second 8');
});

it('cancels pending raw appends on distribution assignment and restores the previous raw snapshot on clear', async () => {
  const element = await mounted(null); element.values = [1,2,3]; element.bins = 2; await element.updateComplete;
  const old = element.exportData('csv');
  const pending = new Array<number | null>(30000).fill(null); pending[0] = 99;
  element.appendSamples(pending);
  element.distribution = smallDistribution(); await element.updateComplete;
  element.appendSamples([100]); element.appendData('', [101]);
  expect(element.values).to.deep.equal([1,2,3]);
  element.distribution = null; await element.updateComplete;
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(element.values).to.deep.equal([1,2,3]); expect(element.exportData('csv')).to.equal(old);
  element.distribution = smallDistribution(); await element.updateComplete;
  const parent = element.parentNode!; element.remove(); parent.appendChild(element); await element.updateComplete;
  await waitUntil(() => element.chart !== undefined, 'reconnected histogram missing');
  expect(element.chart!.data.datasets[0]!.data).to.deep.equal([2,3]);
});

it('captures array descriptor lengths once without invoking mutable proxy length reads', async () => {
  const { snapshotHistogramDistribution } = await import('./histogram-buckets.js');
  let lengths = 0, positions = 0;
  const edges = new Proxy([0,1], {
    get(target, key, receiver) {
      if (key === 'length') return ++lengths <= 4 ? 2 : 1000000;
      return Reflect.get(target, key, receiver);
    },
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === 'string' && /^\d+$/u.test(key)) {
        positions++;
        if (positions > 10) throw new Error('unbounded inspection guard');
        return { value: Number(key), enumerable: true, configurable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const result = snapshotHistogramDistribution({ revision: 'proxy', counts: { sourceCount: 1, validCount: 1, invalidCount: 0 }, domain: { min: 0, max: 0 }, edges, binCounts: [1], belowCount: 0, aboveCount: 0 });
  expect(result.edges).to.deep.equal([0,1]); expect(lengths).to.equal(0); expect(positions).to.equal(2);
});

it('rejects populated bins that contradict the observed domain while preserving final-inclusive boundaries', async () => {
  const element = await mounted();
  for (const [min, max, binCounts] of [[0,0,[0,1]], [1,1,[1,0]], [0,2,[0,2]], [0,0.5,[1,1]], [0.2,0.3,[1,0]]] as const) {
    const count = binCounts[0] + binCounts[1];
    element.distribution = { revision: 'contradiction', counts: { sourceCount: count, validCount: count, invalidCount: 0 }, domain: { min, max }, edges: [0,1,2], binCounts, belowCount: 0, aboveCount: 0 };
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  }
  for (const [point, binCounts] of [[0,[1,0]], [1,[0,1]], [2,[0,1]]] as const) {
    element.distribution = { revision: point, counts: { sourceCount: 1, validCount: 1, invalidCount: 0 }, domain: { min: point, max: point }, edges: [0,1,2], binCounts, belowCount: 0, aboveCount: 0 };
    await element.updateComplete;
    await waitUntil(() => element.chart !== undefined, 'valid boundary missing');
    expect(element.chart!.data.datasets[0]!.data).to.deep.equal(binCounts);
  }
});

for (const sameIdentity of [false, true]) {
  it(`commits current distribution intent after reentrant ${sameIdentity ? 'same-identity refresh' : 'replacement'} during descriptor validation`, async () => {
    const element = await mounted();
    element.strings = { histogramDistributionSummary: 'Current {validCount} valid; {invalidCount} invalid' };
    const next: LyraHistogramDistribution = { revision: 'newest', counts: { sourceCount: 100, validCount: 80, invalidCount: 20 }, domain: { min: -1, max: 3 }, edges: [0,1,2], binCounts: [20,30], belowCount: 10, aboveCount: 20 };
    const target = { ...smallDistribution() };
    let reentered = false;
    const proxy = new Proxy(target, {
      getOwnPropertyDescriptor(record, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
        if (!reentered && key === 'domain') {
          reentered = true;
          if (sameIdentity) { Object.assign(record, next); element.requestUpdate(); element.height = '309px'; }
          else element.distribution = next;
        }
        return descriptor;
      },
    });
    element.distribution = proxy; await element.updateComplete;
    expect(reentered).to.equal(true);
    expect(element.chart!.data.datasets[0]!.data).to.deep.equal([20,30]);
    expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('80 valid');
    expect(element.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.include('20 invalid');
  });
}

it('does not cache obsolete helper buckets after reentrant distribution replacement or refresh', async () => {
  const { binnedBuckets } = await import('./histogram-buckets.js');
  const results: number[][] = [];
  for (const sameIdentity of [false, true]) {
    const element = await mounted();
    const next: LyraHistogramDistribution = { ...smallDistribution(), revision: 'newest',
      counts: { sourceCount: 53, validCount: 53, invalidCount: 0 }, binCounts: [20,30] };
    const target = { ...smallDistribution() };
    let reentered = false;
    element.distribution = new Proxy(target, {
      getOwnPropertyDescriptor(record, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
        if (!reentered && key === 'domain') {
          reentered = true;
          if (sameIdentity) { Object.assign(record, next); element.requestUpdate(); }
          else element.distribution = next;
        }
        return descriptor;
      },
    });
    binnedBuckets(element);
    results.push(binnedBuckets(element).map(bucket => bucket.count));
    expect(reentered).to.equal(true);
    await element.updateComplete;
  }
  expect(results).to.deep.equal([[20,30], [20,30]]);
});
