import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { Chart, PointElement } from 'chart.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraPreparedSeriesData, LyraSeriesPointRef, LyraSeriesSample } from '../../../utilities/data-preparation.js';
import type { LyraSpatialChartPoint, LyraSpatialChartSource, LyraSpatialQuery } from '../../../utilities/data-spatial.js';
import type { LyraChart, LyraChartFormatterContext, LyraChartSeries } from './chart.class.js';
import './chart.js';

const bounds = { minX: 0, maxX: 12, minY: 0, maxY: 12 };
const first: LyraSpatialChartPoint = { id: 'first', seriesId: 'a', sourceIndex: 1, x: 1, y: 2 };
const second: LyraSpatialChartPoint = { id: 'second', seriesId: 'b', sourceIndex: 9, x: 8, y: 9 };

function spatial(overrides: Partial<LyraSpatialChartSource> = {}): LyraSpatialChartSource {
  return {
    kind: 'spatial', revision: 'initial', count: 12, bounds,
    series: [{ id: 'a', label: 'First series' }, { id: 'b', label: 'Second series' }],
    query: () => ({ matchedCount: 12, points: [first, second], bins: [{ bounds, count: 12 }] }),
    getPoint: id => id === first.id ? first : id === second.id ? second : null,
    ...overrides,
  };
}

function indexed(revision = 'initial'): LyraPreparedSeriesData {
  return {
    kind: 'series', revision,
    series: [{ id: 's', label: 'Indexed', counts: { sourceCount: 12, validCount: 12, invalidCount: 0 },
      xDomain: { min: 0, max: 11 }, yDomain: { min: 0, max: 22 },
      samples: [0, 5, 11].map((index, position) => ({ x: index, y: index * 2, sourceIndex: index, breakBefore: position === 0 })),
    }],
    getPoint: ref => ({ x: ref.sourceIndex, y: ref.sourceIndex * 2 }),
  };
}

async function ready(element: LyraChart): Promise<void> {
  await element.updateComplete;
  await waitUntil(() => element.chart !== undefined && element.getAttribute('aria-busy') === 'false', 'chart did not settle', { timeout: 5000 });
  await element.updateComplete;
}

async function mountSpatial(source = spatial()): Promise<LyraChart> {
  const element = await fixture<LyraChart>(html`<lr-chart type="scatter" without-animation with-data-table
    style="inline-size:600px;block-size:300px" .preparedData=${source}></lr-chart>`);
  await ready(element);
  return element;
}

async function mountIndexed(source = indexed()): Promise<LyraChart> {
  const element = await fixture<LyraChart>(html`<lr-chart type="line" without-animation with-data-table
    style="inline-size:600px;block-size:300px" .preparedData=${source}></lr-chart>`);
  await ready(element);
  return element;
}

function canvas(element: LyraChart): HTMLCanvasElement {
  const result = element.shadowRoot?.querySelector('canvas');
  if (!result) throw new Error('Chart canvas missing');
  return result;
}

function tablePoint(element: LyraChart, id: string): HTMLButtonElement {
  const result = element.shadowRoot?.querySelector<HTMLButtonElement>(`button[data-spatial-id="${id}"]`);
  if (!result) throw new Error(`Spatial table point ${id} missing`);
  return result;
}

