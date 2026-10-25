import { expect } from '@open-wc/testing';
import { prepareChartModel, preparedResponse, revealPreparedSourcePoint, withPreparedPoint, withPreparedRange } from './chart-prepared-data.js';
import type { LyraPreparedCategoryData, LyraPreparedSeriesData, LyraSeriesRangeRequest, LyraSeriesSample } from '../../../utilities/data-preparation.js';

function source(): LyraPreparedSeriesData {
  return { kind: 'series', revision: 'r', series: [{ id: 's', label: 'S', counts: { sourceCount: 1000, validCount: 999, invalidCount: 1 }, xDomain: { min: 0, max: 999 }, yDomain: { min: -5, max: 8 }, samples: [
    { x: 0, y: 1, sourceIndex: 0, breakBefore: true },
    { x: 200, y: -5, sourceIndex: 200, breakBefore: false },
    { x: 800, y: 8, sourceIndex: 800, breakBefore: true },
    { x: 999, y: 2, sourceIndex: 999, breakBefore: false },
  ] }], getPoint: () => null };
}

it('keeps source provenance and explicit gap separators in a bounded immutable model', () => {
  const model = prepareChartModel(source(), 'line', 1000);
  expect(model.series[0]!.samples.map(point => point?.sourceIndex ?? null)).to.deep.equal([0, 200, null, 800, 999]);
  expect(model.validCount).to.equal(999);
  expect(model.peerCount).to.equal(5);
  expect(Object.isFrozen(model.series[0]!.samples)).to.equal(true);
  const overlay = withPreparedPoint(model, { seriesId: 's', sourceIndex: 500 }, { x: 500, y: 3 });
  expect(overlay.series[0]!.samples.at(-1)?.sourceIndex).to.equal(500);
  expect(overlay.validCount).to.equal(999);
});

it('rejects incompatible types, malformed counts and nonfinite samples', () => {
  expect(() => prepareChartModel(source(), 'pie', 1000)).to.throw();
  const invalid = source();
  (invalid.series[0]!.counts as { validCount: number }).validCount = 1001;
  expect(() => prepareChartModel(invalid, 'line', 1000)).to.throw();
  const sample = source();
  (sample.series[0]!.samples[0] as { y: number }).y = Infinity;
  expect(() => prepareChartModel(sample, 'line', 1000)).to.throw();
});

it('charges gap separators, overlays and rectangular multi-series cells to existing budgets', () => {
  expect(() => prepareChartModel(source(), 'line', 6)).to.throw(/budget|capacity/i);
  expect(prepareChartModel(source(), 'line', 7).peerCount).to.equal(5);
  const base = source();
  const many = { ...base, series: Array.from({ length: 150 }, (_, index) => ({ ...base.series[0]!, id: String(index) })) };
  expect(() => prepareChartModel(many, 'line', 1000)).to.throw(/budget|capacity/i);
});

it('rejects sparse/accessor summary arrays without evaluating them', () => {
  const base = source();
  let reads = 0;
  const samples = [...base.series[0]!.samples];
  Object.defineProperty(samples, 0, { get() { reads++; return base.series[0]!.samples[0]; } });
  expect(() => prepareChartModel({ ...base, series: [{ ...base.series[0]!, samples }] }, 'line', 1000)).to.throw();
  expect(reads).to.equal(0);
});

it('rejects aggregate category overflow before copying discarded series values', () => {
  let inspected = 0;
  const values = new Proxy(new Array<number>(1000).fill(1), {
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === 'string' && /^\d+$/u.test(key)) inspected++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const prepared = { kind: 'categories', revision: 'r', counts: { sourceCount: 1000, validCount: 1000, invalidCount: 0 },
    categories: Array.from({ length: 1000 }, (_, index) => ({ id: String(index), label: String(index) })), categoryCounts: new Array<number>(1000).fill(1), aggregation: 'count',
    series: Array.from({ length: 1000 }, (_, index) => ({ id: String(index), label: String(index), values })),
  };
  expect(() => prepareChartModel(prepared, 'bar', 1000)).to.throw(/budget|capacity/i);
  expect(inspected).to.be.at.most(1000);
});

function categories(): LyraPreparedCategoryData {
  return { kind: 'categories', revision: 'c', aggregation: 'count', counts: { sourceCount: 30, validCount: 30, invalidCount: 0 },
    categories: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], categoryCounts: [10, 20],
    series: [{ id: 's', label: 'Count', values: [10, 20] }] };
}

