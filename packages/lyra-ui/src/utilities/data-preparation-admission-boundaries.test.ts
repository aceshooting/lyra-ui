import { expect } from '@open-wc/testing';
import {
  prepareLyraCategoryData, prepareLyraHistogram, prepareLyraWaveform, prepareLyraWordCloud,
  type LyraIndexedInput, type LyraWeightedWord,
} from './data-preparation.js';

function input<T>(values: readonly T[]): LyraIndexedInput<T> {
  return { revision: 'snapshot', count: values.length, read: (start, count) => values.slice(start, start + count) };
}

async function rejected(promise: Promise<unknown>, message: RegExp): Promise<void> {
  let error: unknown;
  try { await promise; } catch (caught) { error = caught; }
  expect(error).to.be.instanceOf(Error);
  expect((error as Error).message).to.match(message);
}

describe('data preparation admission boundaries', () => {
  it('rejects a missing source reader before starting histogram work', async () => {
    const source = input([1]);
    Reflect.set(source, 'read', undefined);
    await rejected(prepareLyraHistogram(source, { edges: [0, 2] }), /Invalid source reader/);
  });

  it('rejects with the provider-triggered abort reason even when the synchronous read returns data', async () => {
    const controller = new AbortController();
    const reason = new Error('Preparation was cancelled by its owner');
    let reads = 0;
    const result = prepareLyraHistogram({ revision: 1, count: 1, read: () => {
      reads++;
      controller.abort(reason);
      return [1];
    } }, { edges: [0, 2], signal: controller.signal });
    let caught: unknown;
    try { await result; } catch (error) { caught = error; }
    expect(caught === reason).to.equal(true);
    expect(reads).to.equal(1);
  });

  it('preserves an asynchronous provider rejection and does not publish a partial distribution', async () => {
    const reason = new Error('The source could not read its snapshot');
    let reads = 0;
    let published = false;
    const result = prepareLyraHistogram({ revision: 1, count: 2, read: () => {
      reads++;
      return Promise.reject(reason);
    } }, { edges: [0, 2], batchSize: 1 });
    let caught: unknown;
    try { await result; published = true; } catch (error) { caught = error; }
    expect(caught === reason).to.equal(true);
    expect(published).to.equal(false);
    expect(reads).to.equal(1);
  });

  it('rejects excessive aggregate metadata even when every individual label fits', async () => {
    let reads = 0;
    const categories = Array.from({ length: 65 }, (_, index) => ({ id: `category-${index}`, label: 'x'.repeat(1024) }));
    await rejected(prepareLyraCategoryData({ revision: 1, count: 1, read: () => { reads++; return [0]; } }, {
      categories, seriesId: 'counts', seriesLabel: 'Counts', aggregation: 'count', categoryOf: () => categories[0]!.id,
    }), /Metadata label budget exceeded/);
    expect(reads).to.equal(0);
  });

  it('rejects absent or oversized category arrays before calling the source or selector', async () => {
    let reads = 0, selections = 0;
    const source = { revision: 1, count: 1, read: () => { reads++; return [0]; } };
    for (const categories of [null, {}, Array.from({ length: 1001 }, (_, index) => ({ id: String(index), label: 'Category' }))]) {
      const options = { categories: [{ id: 'valid', label: 'Valid' }], seriesId: 'counts', seriesLabel: 'Counts',
        aggregation: 'count' as const, categoryOf: () => { selections++; return 'valid'; } };
      Reflect.set(options, 'categories', categories);
      await rejected(prepareLyraCategoryData(source, options), /Category budget exceeded/);
    }
    expect(reads).to.equal(0);
    expect(selections).to.equal(0);
  });

  it('requires unique category identities and an Other identity present in the category table', async () => {
    const source = input(['unlisted']);
    const options = { categories: [{ id: 'a', label: 'A' }], seriesId: 'counts', seriesLabel: 'Counts',
      aggregation: 'count' as const, categoryOf: (value: string) => value };
    await rejected(prepareLyraCategoryData(source, { ...options, categories: [{ id: 'a', label: 'First' }, { id: 'a', label: 'Second' }] }), /Duplicate category ID/);
    await rejected(prepareLyraCategoryData(source, { ...options, otherCategoryId: 'missing' }), /Unknown Other category ID/);
    const result = await prepareLyraCategoryData(source, { ...options, otherCategoryId: 'a' });
    expect(result.categoryCounts).to.deep.equal([1]);
    expect(result.series[0]!.values).to.deep.equal([1]);
    expect(result.counts).to.deep.equal({ sourceCount: 1, validCount: 1, invalidCount: 0 });
  });

  it('rejects missing and over-budget histogram edge arrays before reading observations', async () => {
    let reads = 0;
    const source = { revision: 1, count: 1, read: () => { reads++; return [0]; } };
    for (const edges of [null, {}, [], [0], Array.from({ length: 1002 }, (_, index) => index)]) {
      const options = { edges: [0, 1] };
      Reflect.set(options, 'edges', edges);
      await rejected(prepareLyraHistogram(source, options), /Invalid histogram edge budget/);
    }
    expect(reads).to.equal(0);
  });

  it('rejects a second histogram pass that introduces values after an empty first pass', async () => {
    let reads = 0;
    await rejected(prepareLyraHistogram({ revision: 1, count: 2, read: () => ++reads === 1 ? [NaN, NaN] : [1, 2] }, { binCount: 2 }), /Source snapshot values changed between passes/);
    expect(reads).to.equal(2);
  });

  it('omits primitive word observations and keeps the global top-K after a shallow heap replacement', async () => {
    const words: LyraWeightedWord[] = [1, 5, 3, 6, 2].map((weight, index) => ({ id: `word-${index}`, text: `Word ${index}`, weight }));
    for (const value of [null, false, 'not a word']) Reflect.set(words, String(words.length), value);
    const result = await prepareLyraWordCloud(input(words), { maxWords: 4 });
    expect(result.words.map(word => [word.id, word.weight])).to.deep.equal([
      ['word-3', 6], ['word-1', 5], ['word-2', 3], ['word-4', 2],
    ]);
    expect(result.counts).to.deep.equal({ sourceCount: 8, validCount: 5, invalidCount: 3 });
    expect(result.totalWeight).to.equal(17);
    expect(result.retainedWeight).to.equal(16);
    expect(Object.isFrozen(result.words)).to.equal(true);
    expect(result.words.every(Object.isFrozen)).to.equal(true);
  });

  it('rejects invalid waveform durations before reading and accepts a zero-duration snapshot', async () => {
    let reads = 0;
    const source = { revision: 1, count: 1, read: () => { reads++; return [0.5]; } };
    for (const duration of [-1, NaN, Infinity]) await rejected(prepareLyraWaveform(source, { duration }), /Invalid waveform duration/);
    expect(reads).to.equal(0);
    const result = await prepareLyraWaveform(source, { duration: 0 });
    expect(result.duration).to.equal(0);
    expect(result.buckets).to.deep.equal([{ startIndex: 0, endIndex: 1, maxAmplitude: 0.5 }]);
    expect(result.firstAmplitude).to.equal(0.5);
    expect(result.lastAmplitude).to.equal(0.5);
    expect(reads).to.equal(1);
  });
});
