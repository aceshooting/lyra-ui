import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import './embedding-explorer.js';
import type { LyraEmbeddingExplorer } from './embedding-explorer.class.js';

it('shows full spatial density and reveals an omitted exact point without changing selection', async () => {
  const bounds = { minX: 0, maxX: 999999, minY: 0, maxY: 1 };
  let queries = 0;
  const reads: string[] = [];
  const source = { revision: 'million', count: 1000000, bounds,
    query(request: { maxBins: number; maxPoints: number }) {
      queries++;
      expect([request.maxBins, request.maxPoints]).to.deep.equal([499,499]);
      expect(Object.isFrozen(request)).to.equal(true);
      return { matchedCount: 1000000, bins: [{ bounds: { ...bounds, maxX: 999998.5 }, count: 999999 }, { bounds: { ...bounds, minX: 999998.5 }, count: 1 }],
        points: [{ id: 'first', sourceIndex: 0, x: 0, y: 0 }] };
    },
    getPoint(id: string) { reads.push(id); const index = Number(id); return { id, sourceIndex: index, x: index, y: 1 }; },
  };
  const el = await fixture<LyraEmbeddingExplorer & { revealSourcePoint(id: string): Promise<boolean> }>(html`<lr-embedding-explorer .source=${source} selected-point-id="500000"></lr-embedding-explorer>`);
  await waitUntil(() => queries > 0, 'spatial source was not queried');
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="bin"]').length === 2);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[data-id="500000"]').length === 1);
  let selected = 0; el.addEventListener('lr-point-select', () => selected++);
  expect(await el.revealSourcePoint('999999')).to.equal(true);
  expect(el.selectedPointId).to.equal('500000'); expect(selected).to.equal(0);
  expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('999999');
  expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.include('1,000,000');
  expect(el.shadowRoot!.querySelectorAll('[data-id="500000"]').length).to.equal(1);
  expect(reads).to.deep.equal(['500000','999999']);
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.include('1,000,000');
  expect(queries).to.equal(1);
  recordScaleMeasurement('lr-embedding-explorer', 'spatial@1000000:select-reveal', {
    sourcePositions: 1000000, queryCalls: queries, exactLookupCalls: reads.length,
    bins: el.shadowRoot!.querySelectorAll('[part="bin"]').length,
    points: el.shadowRoot!.querySelectorAll('[part="point"]').length,
    domNodes: renderedNodeCount(el),
  });
});

import type { LyraSpatialBounds, LyraSpatialPointSource, LyraSpatialQuery } from '../../../utilities/data-spatial.js';
import type { SpatialPoint } from '../../../internal/spatial-source-controller.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const globalBounds = Object.freeze({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
function response(bounds: LyraSpatialBounds = globalBounds): LyraSpatialQuery<SpatialPoint> {
  return { matchedCount: 100, bins: [{ bounds, count: 100 }], points: [{ id: '50', sourceIndex: 50, x: 50, y: 50 }] };
}
function provider(): LyraSpatialPointSource<SpatialPoint> {
  return { revision: 1, count: 100, bounds: globalBounds,
    query: () => response(),
    getPoint: id => Number(id) < 100 ? { id, sourceIndex: Number(id), x: Number(id), y: Number(id) } : null };
}
async function spatial(source = provider(), extra = {}) {
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .source=${source}></lr-embedding-explorer>`);
  Object.assign(el, extra);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false');
  return el;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

it('keeps raw budgets one and two unchanged while source budgets below three fail visibly', async () => {
  for (const max of [1,2]) {
    const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .maxRenderedPoints=${max} .points=${[{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 1 }]}></lr-embedding-explorer>`);
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(max);
    el.source = provider(); await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
    el.source = null; await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(max);
  }
});