it('refuses to overlay an exact point on category data or on an unknown series, and keeps a known point as is', () => {
  const model = prepareChartModel(source(), 'line', 1000);
  const grouped = prepareChartModel(categories(), 'bar', 1000);
  expect(() => withPreparedPoint(grouped, { seriesId: 's', sourceIndex: 0 }, { x: 0, y: 1 })).to.throw(TypeError, 'Exact points require prepared series');
  expect(() => withPreparedPoint(model, { seriesId: 'missing', sourceIndex: 500 }, { x: 500, y: 3 })).to.throw(RangeError, 'Unknown prepared series');
  expect(withPreparedPoint(model, { seriesId: 's', sourceIndex: 200 }, { x: 200, y: -5 }) === model).to.equal(true);
});

it('refuses a range refinement for category data or an unknown series and replaces only the requested series samples', () => {
  const model = prepareChartModel(source(), 'line', 1000);
  const request = (seriesId: string): LyraSeriesRangeRequest => ({
    signal: new AbortController().signal, seriesId, startIndex: 100, endIndex: 300, maxPoints: 10,
  });
  const refinement = [{ x: 150, y: 2, sourceIndex: 150, breakBefore: true }];
  expect(() => withPreparedRange(prepareChartModel(categories(), 'bar', 1000), request('s'), refinement)).to.throw(TypeError, 'Refinement requires prepared series');
  expect(() => withPreparedRange(model, request('missing'), refinement)).to.throw(RangeError, 'Unknown prepared series');
  const refined = withPreparedRange(model, request('s'), refinement);
  expect(refined.series[0]!.samples.map(point => point?.sourceIndex ?? null)).to.deep.equal([150]);
  expect(refined.validCount).to.equal(model.validCount);
  expect(refined.series[0]!.xDomain).to.deep.equal(model.series[0]!.xDomain);
  expect(() => withPreparedRange(model, request('s'), [{ x: 400, y: 2, sourceIndex: 400, breakBefore: true }])).to.throw(RangeError, 'Refinement outside requested range');
});

describe('preparedResponse', () => {
  it('settles with a host reply that finishes before cancellation', async () => {
    expect(await preparedResponse(Promise.resolve(7), new AbortController().signal)).to.equal(7);
    expect(await preparedResponse(5, new AbortController().signal)).to.equal(5);
  });

  it('rejects promptly with the abort reason even when the host reader ignores its signal', async () => {
    const reason = new Error('replaced');
    const controller = new AbortController();
    const outcome = preparedResponse(new Promise<number>(() => undefined), controller.signal).then(() => 'resolved', error => error === reason ? 'reason' : 'other');
    controller.abort(reason);
    expect(await outcome).to.equal('reason');
    const early = await preparedResponse(new Promise<number>(() => undefined), AbortSignal.abort(reason)).then(() => 'resolved', error => error === reason ? 'reason' : 'other');
    expect(early).to.equal('reason');
  });
});

