import { expect } from '@open-wc/testing';
import {
  prepareLyraSeriesData, prepareLyraCategoryData, prepareLyraHistogram, prepareLyraWordCloud, prepareLyraWaveform,
  type LyraIndexedInput, type LyraSeriesObservation,
} from './data-preparation.js';

function indexed<T>(count: number, value: (index: number) => T) {
  const calls: [number, number][] = [];
  const input: LyraIndexedInput<T> & { revision: string } = {
    revision: 'snapshot', count,
    read(start, size) {
      expect(start).to.be.at.least(0);
      expect(size).to.be.at.least(1).and.at.most(8192);
      expect(start + size).to.be.at.most(count);
      calls.push([start, size]);
      return Array.from({ length: size }, (_, offset) => value(start + offset));
    },
  };
  return { input, calls };
}
function series(input: LyraIndexedInput<LyraSeriesObservation>) { return [{ id: 's', label: 'Series', input }]; }
async function rejects(operation: Promise<unknown>, pattern: RegExp) {
  let error: unknown;
  try { await operation; } catch (caught) { error = caught; }
  expect(error, 'operation must reject').to.be.instanceOf(Error);
  expect(String(error)).to.match(pattern);
}
const signal = () => new AbortController().signal;

describe('staged data preparation', () => {
  it('preserves full series domains, endpoint/extrema indices and omitted gaps', async () => {
    const values = [1, 2, 3, null, 5, 6, 7, 8, -99, 999, 10, 11];
    const source = indexed(values.length, i => ({ x: i === 9 ? -5 : i, y: values[i]! }));
    const result = await prepareLyraSeriesData(series(source.input), { maxPointsPerSeries: 4, batchSize: 3 });
    const data = result.series[0]!;
    expect(data.counts).to.deep.equal({ sourceCount: 12, validCount: 11, invalidCount: 1 });
    expect(data.xDomain).to.deep.equal({ min: -5, max: 11 });
    expect(data.yDomain).to.deep.equal({ min: -99, max: 999 });
    expect(data.samples.map(p => p.sourceIndex)).to.deep.equal([0, 8, 9, 11]);
    expect(data.samples.map(p => p.breakBefore)).to.deep.equal([true, true, false, false]);
    expect(result.queryRange).to.equal(undefined);
    expect(Object.isFrozen(data.samples[0])).to.equal(true);
    source.calls.length = 0;
    expect(await result.getPoint({ seriesId: 's', sourceIndex: 9 }, { signal: signal() })).to.deep.equal({ x: -5, y: 999 });
    expect(source.calls).to.deep.equal([[9, 1]]);
    expect(await result.getPoint({ seriesId: 's', sourceIndex: 3 }, { signal: signal() })).to.equal(null);
    await rejects(Promise.resolve(result.getPoint({ seriesId: 's', sourceIndex: 12 }, { signal: signal() })), /index|range/i);
  });

  it('aggregates categories with full counts, named Other and weighted means', async () => {
    const source = indexed(7, i => ({ category: ['a', 'a', 'b', 'outside', null, 'b', 'a'][i]!, value: [2, 4, 8, 10, 5, NaN, 12][i]! }));
    const result = await prepareLyraCategoryData(source.input, {
      categories: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'other', label: 'Other' }],
      seriesId: 's', seriesLabel: 'Mean', aggregation: 'mean', otherCategoryId: 'other',
      categoryOf: value => value.category, valueOf: value => value.value, batchSize: 2,
    });
    expect(result.categoryCounts).to.deep.equal([3, 1, 1]);
    expect(result.series[0]!.values).to.deep.equal([6, 8, 10]);
    expect(result.counts).to.deep.equal({ sourceCount: 7, validCount: 5, invalidCount: 2 });
    expect(Object.isFrozen(result.categories[0])).to.equal(true);
  });

  it('counts explicit histogram edges and outliers exactly', async () => {
    const values = [-1, 0, 1, 2, 3, 4, 5, NaN];
    const result = await prepareLyraHistogram(indexed(values.length, i => values[i]!).input, { edges: [0, 2, 4], batchSize: 2 });
    expect(result.binCounts).to.deep.equal([2, 3]);
    expect([result.belowCount, result.aboveCount]).to.deep.equal([1, 1]);
    expect(result.domain).to.deep.equal({ min: -1, max: 5 });
    expect(result.counts).to.deep.equal({ sourceCount: 8, validCount: 7, invalidCount: 1 });
  });

  it('selects global stable word top-K and rejects invalid labels separately', async () => {
    const words = [
      { id: 'a', text: 'Alpha', weight: 3 }, { id: 'b', text: 'Beta', weight: 3 },
      { id: 'blank', text: ' ', weight: 100 }, { id: 'long', text: 'x'.repeat(257), weight: 100 },
      { id: 'tail', text: 'Tail', weight: 9 }, { id: 'negative', text: 'Negative', weight: -1 },
    ];
    const result = await prepareLyraWordCloud(indexed(words.length, i => words[i]!).input, { maxWords: 2, batchSize: 2 });
    expect(result.words.map(word => word.id)).to.deep.equal(['tail', 'a']);
    expect([result.totalWeight, result.retainedWeight]).to.deep.equal([15, 12]);
    expect(result.counts).to.deep.equal({ sourceCount: 6, validCount: 3, invalidCount: 3 });
  });

  it('retains waveform positions, tail peaks and original invalid endpoints', async () => {
    const values = [NaN, 0.2, 0.3, 0.4, 0.5, 2, -1, NaN];
    const result = await prepareLyraWaveform(indexed(values.length, i => values[i]!).input, { duration: 8, maxBuckets: 3, batchSize: 2 });
    expect(result.buckets[0]!.startIndex).to.equal(0);
    expect(result.buckets.at(-1)!.endIndex).to.equal(8);
    expect(result.buckets.map(bucket => bucket.maxAmplitude)).to.deep.equal([0.3, 1, 0]);
    expect(result.sampleCount).to.equal(8);
    expect(result.counts).to.deep.equal({ sourceCount: 8, validCount: 6, invalidCount: 2 });
    expect([result.firstAmplitude, result.lastAmplitude]).to.deep.equal([null, null]);
  });

  it('processes one million observations through each bounded reducer', async function () {
    this.timeout(30000);
    const n = 1_000_000;
    const pointSource = indexed(n, i => ({ x: i, y: i === n - 2 ? 1e9 : i === 501234 ? -1e9 : i % 13 }));
    const categorySource = indexed(n, i => i);
    const numberSource = indexed(n, i => i);
    const wordSource = indexed(n, i => ({ id: String(i), text: `Word ${i}`, weight: i }));
    const waveSource = indexed(n, i => i === n - 1 ? 1 : 0);
    // Every reducer yields a macrotask between chunks, so running the five independent reductions
    // concurrently overlaps those waits instead of serialising them; each owns its own source.
    const [points, categories, histogram, words, wave] = await Promise.all([
      prepareLyraSeriesData(series(pointSource.input), { maxPointsPerSeries: 100, batchSize: 8192 }),
      prepareLyraCategoryData(categorySource.input, {
        categories: [{ id: 'even', label: 'Even' }, { id: 'odd', label: 'Odd' }], seriesId: 's', seriesLabel: 'Count',
        categoryOf: i => i % 2 ? 'odd' : 'even', aggregation: 'count', batchSize: 8192,
      }),
      prepareLyraHistogram(numberSource.input, { binCount: 100, batchSize: 8192 }),
      prepareLyraWordCloud(wordSource.input, { maxWords: 150, batchSize: 8192 }),
      prepareLyraWaveform(waveSource.input, { duration: 3600, maxBuckets: 1000, batchSize: 8192 }),
    ]);
    expect(points.series[0]!.samples.length).to.be.at.most(100);
    expect(points.series[0]!.samples.map(p => p.sourceIndex)).to.include.members([0, 501234, n - 2, n - 1]);
    expect(points.series[0]!.counts.validCount).to.equal(n);
    expect(pointSource.calls.reduce((sum, [, size]) => sum + size, 0)).to.equal(n);
    expect(categories.series[0]!.values).to.deep.equal([n / 2, n / 2]);
    expect(histogram.binCounts.reduce((sum, count) => sum + count, 0)).to.equal(n);
    expect(histogram.binCounts).to.have.length(100);
    expect(numberSource.calls.reduce((sum, [, size]) => sum + size, 0)).to.equal(2 * n);
    expect(words.words).to.have.length(150);
    expect(words.words[0]!.id).to.equal(String(n - 1));
    expect(words.totalWeight).to.equal(n * (n - 1) / 2);
    expect(wave.buckets).to.have.length(1000);
    expect(wave.buckets.at(-1)).to.deep.equal({ startIndex: 999000, endIndex: n, maxAmplitude: 1 });
    expect(wave.counts.validCount).to.equal(n);
    for (const source of [categorySource, wordSource, waveSource]) {
      expect(source.calls.reduce((sum, [, size]) => sum + size, 0)).to.equal(n);
    }
  });
  it('handles zero and all-invalid inputs without fabricated domains or endpoints', async () => {
    for (const count of [0, 7]) {
      const data = await prepareLyraSeriesData(series(indexed(count, () => ({ x: NaN, y: null })).input));
      expect(data.series[0]!.samples).to.deep.equal([]);
      expect(data.series[0]!.xDomain).to.equal(null);
      expect(data.series[0]!.counts).to.deep.equal({ sourceCount: count, validCount: 0, invalidCount: count });
      const histogram = await prepareLyraHistogram(indexed(count, () => NaN).input, { binCount: 10 });
      expect(histogram.edges).to.deep.equal([]);
      expect(histogram.binCounts).to.deep.equal([]);
      const words = await prepareLyraWordCloud(indexed(count, () => ({ id: 'x', text: '', weight: 1 })).input);
      expect(words.words).to.deep.equal([]);
      expect(words.totalWeight).to.equal(0);
      const wave = await prepareLyraWaveform(indexed(count, () => NaN).input, { duration: 0 });
      expect(wave.buckets).to.have.length(count);
      expect(wave.buckets.every(bucket => bucket.maxAmplitude === 0)).to.equal(true);
      expect(wave.firstAmplitude).to.equal(null);
    }
  });

  it('keeps short series exact without duplicating extrema/endpoints', async () => {
    for (const count of [1, 2, 3, 4]) {
      const result = await prepareLyraSeriesData(series(indexed(count, i => ({ x: i, y: i })).input), { maxPointsPerSeries: 4 });
      expect(result.series[0]!.samples.map(p => p.sourceIndex)).to.deep.equal(Array.from({ length: count }, (_, i) => i));
    }
  });

  it('rejects malformed counts, revisions, ranges and responses', async () => {
    for (const count of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await rejects(prepareLyraHistogram({ revision: 'r', count, read: () => [] }, { edges: [0, 1] }), /count/i);
    }
    for (const revision of ['', NaN]) {
      await rejects(prepareLyraHistogram({ revision, count: 0, read: () => [] }, { edges: [0, 1] }), /revision/i);
    }
    await rejects(prepareLyraHistogram({ revision: 'r', count: 2, read: () => [1] }, { edges: [0, 1] }), /response|range/i);
    await rejects(prepareLyraHistogram({ revision: 'r', count: 1, read: () => new Float64Array([1]) as unknown as number[] }, { edges: [0, 1] }), /response|range/i);
    await rejects(prepareLyraSeriesData([]), /series/i);
    await rejects(prepareLyraSeriesData(series(indexed(0, () => ({ x: 0, y: 0 })).input), { maxPointsPerSeries: 3 }), /point|budget/i);
    const input = indexed(0, () => ({ x: 0, y: 0 })).input;
    await rejects(prepareLyraSeriesData(Array.from({ length: 10 }, (_, i) => ({ id: String(i), label: 'S', input })), { maxPointsPerSeries: 1000 }), /budget|capacity/i);
    await rejects(prepareLyraSeriesData([...series(input), ...series(input)]), /duplicate/i);
  });

  it('rejects mixed and changing revisions, including between histogram passes and point reads', async () => {
    const first = indexed(3, i => ({ x: i, y: i }));
    const second = indexed(3, i => ({ x: i, y: i }));
    second.input.revision = 'other';
    await rejects(prepareLyraSeriesData([...series(first.input), { id: 't', label: 'T', input: second.input }]), /revision/i);
    const result = await prepareLyraSeriesData(series(first.input));
    first.input.revision = 'new';
    await rejects(Promise.resolve(result.getPoint({ seriesId: 's', sourceIndex: 1 }, { signal: signal() })), /revision|snapshot/i);
    const source = indexed(4, i => i);
    const read = source.input.read;
    source.input.read = (start, count, request) => {
      const values = read(start, count, request);
      if (source.calls.length === 3) source.input.revision = 'changed';
      return values;
    };
    await rejects(prepareLyraHistogram(source.input, { binCount: 2, batchSize: 2 }), /revision|snapshot/i);
  });

  it('aborts before reading and while a provider ignores cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const source = indexed(10, i => i);
    await rejects(prepareLyraHistogram(source.input, { edges: [0, 10], signal: controller.signal }), /abort/i);
    expect(source.calls).to.have.length(0);
    const pendingController = new AbortController();
    let called = 0;
    const pending = prepareLyraHistogram({ revision: 'r', count: 1, read: () => { called++; return new Promise(() => {}); } }, { edges: [0, 1], signal: pendingController.signal });
    expect(called).to.equal(1);
    pendingController.abort();
    await rejects(pending, /abort/i);
  });

  it('yields between chunks, clamps batch sizes and cancels before the next read', async () => {
    const source = indexed(20, i => i);
    const controller = new AbortController();
    const read = source.input.read;
    source.input.read = (start, count, request) => {
      const result = read(start, count, request);
      setTimeout(() => controller.abort(), 0);
      return result;
    };
    await rejects(prepareLyraHistogram(source.input, { edges: [0, 20], batchSize: 2, signal: controller.signal }), /abort/i);
    expect(source.calls).to.deep.equal([[0, 2]]);
    const clamped = indexed(9000, i => i);
    await prepareLyraHistogram(clamped.input, { edges: [0, 9000], batchSize: 1e6 });
    expect(clamped.calls).to.deep.equal([[0, 8192], [8192, 808]]);
  });

  it('rejects finite sum overflow and counts unknown categories as invalid', async () => {
    const options = { categories: [{ id: 'a', label: 'A' }], seriesId: 's', seriesLabel: 'S', categoryOf: () => 'a', valueOf: (n: number) => n, aggregation: 'sum' as const };
    await rejects(prepareLyraCategoryData(indexed(2, () => Number.MAX_VALUE).input, options), /overflow/i);
    const result = await prepareLyraCategoryData(indexed(3, i => i).input, { ...options, categoryOf: i => i === 1 ? 'a' : 'unknown' });
    expect(result.counts).to.deep.equal({ sourceCount: 3, validCount: 1, invalidCount: 2 });
    expect(result.categoryCounts).to.deep.equal([1]);
    await rejects(prepareLyraWordCloud(indexed(2, i => ({ id: String(i), text: 'Word', weight: Number.MAX_VALUE })).input), /overflow/i);
  });

  it('builds finite automatic histogram edges for constant and extreme domains', async () => {
    for (const values of [[0, 0], [Number.MAX_VALUE, Number.MAX_VALUE], [-Number.MAX_VALUE, -Number.MAX_VALUE], [-Number.MAX_VALUE, Number.MAX_VALUE]]) {
      const result = await prepareLyraHistogram(indexed(values.length, i => values[i]!).input, { binCount: 4 });
      expect(result.edges).to.have.length(5);
      expect(result.edges.every(Number.isFinite)).to.equal(true);
      expect(result.edges.every((edge, i) => i === 0 || edge > result.edges[i - 1]!)).to.equal(true);
      expect(result.domain).to.deep.equal({ min: Math.min(...values), max: Math.max(...values) });
      expect(result.binCounts.reduce((sum, count) => sum + count, 0)).to.equal(2);
    }
    await rejects(prepareLyraHistogram(indexed(1, () => 1).input, { edges: [0, 0, 1] }), /edge/i);
  });

  it('rejects retained duplicate word IDs and selected label-budget overflow', async () => {
    await rejects(prepareLyraWordCloud(indexed(2, () => ({ id: 'same', text: 'Word', weight: 1 })).input), /duplicate/i);
    const source = indexed(65, i => ({ id: String(i), text: 'x'.repeat(256), weight: i }));
    await rejects(prepareLyraWordCloud(source.input), /label|text|budget/i);
    const result = await prepareLyraWordCloud(source.input, { maxWords: 64 });
    expect(result.words).to.have.length(64);
    expect(result.counts.validCount).to.equal(65);
  });

  it('rejects revision/count mutation after an asynchronous range read', async () => {
    const source = indexed(1, i => i);
    source.input.read = async () => { await Promise.resolve(); source.input.revision = 'new'; return [1]; };
    await rejects(prepareLyraWaveform(source.input, { duration: 1 }), /revision|snapshot/i);
    const countsChanged = { revision: 'r', count: 1, async read() { this.count = 2; return [1]; } };
    await rejects(prepareLyraHistogram(countsChanged, { edges: [0, 2] }), /count|snapshot/i);
  });

  it('preserves gaps when the missing position itself is not selected', async () => {
    const source = indexed(100, i => ({ x: i, y: i === 45 ? null : i === 30 ? -100 : i === 70 ? 100 : 0 }));
    const result = await prepareLyraSeriesData(series(source.input), { maxPointsPerSeries: 4, batchSize: 7 });
    expect(result.series[0]!.samples.map(p => [p.sourceIndex, p.breakBefore])).to.deep.equal([[0, true], [30, false], [70, true], [99, false]]);
  });

  it('validates metadata/limits and keeps zero-count categories immutable', async () => {
    const input = indexed(0, () => ({ x: 0, y: 0 })).input;
    await rejects(prepareLyraSeriesData([{ id: 'x'.repeat(257), label: 'S', input }]), /metadata/i);
    await rejects(prepareLyraSeriesData([{ id: 's', label: 'x'.repeat(1025), input }]), /metadata/i);
    for (const batchSize of [0, -1, 1.5, Infinity]) {
      await rejects(prepareLyraWaveform(indexed(0, () => 0).input, { duration: 1, batchSize }), /budget/i);
    }
    const empty = await prepareLyraCategoryData(indexed(0, () => 0).input, {
      categories: [{ id: 'a', label: 'A' }], seriesId: 's', seriesLabel: 'S', aggregation: 'mean', categoryOf: () => 'a', valueOf: n => n,
    });
    expect(empty.series[0]!.values).to.deep.equal([0]);
    expect(empty.categoryCounts).to.deep.equal([0]);
    expect(Object.isFrozen(empty.series[0]!.values)).to.equal(true);
    const waveform = await prepareLyraWaveform(indexed(3, i => i - 1).input, { duration: 1, maxBuckets: 10 });
    expect(waveform.buckets).to.have.length(3);
    expect([waveform.firstAmplitude, waveform.lastAmplitude]).to.deep.equal([0, 1]);
  });

  it('accepts plain count options and requires own sum/mean callbacks', async () => {
    const input = indexed(2, i => i).input;
    const base = { categories: [{ id: 'a', label: 'A' }], seriesId: 's', seriesLabel: 'S', categoryOf: () => 'a' };
    const counted = await prepareLyraCategoryData(input, { ...base, aggregation: 'count' });
    expect(counted.series[0]!.values).to.deep.equal([2]);
    const ignored = await prepareLyraCategoryData(input, { ...base, aggregation: 'count', valueOf: () => { throw new Error('Must not be called'); } });
    expect(ignored.series[0]!.values).to.deep.equal([2]);
    // @ts-expect-error Sum requires an explicit numeric reducer.
    await rejects(prepareLyraCategoryData(input, { ...base, aggregation: 'sum' }), /reducer/i);
    // @ts-expect-error Mean requires an explicit numeric reducer.
    await rejects(prepareLyraCategoryData(input, { ...base, aggregation: 'mean' }), /reducer/i);
    const inherited = Object.assign(Object.create({ valueOf: (n: number) => n }) as { valueOf: (n: number) => number }, base, { aggregation: 'sum' as const });
    await rejects(prepareLyraCategoryData(input, inherited), /reducer/i);
  });

  it('counts sparse positions as invalid without invoking category selectors', async () => {
    const values = new Array<number | undefined>(5);
    values[1] = 7;
    values[4] = undefined;
    const visited: number[] = [];
    const result = await prepareLyraCategoryData({ revision: 'r', count: values.length, read: (start, count) => values.slice(start, start + count) }, {
      categories: [{ id: 'a', label: 'A' }], seriesId: 's', seriesLabel: 'S', aggregation: 'count', batchSize: 2,
      categoryOf: (_value, index) => { visited.push(index); return 'a'; },
    });
    expect(visited).to.deep.equal([1, 4]);
    expect(result.counts).to.deep.equal({ sourceCount: 5, validCount: 2, invalidCount: 3 });
    expect(result.categoryCounts).to.deep.equal([2]);
  });

  it('ignores the count reducer valueOf property without reading its accessor', async () => {
    let reads = 0;
    const options = {
      categories: [{ id: 'a', label: 'A' }], seriesId: 's', seriesLabel: 'S', aggregation: 'count' as const,
      categoryOf: () => 'a',
      get valueOf(): (value: number, index: number) => unknown { reads++; throw new Error('Ignored accessor'); },
    };
    const result = await prepareLyraCategoryData(indexed(3, i => i).input, options);
    expect(reads).to.equal(0);
    expect(result.categoryCounts).to.deep.equal([3]);
  });

  it('does not fabricate exact series points from inherited sparse-array entries', async () => {
    const input: LyraIndexedInput<LyraSeriesObservation> = {
      revision: 'r', count: 1,
      read() {
        const values = new Array<LyraSeriesObservation>(1);
        Object.setPrototypeOf(values, Object.assign(Object.create(Array.prototype) as object, { 0: { x: 123, y: 456 } }));
        return values;
      },
    };
    const result = await prepareLyraSeriesData(series(input));
    expect(result.series[0]!.counts.validCount).to.equal(0);
    expect(await result.getPoint({ seriesId: 's', sourceIndex: 0 }, { signal: signal() })).to.equal(null);
  });

});
