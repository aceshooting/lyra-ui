import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraPageResult, LyraPageSource, LyraSourceContext, LyraSourceFacet, LyraSourceGroup, LyraSourceRecord, LyraSourceRevision } from '../data-sources.js';
import { SourceRequestController, sourceCount, sourceRevision } from './source-request-controller.js';
import { sourcePageScope } from './source-page-scope.js';

export interface SourcePageBinding<T, Q, S = undefined> {
  readonly source: LyraPageSource<T, Q, S>;
  readonly revision: LyraSourceRevision;
  readonly epoch: number;
  readonly locale: string;
}
export interface SourcePageOptions<T, Q, S = undefined> {
  /** Project bounded display fields; check originating lane authority around effectful reads.
   * Retain original provider identity only where the host contract requires it. */
  readonly normalizeRecord: (record: LyraSourceRecord<unknown>, isCurrent: () => boolean) => LyraSourceRecord<T>;
  /** Enforce required summary/facets, at most 500 active facets, unavailable-key membership and active-facet reservation. */
  readonly validateMetadata: (result: LyraPageResult<T, S>, query: Q) => void;
  /** Required for defined summaries; project only bounded domain fields, including validation of missing required summaries. */
  readonly normalizeSummary?: (value: unknown, query: Q) => S;
  /** Update named reactive state; never turn a repaint into a keyless source refresh. */
  readonly onChange: () => void;
}
export interface SourcePageState<T, S = undefined> {
  readonly page: number;
  readonly pageSize: number;
  readonly pending: boolean;
  readonly result: LyraPageResult<T, S> | undefined;
  readonly error: unknown;
  readonly selectionPending: boolean;
  readonly selectionError: unknown;
}

type Channel = 'page' | 'selection' | 'locate';
type Current = () => boolean;
interface Job<R> {
  readonly run: (context: LyraSourceContext, current: Current) => Promise<R>;
  readonly settle: (value: R) => void;
  readonly fail: (error: unknown) => void;
}
interface Lane<R> {
  readonly channel: Channel;
  readonly canceled: R;
  current?: Job<R>;
  running?: Job<R>;
  scheduled: boolean;
}
interface PageIntent<Q> { readonly query: Q; readonly page: number; readonly pageSize: number; }
const MAX_TEXT = 65_536;
const MAX_TEXT_TOTAL = 2_000_000;
const revoked = new Error('Source operation revoked');

function field(value: unknown, key: PropertyKey, required = true): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) throw new TypeError('Invalid source object');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) {
    if (required) throw new TypeError('Missing source field');
    return undefined;
  }
  if (!('value' in descriptor)) throw new TypeError('Accessor source field');
  return descriptor.value;
}
function list(value: unknown, max: number): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid source collection');
  const length = sourceCount(field(value, 'length'));
  if (length > max) throw new RangeError('Invalid source collection');
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) result.push(field(value, i));
  return result;
}
function textValue(value: unknown, budget: { used: number }, nonempty = false): string {
  if (typeof value !== 'string' || (nonempty && value.length === 0) || value.length > MAX_TEXT) throw new TypeError('Invalid source text');
  budget.used += value.length;
  if (budget.used > MAX_TEXT_TOTAL) throw new RangeError('Source text budget exceeded');
  return value;
}
function initialState<T, S>(): SourcePageState<T, S> {
  return Object.freeze({ page: 0, pageSize: 100, pending: false, result: undefined, error: undefined,
    selectionPending: false, selectionError: undefined });
}

/** Coordinates bounded domain pages and independent explicit-key selection transactions. */
export class SourcePageController<T, Q, S = undefined> implements ReactiveController {
  private snapshot = initialState<T, S>();
  private binding?: SourcePageBinding<T, Q, S>;
  private bindVersion = 0;
  private pageVersion = 0;
  private selectionVersion = 0;
  private locateVersion = 0;
  private connected: boolean;
  private notification?: object;
  private lastPage?: PageIntent<Q>;
  private lastSelection?: readonly string[];
  private readonly cache = new Map<string, LyraSourceRecord<T> | null>();
  private readonly pageLane: Lane<boolean> = { channel: 'page', canceled: false, scheduled: false };
  private readonly selectionLane: Lane<readonly LyraSourceRecord<T>[] | undefined> = { channel: 'selection', canceled: undefined, scheduled: false };
  private readonly locateLane: Lane<number | null> = { channel: 'locate', canceled: null, scheduled: false };
  private readonly authority: SourceRequestController<Channel>;
  private readonly options: SourcePageOptions<T, Q, S>;

