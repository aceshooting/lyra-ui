import type { LyraSourceRevision } from '../data-sources.js';
import { sourceCount, sourceRevision } from '../internal/source-request-controller.js';

export type LyraSourceValue<T> = T | PromiseLike<T>;
export interface LyraSourceRequest { readonly signal: AbortSignal; }
/**
 * Immutable, replayable source positions. Count is a safe nonnegative integer. Each read returns
 * an array of exactly the requested size (at most 8,192); holes remain invalid positions, and
 * non-array/short/long responses reject. Revision and payload must stay unchanged while reading.
 * Source-owned storage is never copied wholesale. Observed count/revision changes reject.
 */
export interface LyraIndexedInput<T> {
  readonly revision: LyraSourceRevision;
  readonly count: number;
  read(start: number, count: number, request: LyraSourceRequest): LyraSourceValue<readonly T[]>;
}
/**
 * Preparation inspects all positions in chunks, default 2,048, clamped to 1–8,192. Chunk sizes
 * must be positive safe integers. Tasks yield between chunks and abort before/after each await
 * and before publication. Reader/selector exceptions reject; results are deeply immutable.
 */
export interface LyraPreparationOptions {
  readonly signal?: AbortSignal;
  readonly batchSize?: number;
}
export interface LyraObservationCounts {
  readonly sourceCount: number;
  readonly validCount: number;
  readonly invalidCount: number;
}
export interface LyraNumericDomain { readonly min: number; readonly max: number; }
export interface LyraSeriesObservation { readonly x: number; readonly y: number | null; }
export interface LyraSeriesSample extends LyraSeriesObservation {
  readonly sourceIndex: number;
  readonly breakBefore: boolean;
}
export interface LyraPreparedSeries {
  readonly id: string;
  readonly label: string;
  readonly counts: LyraObservationCounts;
  readonly xDomain: LyraNumericDomain | null;
  readonly yDomain: LyraNumericDomain | null;
  readonly samples: readonly LyraSeriesSample[];
}
export interface LyraSeriesRangeRequest extends LyraSourceRequest {
  readonly seriesId: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly maxPoints: number;
}
export interface LyraSeriesPointRef { readonly seriesId: string; readonly sourceIndex: number; }
export interface LyraPreparedSeriesData {
  readonly kind: 'series';
  readonly revision: LyraSourceRevision;
  readonly series: readonly LyraPreparedSeries[];
  getPoint(ref: LyraSeriesPointRef, request: LyraSourceRequest): LyraSourceValue<LyraSeriesObservation | null>;
  queryRange?(request: LyraSeriesRangeRequest): LyraSourceValue<readonly LyraSeriesSample[]>;
}
export interface LyraPreparedCategoryData {
  readonly kind: 'categories';
  readonly revision: LyraSourceRevision;
  readonly counts: LyraObservationCounts;
  readonly categories: readonly { readonly id: string; readonly label: string }[];
  readonly categoryCounts: readonly number[];
  readonly series: readonly { readonly id: string; readonly label: string; readonly values: readonly number[] }[];
  readonly aggregation: 'count' | 'sum' | 'mean' | 'host-defined';
}
export interface LyraHistogramDistribution {
  readonly revision: LyraSourceRevision;
  readonly counts: LyraObservationCounts;
  readonly domain: LyraNumericDomain | null;
  readonly edges: readonly number[];
  readonly binCounts: readonly number[];
  readonly belowCount: number;
  readonly aboveCount: number;
}
export interface LyraWeightedWord { readonly id: string; readonly text: string; readonly weight: number; }
export interface LyraPreparedWordCloud {
  readonly revision: LyraSourceRevision;
  readonly counts: LyraObservationCounts;
  readonly totalWeight: number;
  readonly retainedWeight: number;
  readonly words: readonly LyraWeightedWord[];
}
export interface LyraPreparedWaveform {
  readonly revision: LyraSourceRevision;
  readonly counts: LyraObservationCounts;
  readonly sampleCount: number;
  readonly duration: number;
  readonly buckets: readonly { readonly startIndex: number; readonly endIndex: number; readonly maxAmplitude: number }[];
  readonly firstAmplitude: number | null;
  readonly lastAmplitude: number | null;
}