it('keeps one physical viewport request and only the newest pending viewport across replacement', async () => {
  const pending = deferred<LyraSpatialQuery<SpatialPoint>>();
  let active = 0, maximum = 0, firstSignal: AbortSignal | undefined;
  const calls: number[] = [];
  const source = provider();
  source.query = request => {
    calls.push(request.bounds.minX); active++; maximum = Math.max(maximum, active);
    if (calls.length === 1) { firstSignal = request.signal; return pending.promise.finally(() => { active--; }); }
    active--; return { matchedCount: 1, bins: [{ bounds: request.bounds, count: 1 }], points: [] };
  };
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .source=${source}></lr-embedding-explorer>`);
  el.viewport = { minX: 10, maxX: 80, minY: 10, maxY: 80 };
  el.viewport = { minX: 20, maxX: 80, minY: 20, maxY: 80 };
  el.source = { ...source, revision: 2 };
  await el.updateComplete;
  expect(calls).to.deep.equal([0]); expect(firstSignal!.aborted).to.equal(true);
  pending.resolve(response());
  await waitUntil(() => calls.length === 2);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false');
  expect(calls).to.deep.equal([0,20]); expect(maximum).to.equal(1);
});

it('coalesces exact lookups without losing the controlled selection when revealing another ID', async () => {
  const pending = deferred<SpatialPoint | null>(); const calls: string[] = [];
  const source = provider();
  source.getPoint = id => { calls.push(id); return calls.length === 1 ? pending.promise : { id, sourceIndex: Number(id), x: Number(id), y: Number(id) }; };
  const el = await spatial(source);
  el.selectedPointId = '20';
  const obsolete = el.revealSourcePoint('30');
  const newest = el.revealSourcePoint('40');
  await el.updateComplete;
  expect(calls).to.deep.equal(['20']);
  expect(await obsolete).to.equal(false);
  pending.resolve({ id: '20', sourceIndex: 20, x: 20, y: 20 });
  expect(await newest).to.equal(true);
  expect(calls).to.deep.equal(['20','20','40']);
  expect(el.selectedPointId).to.equal('20');
  expect(el.shadowRoot!.querySelectorAll('[data-id="20"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[data-id="40"]').length).to.equal(1);
});

it('pans a same-size viewport for reveal and never selects or emits point activation', async () => {
  const source = provider();
  source.query = request => ({ matchedCount: 1, bins: [{ bounds: request.bounds, count: 1 }], points: [] });
  const el = await spatial(source, { viewport: { minX: 0, maxX: 20, minY: 0, maxY: 20 }, selectedPointId: '10' });
  let events = 0; el.addEventListener('lr-point-select', () => events++);
  expect(await el.revealSourcePoint('90')).to.equal(true);
  expect(el.viewport).to.deep.equal({ minX: 70, maxX: 90, minY: 70, maxY: 90 });
  expect(el.selectedPointId).to.equal('10'); expect(events).to.equal(0);
  expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('90');
});

it('rejects overlapping bins but accepts adjacent bins, holes and collapsed global axes', async () => {
  const source = provider();
  source.query = () => ({ matchedCount: 100, bins: [
    { bounds: { minX: 0, maxX: 50, minY: 0, maxY: 100 }, count: 50 },
    { bounds: { minX: 50, maxX: 100, minY: 0, maxY: 100 }, count: 50 },
  ], points: [{ id: '50', sourceIndex: 50, x: 50, y: 100 }] });
  const el = await spatial(source);
  expect(el.shadowRoot!.querySelectorAll('[part="bin"]').length).to.equal(2);
  el.source = { ...source, revision: 2, query: () => ({ matchedCount: 100, bins: [
    { bounds: { minX: 0, maxX: 60, minY: 0, maxY: 100 }, count: 50 },
    { bounds: { minX: 50, maxX: 100, minY: 0, maxY: 100 }, count: 50 },
  ], points: [] }) };
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="error"]').length === 1);
  const collapsed = { minX: 5, maxX: 5, minY: 0, maxY: 100 };
  el.source = { ...source, revision: 3, bounds: collapsed, query: () => ({ matchedCount: 100, bins: [
    { bounds: { ...collapsed, maxY: 40 }, count: 50 },
    { bounds: { ...collapsed, minY: 60 }, count: 50 },
  ], points: [] }) };
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="bin"]').length === 2);
  expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
});

it('rejects malformed, oversized and accessor responses without invoking accessors', async () => {
  let accessed = 0;
  const invalid: unknown[] = [
    { matchedCount: 100, bins: [{ bounds: globalBounds, count: 99 }], points: [] },
    { matchedCount: 100, bins: [{ bounds: globalBounds, count: 100 }], points: new Array(500) },
    { matchedCount: 100, bins: [{ bounds: globalBounds, count: 100 }], points: [
      { id: 'a', sourceIndex: 0, x: 0, y: 0 }, { id: 'a', sourceIndex: 1, x: 1, y: 1 }] },
    { matchedCount: 100, bins: [{ bounds: globalBounds, count: 100 }], get points() { accessed++; return []; } },
  ];
  for (const value of invalid) {
    const source = provider(); source.query = () => value as LyraSpatialQuery<SpatialPoint>;
    const el = await spatial(source);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
  }
  expect(accessed).to.equal(0);
});

it('keeps current intent when descriptor callbacks replace or refresh the source', async () => {
  for (const same of [false,true]) {
    const el = await spatial(); const target = provider(); let once = false;
    const next = { ...provider(), revision: 2, query: () => ({ matchedCount: 7, bins: [{ bounds: globalBounds, count: 7 }], points: [] }) };
    const proxy = new Proxy(target, { getOwnPropertyDescriptor(record, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
      if (!once && key === 'bounds') { once = true; if (same) { Object.assign(record, next); el.requestUpdate(); } else el.source = next; }
      return descriptor;
    } });
    el.source = proxy;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="bin"]').length === 1);
    await el.updateComplete;
    let count = 0; el.addEventListener('lr-spatial-bin-select', event => { count = event.detail.count; });
    el.shadowRoot!.querySelector<SVGGElement>('[part="bin"]')!.dispatchEvent(new MouseEvent('click'));
    expect(count).to.equal(7);
  }
});

it('discards disconnected work and starts a fresh source generation on reconnect', async () => {
  const pending = deferred<LyraSpatialQuery<SpatialPoint>>(); let calls = 0;
  const source = provider(); source.query = () => ++calls === 1 ? pending.promise : response();
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .source=${source}></lr-embedding-explorer>`);
  const parent = el.parentNode!; el.remove(); parent.appendChild(el);
  expect(calls).to.equal(1); pending.resolve(response());
  await waitUntil(() => calls === 2);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="bin"]').length === 1);
  expect(await el.revealSourcePoint('')).to.equal(false);
  expect(await el.revealSourcePoint(1 as unknown as string)).to.equal(false);
});