  constructor(private readonly host: HTMLElement & ReactiveControllerHost, options: SourcePageOptions<T, Q, S>) {
    this.options = Object.freeze({ ...options });
    this.connected = host.isConnected;
    this.authority = new SourceRequestController(host, { channels: ['page', 'selection', 'locate'], onReset: () => this.reset() });
    host.addController(this);
  }

  get state(): SourcePageState<T, S> { return this.snapshot; }

  bind(value: SourcePageBinding<T, Q, S> | undefined): void {
    const transaction = ++this.bindVersion;
    let candidate: SourcePageBinding<T, Q, S> | undefined;
    try {
      if (value) {
        candidate = Object.freeze({ source: value.source, revision: sourceRevision(value.revision), epoch: sourceCount(value.epoch), locale: value.locale });
        if (!candidate.source || typeof candidate.source.query !== 'function' || typeof candidate.source.lookup !== 'function' || typeof candidate.source.locate !== 'function' || typeof candidate.locale !== 'string') throw new TypeError('Invalid page source');
      }
    } catch (error) {
      if (transaction === this.bindVersion) {
        this.binding = undefined; this.lastPage = undefined; this.lastSelection = undefined;
        this.authority.setSource(undefined, undefined);
        if (transaction === this.bindVersion) this.patch({ error });
      }
      throw error;
    }
    if (transaction !== this.bindVersion) return;
    const previous = this.binding;
    if (candidate && previous && previous.source === candidate.source && previous.revision === candidate.revision && previous.epoch === candidate.epoch) {
      if (previous.locale === candidate.locale) return;
      this.binding = candidate;
      const pageTransaction = ++this.pageVersion;
      this.locateVersion++;
      this.patch({ pending: false, result: undefined, error: undefined });
      this.stop(this.locateLane);
      if (transaction !== this.bindVersion || pageTransaction !== this.pageVersion) return;
      this.stop(this.pageLane);
      return;
    }
    this.binding = undefined; this.lastPage = undefined; this.lastSelection = undefined;
    this.authority.refresh();
    if (transaction !== this.bindVersion) return;
    this.authority.setSource(candidate?.source, candidate?.revision);
    if (transaction === this.bindVersion) this.binding = candidate;
  }