interface Snapshot<T> {
  readonly input: LyraIndexedInput<T>;
  readonly revision: LyraSourceRevision;
  readonly count: number;
  readonly read: LyraIndexedInput<T>['read'];
}
interface Preparation {
  readonly signal: AbortSignal;
  readonly batchSize: number;
}

function budget(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new RangeError('Invalid preparation budget');
  return Math.min(value, maximum);
}
function preparation(options: LyraPreparationOptions = {}): Preparation {
  const signal = options.signal ?? new AbortController().signal;
  signal.throwIfAborted();
  return { signal, batchSize: budget(options.batchSize, 2048, 1, 8192) };
}
function snapshot<T>(input: LyraIndexedInput<T>): Snapshot<T> {
  const revision = sourceRevision(input.revision);
  const count = sourceCount(input.count);
  const read = input.read;
  if (typeof read !== 'function') throw new TypeError('Invalid source reader');
  return { input, revision, count, read };
}
function current<T>(source: Snapshot<T>, signal: AbortSignal): void {
  signal.throwIfAborted();
  if (source.input.revision !== source.revision || source.input.count !== source.count) throw new Error('Source snapshot revision or count changed');
}
function abortable<T>(value: LyraSourceValue<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const aborted = () => { signal.removeEventListener('abort', aborted); reject(signal.reason); };
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve(value).then(result => {
      signal.removeEventListener('abort', aborted);
      if (signal.aborted) reject(signal.reason);
      else resolve(result);
    }, error => {
      signal.removeEventListener('abort', aborted);
      reject(error);
    });
    if (signal.aborted) aborted();
  });
}
async function read<T>(source: Snapshot<T>, start: number, count: number, signal: AbortSignal): Promise<readonly T[]> {
  current(source, signal);
  const values = await abortable(source.read.call(source.input, start, count, { signal }), signal);
  current(source, signal);
  if (!Array.isArray(values) || values.length !== count) throw new TypeError('Invalid source range response');
  return values;
}
async function scan<T>(source: Snapshot<T>, state: Preparation, visit: (value: T, index: number, present: boolean) => void): Promise<void> {
  current(source, state.signal);
  for (let start = 0; start < source.count;) {
    const size = Math.min(state.batchSize, source.count - start);
    // Keep only this bounded source range, including holes as invalid positions.
    const values = await read(source, start, size, state.signal);
    for (let offset = 0; offset < size; offset++) {
      state.signal.throwIfAborted();
      const present = Object.hasOwn(values, offset);
      visit(present ? values[offset]! : undefined as T, start + offset, present);
    }
    start += size;
    current(source, state.signal);
    if (start < source.count) {
      await abortable(new Promise<void>(resolve => setTimeout(resolve, 0)), state.signal);
      current(source, state.signal);
    }
  }
  current(source, state.signal);
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function sum(a: number, b: number): number {
  const value = a + b;
  if (!Number.isFinite(value)) throw new RangeError('Numeric accumulation overflow');
  return value;
}
function counts(sourceCount: number, validCount: number): LyraObservationCounts {
  return Object.freeze({ sourceCount, validCount, invalidCount: sourceCount - validCount });
}
function domain(min: number, max: number): LyraNumericDomain | null {
  return min === Infinity ? null : Object.freeze({ min, max });
}
function metadata(id: string, label: string): { readonly id: string; readonly label: string } {
  if (typeof id !== 'string' || id.length > 256 || !id.trim()) throw new TypeError('Invalid metadata ID');
  if (typeof label !== 'string' || label.length > 1024) throw new TypeError('Invalid metadata label');
  return Object.freeze({ id, label });
}
function metadataBudget(entries: readonly { readonly id: string; readonly label: string }[]): void {
  let units = 0;
  for (const entry of entries) units += entry.id.length + entry.label.length;
  if (units > 65536) throw new RangeError('Metadata label budget exceeded');
}
function boundary(count: number, partitions: number, index: number): number {
  return Math.floor(count / partitions) * index + Math.min(index, count % partitions);
}
function observation(value: LyraSeriesObservation): { readonly x: number; readonly y: number } | null {
  if (!value || typeof value !== 'object') return null;
  const x = value.x;
  const y = value.y;
  return finite(x) && finite(y) ? { x, y } : null;
}
interface Candidate { readonly x: number; readonly y: number; readonly sourceIndex: number; readonly gaps: number; }

/**
 * Prepares an extrema-preserving overview, not an exact reconstruction. All observations are
 * inspected in bounded, yielding chunks. Invalid positions remain gaps; x is never renumbered.
 * Budgets default to 500 points per series, require at least 4, and clamp to 1,000. Requested
 * aggregate capacity must fit 9,000 samples (45,000 snapshot nodes at five nodes per sample).
 * IDs are nonblank and at most 256 code units; labels at most 1,024, with 65,536 combined units.
 * Inputs must share one immutable revision. The returned handle intentionally retains their
 * readers/backing storage for exact one-position getPoint reads; it does not implement queryRange.
 */
export async function prepareLyraSeriesData(
  series: readonly { readonly id: string; readonly label: string; readonly input: LyraIndexedInput<LyraSeriesObservation> }[],
  options: LyraPreparationOptions & { readonly maxPointsPerSeries?: number } = {},
): Promise<LyraPreparedSeriesData> {
  const state = preparation(options);
  const capacity = budget(options.maxPointsPerSeries, 500, 4, 1000);
  if (!Array.isArray(series) || !series.length) throw new RangeError('At least one series is required');
  if (series.length > Math.floor(9000 / capacity)) throw new RangeError('Series snapshot capacity budget exceeded');
  const sources = new Map<string, Snapshot<LyraSeriesObservation>>();
  const entries = series.map(entry => {
    const meta = metadata(entry.id, entry.label);
    if (sources.has(meta.id)) throw new TypeError('Duplicate series ID');
    sources.set(meta.id, snapshot(entry.input));
    return meta;
  });
  metadataBudget(entries);
  const revision = sources.get(entries[0]!.id)!.revision;
  for (const source of sources.values()) if (source.revision !== revision) throw new Error('Series revision mismatch');
  const prepared: LyraPreparedSeries[] = [];
  for (const entry of entries) {
    const source = sources.get(entry.id)!;
    let valid = 0, gaps = 0, xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    let first: Candidate | undefined, last: Candidate | undefined, low: Candidate | undefined, high: Candidate | undefined;
    const candidates: Candidate[] = [];
    const exact = source.count <= capacity;
    const partitions = Math.floor((capacity - 2) / 2);
    let partition = 0;
    const flush = () => {
      if (low) candidates.push(low);
      if (high && high !== low) candidates.push(high);
      low = high = undefined;
    };
    await scan(source, state, (value, sourceIndex) => {
      if (!exact && sourceIndex >= boundary(source.count, partitions, partition + 1)) { flush(); partition++; }
      const point = observation(value);
      if (!point) { gaps++; return; }
      valid++;
      xMin = Math.min(xMin, point.x); xMax = Math.max(xMax, point.x);
      yMin = Math.min(yMin, point.y); yMax = Math.max(yMax, point.y);
      const candidate = { ...point, sourceIndex, gaps };
      first ??= candidate;
      last = candidate;
      if (exact) candidates.push(candidate);
      else {
        if (!low || point.y < low.y) low = candidate;
        if (!high || point.y > high.y) high = candidate;
      }
    });
    if (!exact) {
      flush();
      if (first) candidates.push(first);
      if (last && last !== first) candidates.push(last);
    }
    candidates.sort((a, b) => a.sourceIndex - b.sourceIndex);
    const samples: LyraSeriesSample[] = [];
    let previous: Candidate | undefined;
    for (const point of candidates) {
      if (point.sourceIndex === previous?.sourceIndex) continue;
      samples.push(Object.freeze({ x: point.x, y: point.y, sourceIndex: point.sourceIndex, breakBefore: !previous || point.gaps !== previous.gaps }));
      previous = point;
    }
    prepared.push(Object.freeze({ ...entry, counts: counts(source.count, valid), xDomain: domain(xMin, xMax), yDomain: domain(yMin, yMax), samples: Object.freeze(samples) }));
  }
  for (const source of sources.values()) current(source, state.signal);
  return Object.freeze({
    kind: 'series' as const, revision, series: Object.freeze(prepared),
    async getPoint(ref: LyraSeriesPointRef, request: LyraSourceRequest): Promise<LyraSeriesObservation | null> {
      const source = sources.get(ref.seriesId);
      if (!source) throw new RangeError('Unknown series ID');
      if (!Number.isSafeInteger(ref.sourceIndex) || ref.sourceIndex < 0 || ref.sourceIndex >= source.count) throw new RangeError('Source index out of range');
      const values = await read(source, ref.sourceIndex, 1, request.signal);
      const point = Object.hasOwn(values, 0) ? observation(values[0]!) : null;
      current(source, request.signal);
      return point ? Object.freeze(point) : null;
    },
  });
}

/**
 * Reduces every source position into at most 1,000 declared categories and one result series.
 * Unknown/null categories and nonfinite sum/mean values are invalid, unless an unknown ID maps
 * to the declared Other category. Empty categories have value zero. Means use sums/counts;
 * overflowing finite sums reject. IDs/labels use the same bounds as series preparation.
 * Sum/mean require an own numeric valueOf callback; count ignores valueOf entirely.
 * Selectors must be synchronous scalar functions; their arbitrary computation cost is caller-owned.
 */
export async function prepareLyraCategoryData<T>(
  input: LyraIndexedInput<T>,
  options: LyraPreparationOptions & {
    readonly categories: readonly { readonly id: string; readonly label: string }[];
    readonly seriesId: string;
    readonly seriesLabel: string;
    readonly categoryOf: (value: T, sourceIndex: number) => string | null;
    readonly otherCategoryId?: string;
  } & (
    | { readonly aggregation: 'count'; readonly valueOf?: (value: T, sourceIndex: number) => unknown }
    | { readonly aggregation: 'sum' | 'mean'; readonly valueOf: (value: T, sourceIndex: number) => number | null }
  ),
): Promise<LyraPreparedCategoryData> {
  const state = preparation(options), source = snapshot(input);
  const aggregation = options.aggregation, categoryOf = options.categoryOf;
  const valueOf = aggregation === 'count' ? undefined : options.valueOf;
  if (!['count', 'sum', 'mean'].includes(aggregation) || typeof categoryOf !== 'function' || (aggregation !== 'count' && (!Object.hasOwn(options, 'valueOf') || typeof valueOf !== 'function' || Object.is(valueOf, Object.prototype.valueOf)))) throw new TypeError('Invalid category reducer');
  if (!Array.isArray(options.categories) || options.categories.length > 1000) throw new RangeError('Category budget exceeded');
  const categories = options.categories.map(entry => metadata(entry.id, entry.label));
  const meta = metadata(options.seriesId, options.seriesLabel);
  metadataBudget([...categories, meta]);
  const positions = new Map<string, number>();
  categories.forEach((entry, index) => {
    if (positions.has(entry.id)) throw new TypeError('Duplicate category ID');
    positions.set(entry.id, index);
  });
  const other = options.otherCategoryId === undefined ? undefined : positions.get(options.otherCategoryId);
  if (options.otherCategoryId !== undefined && other === undefined) throw new TypeError('Unknown Other category ID');
  const totals = new Array<number>(categories.length).fill(0), categoryCounts = new Array<number>(categories.length).fill(0);
  let valid = 0;
  await scan(source, state, (value, index, present) => {
    if (!present) return;
    const id = categoryOf(value, index);
    if (typeof id !== 'string' || !id || id.length > 256) return;
    const position = positions.get(id) ?? other;
    if (position === undefined) return;
    const amount = aggregation === 'count' ? 1 : valueOf!(value, index);
    if (!finite(amount)) return;
    totals[position] = sum(totals[position]!, amount);
    categoryCounts[position] = categoryCounts[position]! + 1;
    valid++;
  });
  if (aggregation === 'mean') for (let index = 0; index < totals.length; index++) if (categoryCounts[index]) totals[index] = totals[index]! / categoryCounts[index]!;
  current(source, state.signal);
  return Object.freeze({ kind: 'categories', revision: source.revision, counts: counts(source.count, valid), categories: Object.freeze(categories), categoryCounts: Object.freeze(categoryCounts), series: Object.freeze([Object.freeze({ ...meta, values: Object.freeze(totals) })]), aggregation });
}

function checkedEdges(edges: readonly number[]): number[] {
  if (!Array.isArray(edges) || edges.length < 2 || edges.length > 1001) throw new RangeError('Invalid histogram edge budget');
  const result: number[] = [];
  for (const edge of edges) {
    if (!finite(edge) || (result.length && edge <= result[result.length - 1]!)) throw new RangeError('Histogram edges must be finite and strictly increasing');
    result.push(edge);
  }
  return result;
}
function automaticEdges(min: number, max: number, bins: number): number[] {
  if (min === Infinity) return [];
  let low = min, high = max;
  if (low === high) {
    const padding = Math.max(0.5, Math.abs(low) * 0.01);
    if (Number.isFinite(low - padding)) low -= padding;
    if (Number.isFinite(high + padding)) high += padding;
  }
  const edges = [low];
  const width = high - low;
  for (let index = 1; index < bins; index++) {
    const fraction = index / bins;
    edges.push(Number.isFinite(width) ? low + width * fraction : low * (1 - fraction) + high * fraction);
  }
  edges.push(high);
  return checkedEdges(edges);
}

/**
 * Builds an exact full-source distribution: half-open bins, with an inclusive last upper edge.
 * Explicit finite increasing edges use one pass; automatic bins use two replayable passes of
 * one immutable revision. Bin counts clamp to 1,000. Unrepresentable distinct edges reject.
 * Constant domains get a finite nonzero display interval; the observed domain stays unchanged.
 */
export async function prepareLyraHistogram(
  input: LyraIndexedInput<number>,
  options: LyraPreparationOptions & ({ readonly edges: readonly number[] } | { readonly binCount: number }),
): Promise<LyraHistogramDistribution> {
  const state = preparation(options), source = snapshot(input);
  let min = Infinity, max = -Infinity, valid = 0;
  const explicit = 'edges' in options;
  let edges: number[];
  if (explicit) edges = checkedEdges(options.edges);
  else {
    const bins = budget(options.binCount, 10, 1, 1000);
    await scan(source, state, value => { if (finite(value)) { min = Math.min(min, value); max = Math.max(max, value); } });
    edges = automaticEdges(min, max, bins);
  }
  const binCounts = new Array<number>(Math.max(0, edges.length - 1)).fill(0);
  let belowCount = 0, aboveCount = 0;
  await scan(source, state, value => {
    if (!finite(value)) return;
    valid++;
    if (explicit) { min = Math.min(min, value); max = Math.max(max, value); }
    if (!edges.length) throw new Error('Source snapshot values changed between passes');
    if (value < edges[0]!) { belowCount++; return; }
    if (value > edges[edges.length - 1]!) { aboveCount++; return; }
    let low = 0, high = edges.length - 1;
    while (low + 1 < high) { const middle = Math.floor((low + high) / 2); if (value < edges[middle]!) high = middle; else low = middle; }
    const position = Math.min(low, binCounts.length - 1);
    binCounts[position] = binCounts[position]! + 1;
  });
  current(source, state.signal);
  return Object.freeze({ revision: source.revision, counts: counts(source.count, valid), domain: domain(min, max), edges: Object.freeze(edges), binCounts: Object.freeze(binCounts), belowCount, aboveCount });
}

interface WordCandidate { readonly word: LyraWeightedWord; readonly index: number; }
function worse(a: WordCandidate, b: WordCandidate): boolean { return a.word.weight < b.word.weight || (a.word.weight === b.word.weight && a.index > b.index); }

/**
 * Selects exact global top-K (default/max 150) from an already aggregated unique-ID word catalog.
 * Stable ties favor earlier positions. Global ID uniqueness is the caller's contract; only
 * duplicates among retained candidates can be detected with bounded memory. Blank or >256-unit
 * text, invalid IDs (>256 units/blank), and negative/nonfinite weights are invalid observations.
 * Valid total weight includes omitted words. If chosen labels exceed 16,384 code units the call
 * rejects; lower maxWords rather than silently clipping labels or dropping selected words.
 */
export async function prepareLyraWordCloud(
  input: LyraIndexedInput<LyraWeightedWord>,
  options: LyraPreparationOptions & { readonly maxWords?: number } = {},
): Promise<LyraPreparedWordCloud> {
  const state = preparation(options), source = snapshot(input);
  const capacity = budget(options.maxWords, 150, 1, 150);
  const heap: WordCandidate[] = [], ids = new Set<string>();
  let valid = 0, totalWeight = 0;
  await scan(source, state, (value, index) => {
    if (!value || typeof value !== 'object') return;
    const { id, text, weight } = value;
    if (typeof id !== 'string' || id.length > 256 || !id.trim() || typeof text !== 'string' || text.length > 256 || !text.trim() || !finite(weight) || weight < 0) return;
    valid++;
    totalWeight = sum(totalWeight, weight);
    if (ids.has(id)) throw new TypeError('Duplicate retained word ID');
    const candidate = { word: Object.freeze({ id, text, weight }), index };
    if (heap.length < capacity) {
      ids.add(id);
      heap.push(candidate);
      let position = heap.length - 1;
      while (position > 0) {
        const parent = Math.floor((position - 1) / 2);
        if (!worse(heap[position]!, heap[parent]!)) break;
        [heap[position], heap[parent]] = [heap[parent]!, heap[position]!];
        position = parent;
      }
    } else if (worse(heap[0]!, candidate)) {
      ids.delete(heap[0]!.word.id); ids.add(id);
      heap[0] = candidate;
      let position = 0;
      for (;;) {
        const left = 2 * position + 1, right = left + 1;
        if (left >= heap.length) break;
        const child = right < heap.length && worse(heap[right]!, heap[left]!) ? right : left;
        if (!worse(heap[child]!, heap[position]!)) break;
        [heap[position], heap[child]] = [heap[child]!, heap[position]!];
        position = child;
      }
    }
  });
  heap.sort((a, b) => b.word.weight - a.word.weight || a.index - b.index);
  let retainedWeight = 0, textUnits = 0;
  const words = heap.map(({ word }) => { retainedWeight = sum(retainedWeight, word.weight); textUnits += word.text.length; return word; });
  if (textUnits > 16384) throw new RangeError('Selected word label budget exceeded');
  current(source, state.signal);
  return Object.freeze({ revision: source.revision, counts: counts(source.count, valid), totalWeight, retainedWeight, words: Object.freeze(words) });
}

/**
 * Summarizes the complete duration with positional interval maxima, default/max 65,536 buckets.
 * Finite samples clamp to [0,1]; invalid samples contribute no peak but retain their positions.
 * Endpoint amplitudes refer to the original first/last positions (null when invalid/absent).
 * Source storage remains caller-owned; only bounded chunks and output buckets are retained.
 */
export async function prepareLyraWaveform(
  input: LyraIndexedInput<number>,
  options: LyraPreparationOptions & { readonly duration: number; readonly maxBuckets?: number },
): Promise<LyraPreparedWaveform> {
  const state = preparation(options), source = snapshot(input);
  const duration = options.duration;
  if (!finite(duration) || duration < 0) throw new RangeError('Invalid waveform duration');
  const size = Math.min(source.count, budget(options.maxBuckets, 65536, 1, 65536));
  const buckets = Array.from({ length: size }, (_, index) => ({ startIndex: boundary(source.count, size, index), endIndex: boundary(source.count, size, index + 1), maxAmplitude: 0 }));
  let position = 0, valid = 0, firstAmplitude: number | null = null, lastAmplitude: number | null = null;
  await scan(source, state, (value, index) => {
    if (index >= buckets[position]!.endIndex) position++;
    const amplitude = finite(value) ? Math.min(1, Math.max(0, value)) : null;
    if (amplitude !== null) { valid++; buckets[position]!.maxAmplitude = Math.max(buckets[position]!.maxAmplitude, amplitude); }
    if (index === 0) firstAmplitude = amplitude;
    if (index === source.count - 1) lastAmplitude = amplitude;
  });
  current(source, state.signal);
  return Object.freeze({ revision: source.revision, counts: counts(source.count, valid), sampleCount: source.count, duration, buckets: Object.freeze(buckets.map(bucket => Object.freeze(bucket))), firstAmplitude, lastAmplitude });
}
