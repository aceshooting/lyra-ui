import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { SpatialSourceController } from './spatial-source-controller.js';
import '../components/retrieval/embedding-explorer/embedding-explorer.js';
import type { LyraEmbeddingExplorer } from '../components/retrieval/embedding-explorer/embedding-explorer.class.js';
import type { LyraSpatialChartSource, LyraSpatialChartPoint } from '../utilities/data-spatial.js';

const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
const point: LyraSpatialChartPoint = { id: 'p', sourceIndex: 20, x: 20, y: 20, seriesId: 'a', radius: 10, label: 'Point' };
function source(): LyraSpatialChartSource {
  return { kind: 'spatial', revision: 'chart', count: 100, bounds, series: [{ id: 'a', label: 'Alpha', color: 'red' }], radiusDomain: { min: 1, max: Number.MAX_VALUE },
    query: () => ({ matchedCount: 100, bins: [{ bounds, count: 100 }], points: [point] }),
    getPoint: id => ({ ...point, id, sourceIndex: 99, x: 99, radius: Number.MAX_VALUE }),
  };
}
async function controller() {
  const host = await fixture<LyraEmbeddingExplorer>(html`<lr-embedding-explorer></lr-embedding-explorer>`);
  return new SpatialSourceController(host, () => {}, () => 'en');
}
async function settle(value: SpatialSourceController) { await waitUntil(() => value.error || !value.loading && value.result !== undefined); }

it('captures immutable chart series and original representative/exact radius without a paint clamp', async () => {
  const value = await controller(); const input = source();
  value.bind(input, null, 1000, '', { type: 'bubble' }); await settle(value);
  expect(value.error).to.equal(false);
  expect(value.result!.points[0]).to.deep.equal(point);
  expect(value.binding!.chart!.series).to.deep.equal(input.series);
  expect(Object.isFrozen(value.binding!.chart!.series[0])).to.equal(true);
  expect(Object.isFrozen(value.binding!.chart!.radiusDomain)).to.equal(true);
  const exact = await value.reveal('last');
  expect(exact!.radius).to.equal(Number.MAX_VALUE); expect(exact!.seriesId).to.equal('a');
});

it('rejects missing bubble radius and undeclared series instead of dropping chart identity', async () => {
  for (const candidate of [{ ...point, radius: undefined }, { ...point, seriesId: 'unknown' }]) {
    const value = await controller(); const input = source();
    input.query = () => ({ matchedCount: 100, bins: [{ bounds, count: 100 }], points: [candidate] });
    value.bind(input, null, 1000, '', { type: 'bubble' }); await settle(value);
    expect(value.error).to.equal(true); expect(value.result === undefined).to.equal(true);
  }
});

it('validates full-source radius domains before issuing a query', async () => {
  for (const radiusDomain of [undefined, null, { min: -1, max: 1 }, { min: 2, max: 1 }, { min: 0, max: Infinity }]) {
    const value = await controller(); let calls = 0;
    const input = { ...source(), radiusDomain, query: () => { calls++; throw new Error(); } };
    value.bind(input, null, 1000, '', { type: 'bubble' });
    expect(value.error).to.equal(true); expect(calls).to.equal(0);
  }
  const empty = await controller(); empty.bind({ ...source(), count: 0, bounds: null, radiusDomain: null }, null, 1000, '', { type: 'bubble' });
  expect(empty.result!.matchedCount).to.equal(0); expect(empty.error).to.equal(false);
});

it('rejects invalid radius in representative and exact routes', async () => {
  for (const radius of [-1, NaN, Infinity, 0]) {
    const value = await controller(); const input = source();
    input.query = () => ({ matchedCount: 100, bins: [{ bounds, count: 100 }], points: [{ ...point, radius }] });
    value.bind(input, null, 1000, '', { type: 'bubble' }); await settle(value); expect(value.error).to.equal(true);
    const exact = await controller(); const valid = source(); valid.getPoint = id => ({ ...point, id, radius });
    exact.bind(valid, null, 1000, '', { type: 'bubble' }); await settle(exact);
    expect(await exact.reveal('other')).to.equal(null); expect(exact.error).to.equal(true);
  }
});

it('allows radius-free scatter and requires an exact domain for optional radius', async () => {
  const value = await controller(); const input = { ...source(), radiusDomain: undefined };
  input.query = () => ({ matchedCount: 100, bins: [{ bounds, count: 100 }], points: [{ ...point, radius: undefined }] });
  value.bind(input, null, 1000, '', { type: 'scatter' }); await settle(value); expect(value.error).to.equal(false);
  input.query = source().query;
  value.bind(input, null, 1000, '', { type: 'scatter' }); await settle(value); expect(value.error).to.equal(true);
});