describe('prepared source point reveal', () => {
  const ref = { seriesId: 's', sourceIndex: 500 };

  it('distinguishes absent points from an obsolete reply without refining either', async () => {
    const input = source();
    let queries = 0;
    input.queryRange = () => { queries++; return []; };
    const model = prepareChartModel(input, 'line', 1000);
    expect((await revealPreparedSourcePoint(model, ref, new AbortController().signal, () => true)).status).to.equal('absent');
    expect((await revealPreparedSourcePoint(model, ref, new AbortController().signal, () => false)).status).to.equal('stale');
    expect(queries).to.equal(0);
  });

  it('retains the complete summary and source identity when adding an isolated exact point', async () => {
    const input = source();
    input.getPoint = () => ({ x: 500, y: 3 });
    const model = prepareChartModel(input, 'line', 1000);
    const result = await revealPreparedSourcePoint(model, ref, new AbortController().signal, () => true);
    if (result.status !== 'ready') throw new Error('Expected exact point');
    expect(result.model.source === input).to.equal(true);
    expect(result.model.series[0]!.samples.map(point => point?.sourceIndex ?? null)).to.deep.equal([0, 200, null, 800, 999, null, 500]);
    expect(result.model.validCount).to.equal(model.validCount);
    expect(result.model.series[0]!.xDomain).to.deep.equal(model.series[0]!.xDomain);
    expect(model.peerCount).to.equal(5);
  });

  it('settles a canceled point even when its reader ignores the signal', async () => {
    const input = source();
    input.getPoint = () => new Promise<never>(() => undefined);
    const controller = new AbortController();
    const reason = new Error('Canceled point');
    const pending = revealPreparedSourcePoint(prepareChartModel(input, 'line', 1000), ref, controller.signal, () => true)
      .then(() => 'accepted', error => error === reason ? 'canceled' : 'other');
    controller.abort(reason);
    expect(await pending).to.equal('canceled');
  });

  it('checks revision after a refinement resolves without replacing the completed model', async () => {
    const input = source();
    input.getPoint = () => ({ x: 500, y: 3 });
    let finish!: (points: readonly LyraSeriesSample[]) => void;
    let started!: () => void;
    const requested = new Promise<void>(resolve => { started = resolve; });
    input.queryRange = () => { started(); return new Promise(resolve => { finish = resolve; }); };
    const model = prepareChartModel(input, 'line', 1000);
    const pending = revealPreparedSourcePoint(model, ref, new AbortController().signal, () => true);
    await requested;
    Object.defineProperty(input, 'revision', { value: 'new' });
    finish([{ x: 500, y: 3, sourceIndex: 500, breakBefore: true }]);
    expect((await pending).status).to.equal('stale');
    expect(model.series[0]!.samples.map(point => point?.sourceIndex ?? null)).to.deep.equal([0, 200, null, 800, 999]);
  });

  it('preserves the validated descriptor and subsequent receiver-bound refinement lookup', async () => {
    const original = source();
    const calls: string[] = [];
    original.getPoint = () => ({ x: 500, y: 3 });
    original.queryRange = () => { calls.push('descriptor'); return []; };
    const input = new Proxy(original, { get(target, key, receiver) {
      if (key === 'queryRange') return function (this: unknown) {
        calls.push(this === input ? 'lookup' : 'wrong receiver');
        return [{ x: 200, y: -5, sourceIndex: 200, breakBefore: true }];
      };
      return Reflect.get(target, key, receiver);
    } });
    const result = await revealPreparedSourcePoint(prepareChartModel(input, 'line', 1000), ref, new AbortController().signal, () => true);
    expect(result.status).to.equal('ready');
    expect(calls).to.deep.equal(['lookup']);
  });

  it('keeps descriptor refusal separate from a missing refinement capability', async () => {
    const input = source();
    input.getPoint = () => ({ x: 500, y: 3 });
    let reads = 0;
    Object.defineProperty(input, 'queryRange', { get() { reads++; return () => []; } });
    const result = await revealPreparedSourcePoint(prepareChartModel(input, 'line', 1000), ref, new AbortController().signal, () => true)
      .then(() => 'accepted', error => error instanceof TypeError ? 'invalid' : 'other');
    expect(result).to.equal('invalid'); expect(reads).to.equal(0);
  });

  it('rechecks authority after exact point descriptors are copied into the overlay', async () => {
    const input = source();
    let current = true;
    input.getPoint = () => new Proxy({ x: 500, y: 3 }, { getOwnPropertyDescriptor(target, key) {
      current = false;
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    const result = await revealPreparedSourcePoint(prepareChartModel(input, 'line', 1000), ref, new AbortController().signal, () => current);
    expect(result.status).to.equal('stale');
  });
});