describe('chart source boundary interactions', () => {
  it('keeps unlabeled scatter coordinates and original source indexes in activation and formatted CSV', async () => {
    const element = await mountSpatial();
    const metadata: LyraChartFormatterContext[] = [];
    element.formatter = context => {
      if (context.surface !== 'export') return String(context.value);
      metadata.push(context);
      return context.statistic === 'x' ? `=${context.value}` : String(context.value);
    };
    await element.updateComplete;
    const selected: unknown[] = [], aliases: unknown[] = [];
    element.addEventListener('lr-spatial-point-select', event => selected.push((event as CustomEvent).detail));
    element.addEventListener('lr-datum-activate', event => aliases.push((event as CustomEvent).detail));
    tablePoint(element, 'first').click();
    expect(selected).to.deep.equal([{ revision: 'initial', point: first }]);
    expect(aliases).to.deep.equal([{ datasetIndex: 0, index: 0, label: undefined, value: { x: 1, y: 2 }, kind: 'point' }]);
    const csv = element.exportData('csv');
    expect(csv).to.include("point,a,First series,first,1,,'=1,2,");
    expect(csv).to.include('bin,,,,,,,,,0,12,0,12,12');
    expect(metadata.some(context => context.datasetIndex === 0 && context.index === 1 && context.statistic === 'x')).to.equal(true);
    expect(metadata.some(context => context.datasetIndex === undefined && context.index === undefined && context.statistic === undefined)).to.equal(true);
    expect(tablePoint(element, 'first').textContent).to.include('first');
    await expect(element).to.be.accessible();
  });

  it('selects density through the real canvas when a hidden representative no longer owns a hit', async () => {
    const element = await mountSpatial();
    const selected: string[] = [], regions: number[] = [];
    element.addEventListener('lr-spatial-point-select', event => selected.push((event as CustomEvent<{ point: LyraSpatialChartPoint }>).detail.point.id));
    element.addEventListener('lr-spatial-bin-select', event => regions.push((event as CustomEvent<{ count: number }>).detail.count));
    const settledAllocation = async () => {
      // The first allocation can replace the peer after the source query has settled.
      await waitUntil(() => {
        const allocation = element as unknown as {
          lastObservedInlineSize?: number;
          samplingWidth: number;
          resizeDrawFrame?: number;
        };
        const width = allocation.lastObservedInlineSize;
        const peer = element.chart as unknown as Chart | undefined;
        const area = peer?.chartArea, surface = canvas(element), box = surface.getBoundingClientRect();
        const point = peer?.getDatasetMeta(0).data[0] as PointElement | undefined;
        const center = point?.getCenterPoint(true);
        return typeof width === 'number' && Number.isFinite(width) && width > 0 &&
          allocation.samplingWidth === Math.floor(width) && allocation.resizeDrawFrame === undefined &&
          !element.isUpdatePending && element.getAttribute('aria-busy') === 'false' &&
          !!peer && peer.canvas === surface && !!area && !!center &&
          [box.width, box.height, peer.width, peer.height, area.width, area.height]
            .every(value => Number.isFinite(value) && value > 0) &&
          Number.isFinite(center.x) && Number.isFinite(center.y) &&
          Math.abs(box.width - peer.width) < 1 && Math.abs(box.height - peer.height) < 1;
      }, 'spatial chart pointer allocation did not settle', { timeout: 5000 });
    };
    const pointPosition = (box = canvas(element).getBoundingClientRect()): [number, number] => {
      const peer = element.chart as unknown as Chart;
      const point = peer.getDatasetMeta(0).data[0] as PointElement;
      const center = point.getCenterPoint(true);
      return [Math.round(box.left + center.x * box.width / peer.width), Math.round(box.top + center.y * box.height / peer.height)];
    };
    const clickFirst = async () => {
      await settledAllocation();
      await hoverUntilMatched(canvas(element), 'representative canvas receives pointer input', pointPosition);
      await settledAllocation();
      await sendMouse({ type: 'click', position: pointPosition() });
    };
    try {
      await clickFirst();
      await waitUntil(() => selected.length === 1, 'representative was not activated');
      expect(selected).to.deep.equal(['first']);
      expect(regions).to.deep.equal([]);
      element.hiddenDatasets = [0];
      await element.updateComplete;
      await waitUntil(() => !(element.chart as unknown as Chart).isDatasetVisible(0));
      await clickFirst();
      await waitUntil(() => regions.length === 1, 'density was not activated');
      expect(selected).to.deep.equal(['first']);
      expect(regions).to.deep.equal([12]);
    } finally { await resetMouse(); }
  });

  it('rejects keys from a pending spatial query and discards its response after replacement', async () => {
    let finish: (value: LyraSpatialQuery<LyraSpatialChartPoint>) => void = () => { throw new Error('Query not started'); };
    let signal: AbortSignal | undefined;
    const pending = spatial({ query: request => {
      signal = request.signal;
      return new Promise<LyraSpatialQuery<LyraSpatialChartPoint>>(resolve => { finish = resolve; });
    } });
    const element = await fixture<LyraChart>(html`<lr-chart type="scatter" without-animation with-data-table .preparedData=${pending}></lr-chart>`);
    await waitUntil(() => signal !== undefined && Boolean(element.shadowRoot?.querySelector('canvas')));
    const staleCanvas = canvas(element);
    const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    let activations = 0;
    element.addEventListener('lr-spatial-point-select', () => activations++);
    staleCanvas.dispatchEvent(key);
    expect(key.defaultPrevented).to.equal(false);
    element.preparedData = spatial({ revision: 'replacement', query: () => ({ matchedCount: 12,
      points: [{ ...second, id: 'replacement' }], bins: [{ bounds, count: 12 }] }) });
    const reveal = element.revealSourcePoint('missing');
    await element.updateComplete;
    expect(signal?.aborted).to.equal(true);
    finish({ matchedCount: 12, points: [first], bins: [{ bounds, count: 12 }] });
    expect(await reveal).to.equal(false);
    await ready(element);
    expect(element.exportData('csv')).to.include('replacement');
    expect(element.exportData('csv')).not.to.include(',first,');
    expect(activations).to.equal(0);
    element.preparedData = null;
    expect(await element.revealSourcePoint('replacement')).to.equal(false);
  });

  it('keeps an empty spatial source usable without inventing bins or consuming keyboard activation', async () => {
    let queries = 0;
    const element = await mountSpatial(spatial({ count: 0, bounds: null, query: () => {
      queries++;
      return { matchedCount: 0, points: [], bins: [] };
    } }));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    canvas(element).dispatchEvent(enter);
    expect(enter.defaultPrevented).to.equal(false);
    expect(queries).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    expect(element.exportData('csv').split('\r\n').length).to.equal(1);
    expect(await element.revealSourcePoint('unknown')).to.equal(false);
  });

  it('refuses an exact reveal whose viewport span cannot be preserved as finite coordinates', async () => {
    const global = { minX: -Number.MAX_VALUE, maxX: Number.MAX_VALUE, minY: 0, maxY: 12 };
    const element = await mountSpatial(spatial({ bounds: global,
      query: request => {
        const count = request.bounds.maxX === Number.MAX_VALUE ? 12 : 11;
        return { matchedCount: count, points: [], bins: [{ bounds: request.bounds, count }] };
      },
      getPoint: id => ({ id, seriesId: 'a', sourceIndex: 11, x: Number.MAX_VALUE, y: 6 }),
    }));
    const viewport = { ...global, maxX: Number.MAX_VALUE / 2 };
    element.viewport = viewport;
    await ready(element);
    expect(await element.revealSourcePoint('outside')).to.equal(false);
    expect(element.viewport).to.deep.equal(viewport);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  for (const direction of ['ltr', 'rtl'] as const) it(`skips hidden points and ignores repeated activation while retaining density in ${direction}`, async () => {
    const element = await mountSpatial();
    element.dir = direction;
    element.hiddenDatasets = [0];
    await element.updateComplete;
    const points: string[] = [], bins: number[] = [];
    element.addEventListener('lr-spatial-point-select', event => points.push((event as CustomEvent<{ point: LyraSpatialChartPoint }>).detail.point.id));
    element.addEventListener('lr-spatial-bin-select', event => bins.push((event as CustomEvent<{ count: number }>).detail.count));
    await focusByKeyboard(canvas(element));
    await sendKeys({ press: 'Home' });
    const repeat = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true });
    canvas(element).dispatchEvent(repeat);
    expect(repeat.defaultPrevented).to.equal(true);
    expect(points.length).to.equal(0);
    await sendKeys({ press: 'Enter' });
    expect(points).to.deep.equal(['second']);
    element.hiddenDatasets = [0, 1];
    await element.updateComplete;
    await focusByKeyboard(canvas(element));
    await sendKeys({ press: 'Home' });
    await sendKeys({ press: 'Enter' });
    expect(points).to.deep.equal(['second']);
    expect(bins).to.deep.equal([12]);
    expect(await element.revealSourcePoint('first')).to.equal(false);
    expect(element.exportData('csv')).to.include(',first,');
  });

  it('keeps tooltip and tick callbacks safe for invalid peer indexes and obsolete source views', async () => {
    const element = await mountSpatial();
    type Context = { datasetIndex?: number; dataIndex?: number };
    const options = element.chart!.options as unknown as {
      scales: { x: { ticks: { callback(value: number): unknown } } };
      plugins: { tooltip: { callbacks: { title(contexts: Context[]): unknown; footer(contexts: Context[]): unknown; label(context: Context): unknown } } };
    };
    const callbacks = options.plugins.tooltip.callbacks;
    expect(callbacks.title([{ datasetIndex: 0, dataIndex: 0 }])).to.equal('first');
    expect(String(callbacks.label({ datasetIndex: 0, dataIndex: 0 }))).to.include('first');
    for (const context of [{}, { datasetIndex: NaN, dataIndex: 0 }, { datasetIndex: 0, dataIndex: 0.5 }, { datasetIndex: 99, dataIndex: 0 }, { datasetIndex: 0, dataIndex: 99 }]) {
      expect(callbacks.title([context])).to.equal('');
      expect(callbacks.footer([context])).to.equal('');
      expect(callbacks.label(context)).to.equal('');
    }
    expect(callbacks.title([])).to.equal('');
    expect(options.scales.x.ticks.callback(-1)).to.equal('');
    expect(options.scales.x.ticks.callback(2)).to.equal('');
    element.preparedData = spatial({ revision: 'new' });
    expect(callbacks.title([{ datasetIndex: 0, dataIndex: 0 }])).to.equal('');
    expect(options.scales.x.ticks.callback(0.5)).to.equal('');
    await ready(element);
    element.withoutAnimation = false;
    element.config = { options: { animation: false } };
    await element.updateComplete;
    expect(element.chart!.options['animation']).to.equal(false);
  });
});