it('bounds series capture and rejects duplicate, sparse, accessor and oversized metadata', async () => {
  const accessor = { id: 'a', get label(): string { throw new Error('must not execute'); } };
  for (const series of [[], new Array(1), [accessor], [{ id: 'a', label: '' }, { id: 'a', label: '' }],
    [{ id: ' ', label: '' }], [{ id: 'a', label: 'x'.repeat(1025) }], [{ id: 'a', label: '', color: 'x'.repeat(257) }],
    Array.from({ length: 1001 }, (_, i) => ({ id: String(i), label: '' })),
    Array.from({ length: 65 }, (_, i) => ({ id: String(i), label: 'x'.repeat(1024) }))]) {
    const value = await controller(); value.bind({ ...source(), series }, null, 1000, '', { type: 'bubble' }); expect(value.error).to.equal(true);
  }
});

it('keeps the embedding projection independent of chart metadata and getters', async () => {
  const value = await controller(); const input = source();
  for (const key of ['kind', 'series', 'radiusDomain']) Object.defineProperty(input, key, { get: () => { throw new Error('chart metadata read'); } });
  const raw = { id: 'p', sourceIndex: 20, x: 20, y: 20, label: 'Point', sourceId: 'original', cluster: 4 };
  for (const key of ['seriesId', 'radius']) Object.defineProperty(raw, key, { get: () => { throw new Error('chart point read'); } });
  input.query = () => ({ matchedCount: 100, bins: [{ bounds, count: 100 }], points: [raw as unknown as LyraSpatialChartPoint] });
  value.bind(input, null, 1000, ''); await settle(value);
  expect(value.error).to.equal(false); expect(value.result!.points[0]).to.deep.equal(raw);
});

it('retains newer binding authority during reentrant series descriptor capture', async () => {
  const value = await controller(); const newer = { ...source(), revision: 'newer' };
  const input = source(); let replaced = false;
  const series = new Proxy(input.series, { getOwnPropertyDescriptor(target, key) {
    if (!replaced) { replaced = true; value.bind(newer, null, 1000, '', { type: 'bubble' }); }
    return Reflect.getOwnPropertyDescriptor(target, key);
  } });
  value.bind({ ...input, series }, null, 1000, '', { type: 'bubble' }); await settle(value);
  expect(value.binding!.revision).to.equal('newer'); expect(value.error).to.equal(false);
});

it('compares series and radius against representatives committed during exact lookup', async () => {
  for (const changed of [{ radius: 11 }, { seriesId: 'b' }]) {
    const value = await controller(); const input = source();
    let resolve!: (value: LyraSpatialChartPoint) => void;
    input.getPoint = () => new Promise(done => { resolve = done; });
    const prepared = { ...input, series: [...input.series, { id: 'b', label: 'Beta' }] };
    value.bind(prepared, null, 1000, '', { type: 'bubble' });
    const reveal = value.reveal('p'); await settle(value); resolve({ ...point, ...changed });
    expect(await reveal).to.equal(null); expect(value.error).to.equal(true); expect(value.revealed === undefined).to.equal(true);
  }
});

it('compares a newly queried representative with an already retained exact chart point', async () => {
  for (const changed of [{ radius: 11 }, { seriesId: 'b' }]) {
    const value = await controller(); const input = source(); let queried = 0;
    const prepared = { ...input, series: [...input.series, { id: 'b', label: 'Beta' }],
      query: () => ({ matchedCount: 100, bins: [{ bounds, count: 100 }], points: queried++ ? [{ ...point, ...changed }] : [] }),
      getPoint: () => point,
    };
    value.bind(prepared, null, 1000, '', { type: 'bubble' }); await settle(value);
    expect((await value.reveal('p'))!.id).to.equal('p'); value.configure(null, 1000); await settle(value);
    expect(value.error).to.equal(true); expect(value.revealed!.radius).to.equal(10); expect(value.revealed!.seriesId).to.equal('a');
  }
});

it('counts captured series metadata within the current plus pending retention envelope', async () => {
  const value = await controller(); const input = source();
  const series = Array.from({ length: 50 }, (_, index) => ({ id: String(index).padEnd(256, 's'), label: 'x'.repeat(1024) }));
  const points = Array.from({ length: 640 }, (_, index) => ({ ...point, id: String(index).padEnd(256, 'p'), sourceIndex: index, label: 'x'.repeat(1024), seriesId: series[0]!.id }));
  value.bind({ ...input, count: 1000, series, query: () => ({ matchedCount: 1000, bins: [{ bounds, count: 1000 }], points }) }, null, 10000, '', { type: 'bubble' });
  await settle(value); expect(value.error).to.equal(false); expect(value.result!.points.length).to.equal(640);
  value.configure(null, 10000); await settle(value); expect(value.error).to.equal(true);
  expect(value.result!.points.length).to.equal(640);
});

it('rejects wrong-ID and undeclared-series exact results without retaining them', async () => {
  for (const candidate of [{ ...point, id: 'wrong' }, { ...point, id: 'other', seriesId: 'unknown' }]) {
    const value = await controller(); const input = source(); input.getPoint = () => candidate;
    value.bind(input, null, 1000, '', { type: 'bubble' }); await settle(value);
    expect(await value.reveal('other')).to.equal(null); expect(value.error).to.equal(true); expect(value.points().length).to.equal(1);
  }
});