it('activates bins separately and keeps keyboard navigation shared with exact point overlays', async () => {
  const el = await spatial(); let bins = 0, points = 0;
  el.addEventListener('lr-spatial-bin-select', event => { bins += event.detail.count; expect(Object.isFrozen(event.detail.bounds)).to.equal(true); });
  el.addEventListener('lr-point-select', () => points++);
  const bin = el.shadowRoot!.querySelector<SVGGElement>('[part="bin"]')!;
  await focusByKeyboard(bin as unknown as HTMLElement);
  bin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(bins).to.equal(100); expect(points).to.equal(0);
  bin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('50');
});

it('enforces source budget three, per-field metadata and the aggregate response envelope', async () => {
  const source = provider();
  source.query = request => {
    expect([request.maxBins, request.maxPoints]).to.deep.equal([1,0]);
    return { matchedCount: 100, bins: [{ bounds: globalBounds, count: 100 }], points: [] };
  };
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .maxRenderedPoints=${3} .source=${source} selected-point-id="20"></lr-embedding-explorer>`);
  expect(await el.revealSourcePoint('30')).to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('[part="point"], [part="bin"]').length).to.equal(3);
  const large = provider();
  const count = 2000;
  large.query = () => ({ matchedCount: 2000, bins: [{ bounds: globalBounds, count: 2000 }], points:
    Array.from({ length: 1000 }, (_, index) => ({ id: String(index), sourceIndex: index, x: 50, y: 50, label: 'x'.repeat(1024) })) });
  el.maxRenderedPoints = 10000; el.source = { ...large, count };
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="error"]').length === 1);
  el.source = { ...provider(), query: () => ({ ...response(), points: [{ id: 'a', sourceIndex: 0, x: 1, y: 1, label: 'x'.repeat(1025) }] }) };
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="error"]').length === 1);
});

it('renders empty and zero-dimensional sources and rejects a collapsed viewport on a noncollapsed axis', async () => {
  const el = await spatial({ ...provider(), count: 0, bounds: null, query: () => { throw new Error('empty query'); } });
  expect(el.shadowRoot!.querySelectorAll('[part="empty"]').length).to.equal(1);
  const bounds = { minX: Number.MAX_VALUE, maxX: Number.MAX_VALUE, minY: 7, maxY: 7 };
  el.source = { ...provider(), count: 1, bounds, query: () => ({ matchedCount: 1, bins: [{ bounds, count: 1 }], points: [{ id: 'zero', sourceIndex: 0, x: Number.MAX_VALUE, y: 7 }] }) };
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="point"]').length === 1);
  expect(el.shadowRoot!.querySelector('[part="point"]')!.getAttribute('transform')).to.equal('translate(320 180)');
  el.source = provider(); el.viewport = { ...globalBounds, maxX: 0 };
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="error"]').length === 1);
});

it('keeps finite projection coordinates for extreme endpoints and refreshes same-source payloads explicitly', async () => {
  const bounds = { minX: -Number.MAX_VALUE, maxX: Number.MAX_VALUE, minY: 0, maxY: 100 };
  const source = { ...provider(), bounds, query: () => ({ matchedCount: 100, bins: [{ bounds, count: 100 }], points: [{ id: '50', sourceIndex: 50, x: 0, y: 50 }] }) };
  const el = await spatial(source);
  expect(el.shadowRoot!.querySelector('[part="point"]')!.getAttribute('transform')).to.equal('translate(320 180)');
  source.query = () => ({ matchedCount: 4, bins: [{ bounds, count: 4 }], points: [] });
  Object.assign(source, { revision: 2 }); el.requestUpdate();
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="point"]').length === 0);
  let count = 0; el.addEventListener('lr-spatial-bin-select', event => { count = event.detail.count; });
  el.shadowRoot!.querySelector('[part="bin"]')!.dispatchEvent(new MouseEvent('click'));
  expect(count).to.equal(4);
});

it('uses localized bin names and RTL navigation without source rereads for presentation updates', async () => {
  let queries = 0; const source = provider(); source.query = () => { queries++; return response(); };
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer dir="rtl" .source=${source}></lr-embedding-explorer>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="bin"]').length === 1);
  const baseline = queries;
  el.strings = { embeddingExplorerSpatialBin: 'Density {count}: {bounds}', embeddingExplorerSpatialSummary: 'All {total}; viewport {matched}: {global}; {viewport}' };
  el.height = '400px'; await el.updateComplete;
  const bin = el.shadowRoot!.querySelector<SVGGElement>('[part="bin"]')!;
  expect(bin.getAttribute('aria-label')).to.include('Density 100:');
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.include('All 100; viewport 100:');
  await focusByKeyboard(bin as unknown as HTMLElement);
  bin.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('50');
  expect(queries).to.equal(baseline);
  await expect(el).to.be.accessible();
});

it('invalidates reentrant response descriptors and abort callbacks without publishing obsolete state', async () => {
  const el = await spatial();
  let reentered = false;
  const next = { ...provider(), revision: 2, query: () => ({ matchedCount: 8, bins: [{ bounds: globalBounds, count: 8 }], points: [] }) };
  el.source = { ...provider(), query: () => new Proxy(response(), { getOwnPropertyDescriptor(record, key) {
    const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
    if (!reentered && key === 'bins') { reentered = true; el.source = next; }
    return descriptor;
  } }) };
  await waitUntil(() => reentered && el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false');
  let count = 0; el.addEventListener('lr-spatial-bin-select', event => { count = event.detail.count; });
  el.shadowRoot!.querySelector('[part="bin"]')!.dispatchEvent(new MouseEvent('click'));
  expect(count).to.equal(8);
  const pending = deferred<LyraSpatialQuery<SpatialPoint>>();
  let pendingStarted = false, aborted = false;
  el.source = { ...provider(), query: request => { pendingStarted = true; request.signal.addEventListener('abort', () => { aborted = true; el.source = next; }, { once: true }); return pending.promise; } };
  await waitUntil(() => pendingStarted);
  el.source = provider();
  expect(aborted).to.equal(true);
  expect(el.source?.revision).to.equal(2); pending.resolve(response());
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false');
  el.shadowRoot!.querySelector('[part="bin"]')!.dispatchEvent(new MouseEvent('click'));
  expect(count).to.equal(8);
});

it('does not inspect legacy points while a source is active and cancels pending reveal on adoption', async () => {
  const source = provider(); const pending = deferred<SpatialPoint | null>();
  let reads = 0; source.getPoint = () => pending.promise;
  const el = await spatial(source);
  el.points = new Proxy([], { get(target, key, receiver) { reads++; return Reflect.get(target, key, receiver); } });
  el.height = '420px'; await el.updateComplete; expect(reads).to.equal(0);
  const reveal = el.revealSourcePoint('70');
  const parent = el.parentNode!;
  const other = document.implementation.createHTMLDocument('Other document');
  other.adoptNode(el);
  expect(await reveal).to.equal(false);
  document.adoptNode(el); parent.appendChild(el);
  pending.resolve({ id: '70', sourceIndex: 70, x: 70, y: 70 });
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="bin"]').length === 1);
  expect(el.shadowRoot!.activeElement?.getAttribute('data-id') === '70').to.equal(false);
});

it('keeps the newest viewport when abort callbacks synchronously change it again', async () => {
  const pending = deferred<LyraSpatialQuery<SpatialPoint>>();
  let calls = 0;
  const source = provider();
  let el: LyraEmbeddingExplorer;
  source.query = request => {
    if (++calls === 1) {
      request.signal.addEventListener('abort', () => { el.viewport = { minX: 70, maxX: 100, minY: 70, maxY: 100 }; }, { once: true });
      return pending.promise;
    }
    return { matchedCount: 1, bins: [{ bounds: request.bounds, count: 1 }], points: [] };
  };
  el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .source=${source}></lr-embedding-explorer>`);
  el.viewport = { minX: 10, maxX: 40, minY: 10, maxY: 40 };
  pending.resolve(response());
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false');
  let min = -1; el.addEventListener('lr-spatial-bin-select', event => { min = event.detail.bounds.minX; });
  el.shadowRoot!.querySelector('[part="bin"]')!.dispatchEvent(new MouseEvent('click'));
  expect(min).to.equal(70);
});