describe('chart indexed reveal boundaries', () => {
  it('rejects invalid references and incompatible source kinds before invoking the exact reader', async () => {
    let reads = 0;
    const source = { ...indexed(), getPoint: () => { reads++; return null; } };
    const element = await mountIndexed(source);
    for (const ref of [null, { seriesId: 42, sourceIndex: 0 }, { seriesId: 'missing', sourceIndex: 0 }, ...[-1, 12, NaN, 0.5, Number.MAX_SAFE_INTEGER + 1].map(sourceIndex => ({ seriesId: 's', sourceIndex }))]) {
      expect(await element.revealSourcePoint(ref as unknown as LyraSeriesPointRef)).to.equal(false);
    }
    expect(reads).to.equal(0);
    const before = element.exportData('csv');
    expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 6 })).to.equal(false);
    expect(reads).to.equal(1);
    expect(element.exportData('csv')).to.equal(before);
    element.preparedData = spatial();
    expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 6 })).to.equal(false);
    element.type = 'bar';
    element.preparedData = { kind: 'categories', revision: 'categories',
      counts: { sourceCount: 12, validCount: 12, invalidCount: 0 }, categories: [{ id: 'one', label: 'Only' }],
      categoryCounts: [12], series: [{ id: 's', label: 'Categories', values: [12] }], aggregation: 'count',
    };
    expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 6 })).to.equal(false);
    const detached = document.createElement('lr-chart') as LyraChart;
    expect(await detached.revealSourcePoint({ seriesId: 's', sourceIndex: 0 })).to.equal(false);
  });

  it('waits for a replaced model before exact lookup and refuses a source revision changed by that lookup', async () => {
    const element = await mountIndexed();
    const reads: number[] = [];
    element.preparedData = { ...indexed('replacement'), getPoint: (ref: LyraSeriesPointRef) => { reads.push(ref.sourceIndex); return { x: ref.sourceIndex, y: ref.sourceIndex * 2 }; } };
    expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 6 })).to.equal(true);
    expect(reads).to.deep.equal([6]);
    await element.updateComplete;
    const before = element.exportData('csv');
    const changing = { ...indexed(), getPoint: (ref: LyraSeriesPointRef) => {
      changing.revision = 'changed-during-read';
      return { x: ref.sourceIndex, y: ref.sourceIndex * 2 };
    } };
    element.preparedData = changing;
    await element.updateComplete;
    const initial = element.exportData('csv');
    expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 7 })).to.equal(false);
    await element.updateComplete;
    expect(element.exportData('csv')).to.equal(initial);
    expect(element.getAttribute('aria-busy')).to.equal('false');
    expect(before).not.to.equal(initial);
    const stale = indexed();
    element.preparedData = stale;
    await element.updateComplete;
    Object.defineProperty(stale, 'revision', { value: 'changed-before-read' });
    expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 7 })).to.equal(false);
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
  });

  it('cancels a pending indexed range refinement when its source is replaced', async () => {
    let finish: (value: readonly LyraSeriesSample[]) => void = () => { throw new Error('Refinement not started'); };
    let signal: AbortSignal | undefined;
    const source: LyraPreparedSeriesData = { ...indexed(), queryRange: request => {
      signal = request.signal;
      return new Promise<readonly LyraSeriesSample[]>(resolve => { finish = resolve; });
    } };
    const element = await mountIndexed(source);
    const pending = element.revealSourcePoint({ seriesId: 's', sourceIndex: 6 });
    await waitUntil(() => signal !== undefined);
    element.preparedData = indexed('replacement');
    expect(await pending).to.equal(false);
    await ready(element);
    const before = element.exportData('csv');
    expect(signal?.aborted).to.equal(true);
    finish([{ x: 6, y: 12, sourceIndex: 6, breakBefore: true }]);
    await Promise.resolve(); await element.updateComplete;
    expect(element.exportData('csv')).to.equal(before);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  for (const kind of ['accessor', 'non-callable'] as const) it(`rejects ${kind} indexed refinement without discarding the completed view`, async () => {
    const source = indexed();
    let getterReads = 0;
    Object.defineProperty(source, 'queryRange', kind === 'accessor'
      ? { configurable: true, get() { getterReads++; throw new Error('Refinement accessor must not run'); } }
      : { configurable: true, value: 42 });
    const element = await mountIndexed(source);
    const before = element.exportData('csv');
    expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 6 })).to.equal(false);
    await element.updateComplete;
    expect(getterReads).to.equal(0);
    expect(element.exportData('csv')).to.equal(before);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
    expect(element.getAttribute('aria-busy')).to.equal('false');
    Object.defineProperty(source, 'queryRange', { configurable: true, value: () => [
      { x: 0, y: 0, sourceIndex: 0, breakBefore: true }, { x: 11, y: 22, sourceIndex: 11, breakBefore: false },
    ] });
    expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 6 })).to.equal(true);
    await element.updateComplete;
    expect(element.exportData('csv')).not.to.equal(before);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });
});