  request(query: Q, page: number, pageSize: number): Promise<boolean> {
    const transaction = ++this.pageVersion;
    this.locateVersion++;
    this.lastPage = { query, page, pageSize };
    this.patch({ page, pageSize, pending: true, result: undefined, error: undefined });
    this.stop(this.locateLane);
    if (transaction !== this.pageVersion) return Promise.resolve(false);
    this.stop(this.pageLane);
    if (transaction !== this.pageVersion) return Promise.resolve(false);
    try {
      sourceCount(page); sourceCount(pageSize);
      if (pageSize < 1 || pageSize > 500 || !Number.isSafeInteger(page * pageSize)) throw new RangeError('Invalid source page');
      if (!this.usable() || !this.binding) { this.patch({ pending: false }); return Promise.resolve(false); }
    } catch (error) {
      this.lastPage = undefined; this.patch({ pending: false, error }); return Promise.resolve(false);
    }
    const source = this.binding.source;
    return this.enqueue(this.pageLane, async (context, current) => {
      let acceptedPage = page;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!current()) return false;
        const queryPage = source.query;
        if (!current()) return false;
        const raw = await Reflect.apply(queryPage, source, [{ ...context, page: acceptedPage, pageSize, query }]);
        if (!current()) return false;
        const result = this.projectPage(raw, query, acceptedPage, pageSize, current);
        if (!current()) return false;
        const last = result.total === 0 ? 0 : Math.floor((result.total - 1) / pageSize);
        if (acceptedPage > last) {
          if (attempt === 1) throw new RangeError('Inconsistent source page total');
          acceptedPage = last;
          continue;
        }
        this.lastPage = { query, page: acceptedPage, pageSize };
        this.patch({ page: acceptedPage, pageSize, pending: false, result, error: undefined });
        return true;
      }
      return false;
    }, error => this.patch({ pending: false, result: undefined, error }));
  }

  resolveSelection(keys: readonly string[]): Promise<readonly LyraSourceRecord<T>[] | undefined> {
    const transaction = ++this.selectionVersion;
    this.patch({ selectionPending: true, selectionError: undefined });
    this.stop(this.selectionLane);
    if (transaction !== this.selectionVersion) return Promise.resolve(undefined);
    let accepted: readonly string[];
    try {
      const values = list(keys, 10_000);
      const budget = { used: 0 };
      const unique = new Set<string>();
      for (let i = 0; i < values.length; i++) unique.add(textValue(field(values, i), budget, true));
      accepted = Object.freeze([...unique]);
      if (transaction !== this.selectionVersion) return Promise.resolve(undefined);
    } catch (error) {
      if (transaction === this.selectionVersion) { this.lastSelection = undefined; this.patch({ selectionPending: false, selectionError: error }); }
      return Promise.resolve(undefined);
    }
    this.lastSelection = accepted;
    const wanted = new Set(accepted);
    for (const key of this.cache.keys()) if (!wanted.has(key)) this.cache.delete(key);
    if (!this.usable() || !this.binding) { this.patch({ selectionPending: false }); return Promise.resolve(undefined); }
    const source = this.binding.source;
    return this.enqueue(this.selectionLane, async (context, current) => {
      const staged = new Map<string, LyraSourceRecord<T> | null>();
      const missing = accepted.filter(key => !this.cache.has(key));
      const budget = { used: accepted.reduce((sum, key) => sum + key.length, 0) };
      for (let offset = 0; offset < missing.length; offset += 500) {
        if (!current()) return undefined;
        const batch = Object.freeze(missing.slice(offset, offset + 500));
        const lookup = source.lookup;
        if (!current()) return undefined;
        const raw = await Reflect.apply(lookup, source, [batch, context]);
        if (!current()) return undefined;
        const rows = list(raw, batch.length);
        const requested = new Set(batch);
        const seen = new Set<string>();
        for (let i = 0; i < rows.length; i++) {
          const item = this.projectRecord(field(rows, i), budget, current);
          if (!current()) return undefined;
          if (!requested.has(item.key) || seen.has(item.key)) throw new TypeError('Invalid selected source key');
          seen.add(item.key); staged.set(item.key, item);
        }
        for (const key of batch) if (!seen.has(key)) staged.set(key, null);
      }
      if (!current()) return undefined;
      const result: LyraSourceRecord<T>[] = [];
      const orders = new Set<number>();
      for (const key of accepted) {
        const item = staged.has(key) ? staged.get(key) : this.cache.get(key);
        if (item) {
          if (orders.has(item.order)) throw new TypeError('Duplicate selected source order');
          orders.add(item.order); result.push(item);
        }
      }
      result.sort((a, b) => a.order - b.order);
      for (const [key, item] of staged) this.cache.set(key, item);
      this.patch({ selectionPending: false, selectionError: undefined });
      return Object.freeze(result);
    }, error => this.patch({ selectionPending: false, selectionError: error }));
  }

  locate(key: string): Promise<number | null> {
    const transaction = ++this.locateVersion;
    this.stop(this.locateLane);
    if (transaction !== this.locateVersion || !this.binding || !this.lastPage || !this.usable()) return Promise.resolve(null);
    try { textValue(key, { used: 0 }, true); } catch { return Promise.resolve(null); }
    const source = this.binding.source;
    const query = this.lastPage.query;
    return this.enqueue(this.locateLane, async (context, current) => {
      const locate = source.locate;
      if (!current()) return null;
      const index = await Reflect.apply(locate, source, [key, query, context]);
      if (!current() || index === null) return null;
      sourceCount(index);
      if (this.snapshot.result && index >= this.snapshot.result.total) throw new RangeError('Invalid located source index');
      return index;
    }, () => {});
  }

  private projectRecord(raw: unknown, budget: { used: number }, current: Current): LyraSourceRecord<T> {
    const key = textValue(field(raw, 'key'), budget, true);
    const order = sourceCount(field(raw, 'order'));
    const input = Object.freeze({ key, order, value: field(raw, 'value') });
    const result = this.options.normalizeRecord(input, current);
    if (field(result, 'key') !== key || field(result, 'order') !== order) throw new TypeError('Source record identity changed');
    return Object.freeze({ key, order, value: field(result, 'value') as T });
  }

  private projectPage(raw: unknown, query: Q, page: number, pageSize: number, current: Current): LyraPageResult<T, S> {
    const total = sourceCount(field(raw, 'total'));
    const values = list(field(raw, 'rows'), pageSize);
    const start = page * pageSize;
    const expected = Math.min(pageSize, Math.max(0, total - start));
    if (values.length !== expected) throw new RangeError('Invalid source page length');
    const budget = { used: 0 };
    const keys = new Set<string>();
    const orders = new Set<number>();
    const rows: LyraSourceRecord<T>[] = [];
    for (let i = 0; i < values.length; i++) {
      const item = this.projectRecord(field(values, i), budget, current);
      if (!current()) throw revoked;
      if (keys.has(item.key) || orders.has(item.order)) throw new TypeError('Duplicate source record');
      keys.add(item.key); orders.add(item.order); rows.push(item);
    }
    const rawGroups = field(raw, 'groups', false);
    let groups: readonly LyraSourceGroup[] | undefined;
    if (rawGroups !== undefined) {
      const values = list(rawGroups, rows.length);
      const unique = new Set<string>();
      const projected: LyraSourceGroup[] = [];
      for (let i = 0; i < values.length; i++) {
        const group = field(values, i);
        const key = textValue(field(group, 'key'), budget, true);
        const label = textValue(field(group, 'label'), budget);
        const startIndex = sourceCount(field(group, 'startIndex'));
        const itemCount = sourceCount(field(group, 'itemCount'));
        const end = startIndex + itemCount;
        if (!Number.isSafeInteger(end) || itemCount === 0 || end > total || startIndex >= start + rows.length || end <= start || unique.has(key)) throw new RangeError('Invalid source group');
        unique.add(key); projected.push(Object.freeze({ key, label, startIndex, itemCount }));
      }
      groups = Object.freeze(projected);
    }
    const rawTags = field(raw, 'tags', false);
    let tags: LyraSourceFacet | undefined;
    if (rawTags !== undefined) {
      const values = list(field(rawTags, 'values'), 500);
      const unavailable = list(field(rawTags, 'unavailableSelected'), 500);
      const total = sourceCount(field(rawTags, 'total'));
      if (total < values.length) throw new RangeError('Invalid facet total');
      const unique = new Set<string>();
      const projected: { readonly key: string; readonly label: string; readonly count?: number }[] = [];
      for (let i = 0; i < values.length; i++) {
        const facet = field(values, i);
        const key = textValue(field(facet, 'key'), budget, true);
        const label = textValue(field(facet, 'label'), budget);
        const rawCount = field(facet, 'count', false);
        const count = rawCount === undefined ? undefined : sourceCount(rawCount);
        if (unique.has(key)) throw new TypeError('Duplicate source facet');
        unique.add(key); projected.push(Object.freeze({ key, label, ...(count === undefined ? {} : { count }) }));
      }
      const missing: string[] = [];
      for (let i = 0; i < unavailable.length; i++) {
        const key = textValue(field(unavailable, i), budget, true);
        if (unique.has(key)) throw new TypeError('Conflicting source facet');
        unique.add(key); missing.push(key);
      }
      tags = Object.freeze({ total, values: Object.freeze(projected), unavailableSelected: Object.freeze(missing) });
    }
    const rawSummary = field(raw, 'summary', false);
    if (rawSummary !== undefined && !this.options.normalizeSummary) throw new TypeError('Source summary requires a projection');
    const summary = this.options.normalizeSummary?.(rawSummary, query);
    if (!current()) throw revoked;
    const result = Object.freeze({ total, rows: Object.freeze(rows), ...(groups === undefined ? {} : { groups }),
      ...(tags === undefined ? {} : { tags }), ...(this.options.normalizeSummary ? { summary } : {}) }) as LyraPageResult<T, S>;
    this.options.validateMetadata(result, query);
    if (!current()) throw revoked;
    return result;
  }

  private enqueue<R>(lane: Lane<R>, run: Job<R>['run'], fail: Job<R>['fail']): Promise<R> {
    let settle!: (value: R) => void;
    const done = new Promise<R>(resolve => { settle = resolve; });
    lane.current = { run, fail, settle };
    this.schedule(lane);
    return done;
  }

  private stop<R>(lane: Lane<R>, abort = true): void {
    const job = lane.current;
    lane.current = undefined;
    job?.settle(lane.canceled);
    if (abort) this.authority.invalidate(lane.channel);
  }

  private schedule<R>(lane: Lane<R>): void {
    if (lane.scheduled) return;
    lane.scheduled = true;
    queueMicrotask(() => { lane.scheduled = false; this.pump(lane); });
  }

  private pump<R>(lane: Lane<R>): void {
    if (lane.running || !lane.current) return;
    const job = lane.current;
    const binding = this.binding;
    if (!binding || !this.usable()) { this.stop(lane); return; }
    lane.running = job;
    const epoch = this.authority.epoch;
    const owner = this.host.ownerDocument;
    const lease = this.authority.begin(lane.channel, binding.locale);
    const scope = sourcePageScope(this.host);
    const current = () => lane.current === job && this.usable() && this.host.ownerDocument === owner && this.authority.epoch === epoch && lease?.isCurrent() === true && (!scope || scope.isCurrent());
    if (!current() || !lease) {
      job.settle(lane.canceled);
      if (lane.current === job) lane.current = undefined;
      lane.running = undefined; this.schedule(lane); return;
    }
    // A revoked provider keeps its physical permit until it settles; only the latest intent queues.
    void Promise.resolve().then(async () => {
      if (!current()) return lane.canceled;
      const release = scope ? await scope.acquire(binding.source, lane.channel, lease.context.signal) : undefined;
      if (scope && !release) return lane.canceled;
      try { return current() ? await job.run(lease.context, current) : lane.canceled; }
      finally { release?.(); }
    }).then(value => {
      job.settle(current() ? value : lane.canceled);
    }).catch((error: unknown) => {
      if (current()) job.fail(error);
      job.settle(lane.canceled);
    }).finally(() => {
      if (lane.current === job) lane.current = undefined;
      if (lane.running === job) lane.running = undefined;
      this.schedule(lane);
    });
  }

  private usable(): boolean { return this.connected && this.host.isConnected; }

  private patch(change: Partial<SourcePageState<T, S>>): void {
    this.snapshot = Object.freeze({ ...this.snapshot, ...change });
    this.notify();
  }

  private notify(): void {
    if (this.notification) return;
    const token = {};
    const epoch = this.authority.epoch;
    const owner = this.host.ownerDocument;
    this.notification = token;
    queueMicrotask(() => {
      if (this.notification !== token) return;
      this.notification = undefined;
      if (this.usable() && this.host.ownerDocument === owner && this.authority.epoch === epoch) this.options.onChange();
    });
  }

  private reset(): void {
    this.pageVersion++; this.selectionVersion++; this.locateVersion++;
    this.stop(this.pageLane, false); this.stop(this.selectionLane, false); this.stop(this.locateLane, false);
    this.cache.clear(); this.notification = undefined; this.snapshot = initialState<T, S>();
  }

  adopted(): void { this.authority.adopted(); }
  hostConnected(): void {
    const reconnecting = !this.connected;
    this.connected = true;
    if (reconnecting && this.binding) {
      const page = this.lastPage;
      const selection = this.lastSelection;
      if (page) void this.request(page.query, page.page, page.pageSize);
      if (selection) void this.resolveSelection(selection);
      this.notify();
    }
  }
  hostDisconnected(): void { this.connected = false; this.reset(); }
}