it('settles a reveal superseded synchronously by a lookup abort callback', async () => {
  const pending = deferred<SpatialPoint | null>();
  const source = provider(); let el: LyraEmbeddingExplorer;
  source.getPoint = (_id, request) => { request.signal.addEventListener('abort', () => { el.source = provider(); }, { once: true }); return pending.promise; };
  el = await spatial(source);
  const first = el.revealSourcePoint('20');
  const second = el.revealSourcePoint('30');
  expect(await first).to.equal(false); expect(await second).to.equal(false);
  pending.resolve(null);
});

const reviewResponse = (count = 100): LyraSpatialQuery<SpatialPoint> => ({ matchedCount: count, bins: [{ bounds: globalBounds, count }], points: [{ id: '50', sourceIndex: 50, x: 50, y: 50 }] });
for (const part of ['point', 'bin']) it(`rejects an obsolete ${part} activation after replacement`, async () => {
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .source=${provider()}></lr-embedding-explorer>`);
  await waitUntil(() => !!el.shadowRoot!.querySelector('[part="point"]'));
  const old = el.shadowRoot!.querySelector(`[part="${part}"]`)!;
  const next = deferred<LyraSpatialQuery<SpatialPoint>>();
  el.source = { ...provider(), revision: 2, query: () => next.promise };
  await el.updateComplete;
  next.resolve(reviewResponse(80));
  await waitUntil(() => el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false'); await el.updateComplete;
  let events = 0;
  el.addEventListener(part === 'point' ? 'lr-point-select' : 'lr-spatial-bin-select', () => { events++; });
  old.dispatchEvent(new MouseEvent('click'));
  old.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  expect(events).to.equal(0);
  el.source = null; await el.updateComplete;
  old.dispatchEvent(new MouseEvent('click'));
  old.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  expect(events).to.equal(0);
});
it('rejects an exact lookup conflicting with a representative admitted while lookup was pending', async () => {
  const query = deferred<LyraSpatialQuery<SpatialPoint>>(), lookup = deferred<SpatialPoint | null>(); let lookups = 0;
  const spatialProvider = { ...provider(), query: () => query.promise, getPoint: () => { lookups++; return lookup.promise; } };
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer selected-point-id="50" .source=${spatialProvider}></lr-embedding-explorer>`);
  await waitUntil(() => lookups === 1);
  query.resolve(reviewResponse());
  await waitUntil(() => !!el.shadowRoot!.querySelector('[part="point"]'));
  lookup.resolve({ id: '50', sourceIndex: 50, x: 60, y: 60 });
  await new Promise(resolve => setTimeout(resolve, 30)); await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
});
it('settles a superseded reveal while an ignored-abort pan query remains pending', async () => {
  const query = deferred<LyraSpatialQuery<SpatialPoint>>(); let calls = 0;
  const spatialProvider = { ...provider(), query: (request: { bounds: LyraSpatialBounds }) => {
    calls++;
    return calls === 1 ? { matchedCount: 1, bins: [{ bounds: request.bounds, count: 1 }], points: [] } : query.promise;
  }, getPoint: (id: string) => ({ id, sourceIndex: Number(id), x: Number(id), y: Number(id) }) };
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer .viewport=${{ minX: 0, maxX: 20, minY: 0, maxY: 20 }} .source=${spatialProvider}></lr-embedding-explorer>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false');
  let settled = false; let value: boolean | undefined;
  const old = el.revealSourcePoint('90').then(result => { settled = true; value = result; });
  await waitUntil(() => calls === 2);
  await el.updateComplete; await Promise.resolve();
  const next = el.revealSourcePoint('80');
  try {
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(settled).to.equal(true); expect(value).to.equal(false);
    expect(calls).to.equal(2);
  } finally {
    query.resolve({ matchedCount: 1, bins: [{ bounds: el.viewport!, count: 1 }], points: [] });
    await old; await next;
  }
});

it('never retains a rejected exact candidate for a later successful viewport response', async () => {
  const source = { ...provider(), getPoint: () => ({ id: '90', sourceIndex: 90, x: 90, y: 90 }) };
  const el = await spatial(source);
  expect(await el.revealSourcePoint('80')).to.equal(false);
  expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
  el.viewport = { ...globalBounds }; await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="error"]').length === 0);
  expect(el.shadowRoot!.querySelectorAll('[data-id="90"]').length).to.equal(0);
});

it('rejects an exact missing result when its ID was represented during the pending lookup', async () => {
  const query = deferred<LyraSpatialQuery<SpatialPoint>>(), lookup = deferred<SpatialPoint | null>();
  let calls = 0;
  const source = { ...provider(), query: () => query.promise, getPoint: () => { calls++; return lookup.promise; } };
  const el = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer selected-point-id="50" .source=${source}></lr-embedding-explorer>`);
  await waitUntil(() => calls === 1); query.resolve(response());
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="point"]').length === 1);
  lookup.resolve(null);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="error"]').length === 1);
});