describe('chart structured legend placement boundary', () => {
  it('rejects unsafe keys and constructor descriptors without executing caller accessors', async () => {
    const element = await fixture<LyraChart>(html`<lr-chart without-animation .labels=${['Only']} .datasets=${[{ label: 'Safe', data: [3] }]}></lr-chart>`);
    await ready(element);
    let reads = 0;
    const prototype = Object.create(null) as object;
    Object.defineProperty(prototype, 'constructor', { get() { reads++; throw new Error('Constructor accessor must not run'); } });
    const unsafe = Object.create(null) as Record<string, number>;
    Object.defineProperty(unsafe, '__proto__', { value: 1, enumerable: true });
    const inaccessibleKeys = new Proxy({ x: 1 }, { ownKeys() { throw new Error('Uninspectable placement'); } });
    for (const position of [Object.create(prototype) as object, Object.create({}) as object, unsafe, inaccessibleKeys]) {
      element.legendPosition = position as LyraChart['legendPosition'];
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('[part="legend"]')?.getAttribute('data-position')).to.equal('top');
      expect(element.exportData('csv')).to.include('Safe');
    }
    expect(reads).to.equal(0);
    element.legendPosition = { x: 1 };
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part~="legend-item"]').length).to.equal(1);
  });
});

describe('chart public configuration reuse', () => {
  it('reuses admitted series in a new collection while dropping malformed siblings', () => {
    const element = document.createElement('lr-chart') as LyraChart;
    element.labels = ['Only'];
    element.datasets = [{ label: 'Numeric', data: [3] }, { label: 'Coordinate', points: [{ x: 1, y: 4 }] }];
    const numeric = element.datasets[0]!, point = element.datasets[1]!;
    element.datasets = [null, 3, { label: 7, data: [8] }, point, numeric] as unknown as readonly LyraChartSeries[];
    expect(element.datasets.length).to.equal(2);
    expect(element.datasets[0] === point).to.equal(true);
    expect(element.datasets[1] === numeric).to.equal(true);
    const admitted = element.datasets;
    element.datasets = admitted;
    expect(element.datasets === admitted).to.equal(true);
    expect(element.exportData('csv')).to.include('Coordinate');
    expect(element.exportData('csv')).to.include('Numeric');
    expect(element.exportData('csv')).not.to.include(',8');
  });

  it('retains an opaque raw datum snapshot across stream appends and configuration reassignment', () => {
    class OpaqueDatum { y = 3; }
    const datum = new OpaqueDatum();
    const element = document.createElement('lr-chart') as LyraChart;
    element.config = { data: { labels: ['First'], datasets: [{ label: 'Retained', data: [datum] }] } };
    const originalRow = element.exportData('csv').split('\r\n')[1];
    let reads = 0;
    Object.defineProperty(datum, 'y', { configurable: true, enumerable: true, get() {
      reads++;
      throw new Error('A retained opaque datum must not be reread');
    } });
    element.appendData('Second', [9]);
    element.config = { ...element.config };
    element.appendData('Third', [12]);
    expect(reads).to.equal(0);
    expect(element.config?.data?.datasets?.[0]?.data?.[0] === datum).to.equal(true);
    expect(element.exportData('csv').split('\r\n')).to.deep.equal(['label,Retained', originalRow, 'Second,9', 'Third,12']);
  });

  it('pads an explicit raw dataset with no data member before adding its first streamed value', () => {
    const element = document.createElement('lr-chart') as LyraChart;
    element.config = { data: { labels: ['Missing'], datasets: [{ label: 'Retained' }] } };
    element.appendData('First value', [7]);
    expect(element.config?.data?.datasets?.[0]?.data).to.deep.equal([null, 7]);
    expect(element.exportData('csv').split('\r\n')).to.deep.equal(['label,Retained', 'Missing,', 'First value,7']);
    element.appendData('Absent values', undefined as unknown as (number | null)[]);
    expect(element.config?.data?.datasets?.[0]?.data).to.deep.equal([null, 7, null]);
  });
});

describe('chart spatial activation authority', () => {
  it('does not report a point activation from a table control after the chart left the document', async () => {
    const element = await mountSpatial();
    const events: string[] = [];
    for (const name of ['lr-spatial-point-select', 'lr-point-activate', 'lr-datum-activate']) {
      element.addEventListener(name, () => events.push(name));
    }
    const control = tablePoint(element, 'first');
    element.remove();
    control.click();
    expect(events).to.deep.equal([]);
  });
});
