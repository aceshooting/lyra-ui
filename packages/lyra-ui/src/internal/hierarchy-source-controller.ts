import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type {
  LyraHierarchyAction, LyraHierarchyProjection, LyraHierarchyQuery, LyraHierarchyRow,
  LyraHierarchySource, LyraSourceRevision, LyraSourceSearchResult,
} from '../data-sources.js';
import type { LyraVirtualList, LyraVirtualListIndexedSource } from '../components/layout/virtual-list/virtual-list.class.js';
import { SourceRequestController, sourceCount, sourceRevision, type SourceRequestLease } from './source-request-controller.js';
import { SourceWindowController, type SourceWindowSlot } from './source-window-controller.js';
import { yieldViewerTask } from './resource-loader.js';
import { deepActiveElementIn } from './active-element.js';

/** Reads only an own data descriptor; hierarchy values never invoke authored getters. */
export function hierarchyField(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') throw new TypeError('Invalid hierarchy record');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor && !('value' in descriptor)) throw new TypeError('Invalid hierarchy field');
  return descriptor?.value;
}
export function hierarchyKey(value: unknown): string {
  if (typeof value !== 'string' || value.length > 65_536 || value.trim().length === 0) throw new TypeError('Invalid hierarchy key');
  return value;
}
export function hierarchyText(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.length > 65_536) throw new RangeError('Hierarchy display value exceeds its row budget');
  return typeof value === 'string' ? value : fallback;
}

type Host = HTMLElement & ReactiveControllerHost;
type Row<T> = LyraHierarchyRow<T>;
type Source<T> = LyraHierarchySource<T, LyraHierarchyQuery>;
export interface HierarchySourceOptions<T> {
  readonly normalize: (value: unknown, key: string, childCount: number) => T;
  readonly payload?: {
    readonly maxUnits: number;
    readonly maxRowUnits: number;
    readonly unitsOf: (value: T) => number;
  };
  readonly onChange: () => void;
  readonly accepted: (action: LyraHierarchyAction, row: Row<T> | undefined, state: string, isCurrent: () => boolean) => void;
}
interface ProjectJob<T> {
  readonly source: Source<T>;
  readonly lease: SourceRequestLease;
  readonly action: LyraHierarchyAction;
  readonly query: LyraHierarchyQuery;
  state: string | null;
  readonly user: boolean;
  row?: Row<T>;
  readonly settle: (accepted: boolean) => void;
}
const EMPTY_QUERY: LyraHierarchyQuery = Object.freeze({ search: '', hiddenKinds: Object.freeze([]) });

export type HierarchyCapabilityResult<V> =
  | { readonly status: 'ready'; readonly value: V; readonly isCurrent: () => boolean }
  | { readonly status: 'unavailable' | 'stale' | 'error' };
type SearchResult = LyraSourceSearchResult<{ readonly key: string }>;
interface CapabilityJob<V> {
  readonly lease: SourceRequestLease;
  readonly run: () => Promise<void>;
  readonly settle: (result: HierarchyCapabilityResult<V>) => void;
}
interface CapabilityLane<V> {
  current?: CapabilityJob<V>;
  running?: CapabilityJob<V>;
  queued?: CapabilityJob<V>;
  scheduled: boolean;
}
const UNAVAILABLE = Symbol('unavailable');

function snapshotQuery(value: unknown): LyraHierarchyQuery {
  const search = hierarchyField(value, 'search');
  const hidden = hierarchyField(value, 'hiddenKinds');
  if (typeof search !== 'string' || search.length > 4096 || !Array.isArray(hidden)) throw new TypeError('Invalid hierarchy query');
  const length = sourceCount(hierarchyField(hidden, 'length'));
  if (length > 64) throw new RangeError('Hierarchy query exceeds its budget');
  const kinds = new Set<string>();
  for (let index = 0; index < length; index++) {
    const kind = hierarchyField(hidden, String(index));
    if (typeof kind !== 'string' || kind.length === 0 || kind.length > 64) throw new TypeError('Invalid hierarchy kind');
    kinds.add(kind);
  }
  return Object.freeze({ search, hiddenKinds: Object.freeze([...kinds].sort()) });
}
function sameQuery(left: LyraHierarchyQuery, right: LyraHierarchyQuery): boolean {
  return left.search === right.search && left.hiddenKinds.length === right.hiddenKinds.length &&
    left.hiddenKinds.every((kind, index) => kind === right.hiddenKinds[index]);
}
function snapshotSearch(value: unknown): SearchResult {
  const raw = hierarchyField(value, 'hits');
  if (!Array.isArray(raw)) throw new TypeError('Invalid hierarchy search result');
  const length = sourceCount(hierarchyField(raw, 'length'));
  if (length > 10_000) throw new RangeError('Hierarchy search exceeds its hit budget');
  const totalValue = hierarchyField(value, 'total');
  const total = totalValue === null ? null : sourceCount(totalValue);
  const exhaustive = hierarchyField(value, 'exhaustive');
  if (typeof exhaustive !== 'boolean' || (total !== null && (total < length || (exhaustive && total !== length))))
    throw new TypeError('Inconsistent hierarchy search result');
  const seen = new Set<string>();
  const hits: { readonly key: string }[] = [];
  let units = 0;
  for (let index = 0; index < length; index++) {
    const key = hierarchyKey(hierarchyField(hierarchyField(raw, String(index)), 'key'));
    units += key.length;
    if (units > 2_000_000 || seen.has(key)) throw new RangeError('Hierarchy search key budget exceeded');
    seen.add(key); hits.push(Object.freeze({ key }));
  }
  return Object.freeze({ hits: Object.freeze(hits), total, exhaustive });
}

async function boundedCopy(value: unknown, maxBytes: number, owner: Document, current: () => boolean): Promise<string> {
  if (typeof value !== 'string' || value.length > maxBytes) throw new RangeError('Invalid hierarchy copy result');
  let bytes = 0;
  let nextYield = 65_536;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index++; }
    else bytes += 3;
    if (bytes > maxBytes) throw new RangeError('Hierarchy copy exceeds its byte budget');
    if (index >= nextYield) {
      await yieldViewerTask(owner.defaultView, current);
      if (!current()) throw new Error('Hierarchy copy changed');
      nextYield = index + 65_536;
    }
  }
  if (!current()) throw new Error('Hierarchy copy changed');
  return value;
}

/** Coordinates one immutable hierarchy projection and a bounded shared row window. */
export class HierarchySourceController<T> implements ReactiveController {
  readonly window: SourceWindowController<Row<T>>;
  private readonly requests: SourceRequestController<'project' | 'navigate' | 'search' | 'copy'>;
  private source?: Source<T>;
  private boundInput?: Source<T>;
  private revision?: LyraSourceRevision;
  private locale = '';
  private query = EMPTY_QUERY;
  private readonly searchLane: CapabilityLane<SearchResult> = { scheduled: false };
  private readonly copyLane: CapabilityLane<string> = { scheduled: false };
  private readonly payload?: NonNullable<HierarchySourceOptions<T>['payload']>;
  private transaction = 0;
  private dirty = true;
  private running?: ProjectJob<T>;
  private queued?: ProjectJob<T>;
  private current?: ProjectJob<T>;
  private completion: Promise<boolean> = Promise.resolve(false);
  private pumpScheduled = false;
  private recovery?: { readonly key: string; readonly origin: Element };
  private focused?: { readonly index: number; readonly row: Row<T> };
  projection?: LyraHierarchyProjection<T>;
  loading = false;
  error = false;
  private mountedCheckScheduled = false;
  mountedActive = false;
  firstMountedIndex = 0;
  rowError = false;
  rowsObserved = false;
  get epoch(): number { return this.requests.epoch; }
  activeIndex = 0;
  activeKey?: string;
  list?: LyraVirtualList;
  adapter: LyraVirtualListIndexedSource<SourceWindowSlot<Row<T>>>;

  constructor(private readonly host: Host, private readonly options: HierarchySourceOptions<T>) {
    if (options.payload) {
      const { maxUnits, maxRowUnits, unitsOf } = options.payload;
      if (!Number.isSafeInteger(maxUnits) || !Number.isSafeInteger(maxRowUnits) || maxRowUnits < 1 ||
        maxUnits <= maxRowUnits + 65_536 || typeof unitsOf !== 'function') throw new RangeError('Invalid hierarchy payload bounds');
      this.payload = Object.freeze({ maxUnits, maxRowUnits, unitsOf });
    }
    this.requests = new SourceRequestController(host, { channels: ['project', 'navigate', 'search', 'copy'], onReset: () => this.reset() });
    this.window = new SourceWindowController(host, { pageSize: 100, maxRows: 400, maxPages: 4, maxConcurrent: 2,
      ...(this.payload ? { maxWeight: this.payload.maxUnits - this.payload.maxRowUnits - 65_536,
        weightOf: (row: Row<T>) => this.rowUnits(row) } : {}),
      keyOf: row => row.key, normalize: value => this.normalize(value), onChange: () => this.changed(),
    });
    this.adapter = this.makeAdapter();
    host.addController(this);
  }

  private rowUnits(row: Row<T>): number {
    if (!this.payload) return 0;
    const valueUnits = this.payload.unitsOf(row.value);
    if (!Number.isSafeInteger(valueUnits) || valueUnits < 0) throw new RangeError('Invalid hierarchy row weight');
    const units = valueUnits + row.key.length + (row.parentKey?.length ?? 0);
    if (!Number.isSafeInteger(units) || units > this.payload.maxRowUnits) throw new RangeError('Hierarchy row payload exceeded');
    return units;
  }

  requestRange(start: number, endExclusive: number): void { this.window.requestRange(start, endExclusive); }

  private normalize(value: unknown): Row<T> {
    const field = (key: string) => hierarchyField(value, key);
    const key = hierarchyKey(field('key'));
    const parent = field('parentKey');
    const parentKey = parent === null ? null : hierarchyKey(parent);
    const level = sourceCount(field('level'));
    const position = sourceCount(field('position'));
    const setSize = sourceCount(field('setSize'));
    const childCount = sourceCount(field('childCount'));
    const expanded = field('expanded');
    const selected = field('selected');
    const disabled = field('disabled');
    const selectionState = field('selectionState');
    if (level < 1 || position < 1 || position > setSize || typeof expanded !== 'boolean' || typeof selected !== 'boolean' ||
      (disabled !== undefined && typeof disabled !== 'boolean') ||
      (selectionState !== undefined && (typeof selectionState !== 'string' || !['none', 'partial', 'all'].includes(selectionState)))) throw new TypeError('Invalid hierarchy metadata');
    return Object.freeze({ key, value: this.options.normalize(field('value'), key, childCount), parentKey, level, position, setSize,
      childCount, expanded, selected, ...(disabled === undefined ? {} : { disabled }),
      ...(selectionState === undefined ? {} : { selectionState: selectionState as Row<T>['selectionState'] }),
    });
  }

  private makeAdapter(): LyraVirtualListIndexedSource<SourceWindowSlot<Row<T>>> {
    return { count: this.projection?.rows.count ?? 0,
      // Geometry can inspect off-window identities; only the row renderer starts reads.
      itemAt: index => ({ state: 'loading', index }),
      keyAt: index => this.focused?.index === index ? this.focused.row.key : this.window.source.keyAt!(index),
      indexOfKey: key => key === this.focused?.row.key ? this.focused.index : this.window.source.indexOfKey!(key),
    };
  }

  slot(index: number): SourceWindowSlot<Row<T>> {
    this.scheduleMountedCheck();
    const slot: SourceWindowSlot<Row<T>> = this.focused?.index === index
      ? { state: 'ready', index, value: this.focused.row } : this.window.source.itemAt(index);
    if (slot.state === 'ready' && this.activeKey === undefined && index < 32 && !slot.value.disabled) {
      this.activeIndex = index; this.activeKey = slot.value.key;
      const projection = this.projection;
      queueMicrotask(() => { if (this.projection === projection && this.host.isConnected) this.changed(); });
    }
    return slot;
  }

  private scheduleMountedCheck(): void {
    if (this.mountedCheckScheduled) return;
    this.mountedCheckScheduled = true;
    queueMicrotask(() => {
      this.mountedCheckScheduled = false;
      if (!this.host.isConnected || !this.list) return;
      let active = false;
      let error = false;
      let settled = false;
      const rows = this.list.projectedRows;
      for (const element of rows) {
        const row = element.querySelector<HTMLElement>('[data-source-key]');
        if (row) {
          settled = true;
          if (row.dataset['sourceKey'] === this.activeKey && row.getAttribute('aria-disabled') !== 'true') active = true;
        }
        if (element.querySelector('[part~="source-error"]')) { error = true; settled = true; }
      }
      const first = Number(rows[0]?.dataset['rowIndex'] ?? 0);
      const observed = this.rowsObserved || settled;
      if (active === this.mountedActive && first === this.firstMountedIndex && error === this.rowError && observed === this.rowsObserved) return;
      this.mountedActive = active; this.firstMountedIndex = first;
      this.rowError = error; this.rowsObserved = observed;
      this.changed();
    });
  }

  /** Same-source assignments and explicit refreshes invalidate synchronously. */
  update(source: Source<T> | undefined, locale: string, force = false, query: LyraHierarchyQuery = EMPTY_QUERY): void {
    const transaction = ++this.transaction;
    this.boundInput = source;
    let revision: LyraSourceRevision | undefined;
    let acceptedQuery: LyraHierarchyQuery;
    try {
      acceptedQuery = snapshotQuery(query);
      if (transaction !== this.transaction) return;
      if (source !== undefined) {
        if (source === null || (typeof source !== 'object' && typeof source !== 'function') || typeof source.project !== 'function')
          throw new TypeError('Invalid hierarchy source');
        revision = sourceRevision(source.revision);
      }
    } catch {
      if (transaction !== this.transaction) return;
      this.source = undefined; this.revision = undefined; this.locale = locale;
      this.requests.setSource(undefined, undefined);
      if (transaction !== this.transaction) return;
      this.reset(); this.error = source !== undefined; this.dirty = false;
      this.changed(); return;
    }
    if (transaction !== this.transaction) return;
    if (!force && !this.dirty && source === this.source && revision === this.revision && locale === this.locale && sameQuery(acceptedQuery, this.query)) return;
    this.query = acceptedQuery;
    this.source = source; this.revision = revision; this.locale = locale; this.dirty = false;
    const replaced = this.requests.setSource(source, revision);
    if (transaction !== this.transaction) return;
    if (!replaced) this.requests.refresh();
    if (transaction !== this.transaction) return;
    if (source && this.host.isConnected) void this.project({ type: 'reset' });
    this.changed();
  }

  refresh(): void { this.update(this.boundInput, this.locale, true, this.query); }
  private reset(): void {
    this.clearCapability(this.searchLane); this.clearCapability(this.copyLane);
    const active = deepActiveElementIn(this.host.ownerDocument);
    if (!this.source || !this.host.isConnected) this.recovery = undefined;
    else if (active && this.host.shadowRoot?.contains(active) && this.activeKey) this.recovery = { key: this.activeKey, origin: active };
    else if (active && active !== this.host.ownerDocument.body) this.recovery = undefined;
    this.current?.settle(false); this.queued?.settle(false);
    this.current = undefined; this.queued = undefined;
    this.projection = undefined; this.focused = undefined; this.activeKey = undefined; this.activeIndex = 0;
    this.loading = false; this.error = false;
    this.mountedActive = false; this.firstMountedIndex = 0; this.rowError = false; this.rowsObserved = false;
    this.window?.bind(undefined); this.adapter = this.makeAdapter();
  }
  private changed(): void {
    this.options.onChange();
    // Repaint slots without a keyless provider refresh or loss of logical scroll geometry.
    this.list?.requestUpdate('renderItem');
  }

  async project(action: LyraHierarchyAction, user = false, row?: Row<T>): Promise<boolean> {
    if (!this.source || !this.host.isConnected || (user && (this.loading || this.error))) return false;
    if ('key' in action) { try { hierarchyKey(action.key); } catch { return false; } }
    const source = this.source;
    const lease = this.requests.begin('project', this.locale);
    if (!lease?.isCurrent() || source !== this.source) return false;
    this.requests.invalidate('navigate');
    if (!lease.isCurrent()) return false;
    this.current?.settle(false); this.queued?.settle(false);
    let settle!: (accepted: boolean) => void;
    const done = new Promise<boolean>(resolve => { settle = resolve; });
    const job: ProjectJob<T> = { source, lease, action, query: this.query, state: this.projection?.state ?? null, user, row, settle };
    lease.context.signal.addEventListener('abort', () => { job.state = null; job.row = undefined; settle(false); }, { once: true });
    this.completion = done;
    this.current = job; this.queued = job; this.loading = true; this.error = false;
    this.changed(); this.schedulePump();
    return done;
  }
  private schedulePump(): void {
    if (this.pumpScheduled) return;
    this.pumpScheduled = true;
    queueMicrotask(() => { this.pumpScheduled = false; this.pump(); });
  }
  private pump(): void {
    if (this.running) return;
    const job = this.queued;
    if (!job) return;
    this.queued = undefined;
    const current = () => this.current === job && job.lease.isCurrent() && this.source === job.source;
    if (!current()) { job.settle(false); return; }
    this.running = job;
    const recovery = this.recovery;
    const focusedKey = this.focused?.row.key ?? recovery?.key;
    const origin = recovery?.origin ?? deepActiveElementIn(this.host.ownerDocument);
    void Promise.resolve().then(() => {
      if (!current()) return undefined;
      const state = job.state;
      job.state = null;
      const project = job.source.project;
      if (!current()) return undefined;
      return project.call(job.source, { ...job.lease.context, query: job.query, state, action: job.action });
    }).then(async result => {
      if (!current()) return;
      if (!result) throw new TypeError('Invalid hierarchy projection');
      const state = result.state;
      if (typeof state !== 'string' || state.length === 0 || state.length > 65_536) throw new TypeError('Invalid hierarchy state');
      const total = sourceCount(result.total);
      const view = result.rows;
      const count = sourceCount(view?.count);
      const focusIndex = result.focusIndex;
      const indexed = typeof (view as { itemAt?: unknown }).itemAt === 'function';
      if (count > total || typeof view.indexOfKey !== 'function' ||
        (indexed ? typeof (view as { keyAt?: unknown }).keyAt !== 'function' : typeof (view as { read?: unknown }).read !== 'function'))
        throw new TypeError('Invalid hierarchy view');
      if (focusIndex !== undefined && (sourceCount(focusIndex) >= count)) throw new RangeError('Invalid hierarchy focus');
      if (!current()) return;
      this.window.bind({ owner: job.source, revision: job.lease.context.revision, epoch: this.requests.epoch,
        locale: job.lease.context.locale, view });
      if (!current()) return;
      this.projection = Object.freeze({ state, total, rows: view,
        ...(focusIndex === undefined ? {} : { focusIndex }) });
      this.focused = undefined; this.recovery = undefined;
      this.activeIndex = Math.min(this.activeIndex, Math.max(0, count - 1));
      this.activeKey = undefined; this.adapter = this.makeAdapter(); this.loading = false; this.error = false;
      this.changed();
      if (!current()) return;
      if (job.user) this.options.accepted(job.action, job.row, state, current);
      job.row = undefined;
      if (!current()) return;
      if (job.action.type === 'reveal') {
        job.settle(focusIndex !== undefined && await this.navigate(focusIndex, 0, origin));
      } else if (focusedKey && origin && (recovery || this.host.shadowRoot?.contains(origin))) {
        const index = await this.window.resolveKey(focusedKey);
        if (!current()) return;
        await this.navigate(index ?? focusIndex ?? this.activeIndex, 0, origin);
        if (current()) job.settle(true);
      } else job.settle(true);
    }).catch(() => {
      if (!current()) return;
      this.loading = false; this.error = true; this.changed(); job.settle(false);
    }).finally(() => {
      job.state = null; job.row = undefined;
      if (this.running === job) this.running = undefined;
      this.schedulePump();
    });
  }

  private clearCapability<V>(lane: CapabilityLane<V>): void {
    lane.current?.settle({ status: 'stale' }); lane.queued?.settle({ status: 'stale' });
    lane.current = undefined; lane.queued = undefined;
  }
  private scheduleCapability<V>(lane: CapabilityLane<V>): void {
    if (lane.scheduled) return;
    lane.scheduled = true;
    queueMicrotask(() => {
      lane.scheduled = false;
      if (lane.running || !lane.queued) return;
      const job = lane.queued;
      lane.queued = undefined;
      if (lane.current !== job || !job.lease.isCurrent()) { job.settle({ status: 'stale' }); return; }
      lane.running = job;
      void job.run().finally(() => {
        if (lane.running === job) lane.running = undefined;
        this.scheduleCapability(lane);
      });
    });
  }
  private capability<V>(channel: 'search' | 'copy', lane: CapabilityLane<V>,
    invoke: (source: Source<T>, lease: SourceRequestLease) => unknown,
    validate: (value: unknown, current: () => boolean) => V | Promise<V>): Promise<HierarchyCapabilityResult<V>> {
    const source = this.source;
    if (!source) return Promise.resolve({ status: 'unavailable' });
    if (!this.host.isConnected) return Promise.resolve({ status: 'stale' });
    const lease = this.requests.begin(channel, this.locale);
    if (!lease?.isCurrent() || source !== this.source) return Promise.resolve({ status: 'stale' });
    this.clearCapability(lane);
    let settle!: (result: HierarchyCapabilityResult<V>) => void;
    const done = new Promise<HierarchyCapabilityResult<V>>(resolve => { settle = resolve; });
    const current = () => lane.current === job && source === this.source && lease.isCurrent();
    const job: CapabilityJob<V> = { lease, settle, run: async () => {
      try {
        if (!current()) { settle({ status: 'stale' }); return; }
        const raw = await invoke(source, lease);
        if (!current()) { settle({ status: 'stale' }); return; }
        if (raw === UNAVAILABLE) { settle({ status: 'unavailable' }); return; }
        const value = await validate(raw, current);
        settle(current() ? { status: 'ready', value, isCurrent: current } : { status: 'stale' });
      } catch { settle({ status: current() ? 'error' : 'stale' }); }
    } };
    lane.current = job; lane.queued = job;
    lease.context.signal.addEventListener('abort', () => settle({ status: 'stale' }), { once: true });
    this.scheduleCapability(lane);
    return done;
  }

  cancelSearch(): void {
    const transaction = ++this.transaction;
    this.clearCapability(this.searchLane); this.requests.invalidate('search');
    if (transaction !== this.transaction) return;
    this.clearCapability(this.copyLane); this.requests.invalidate('copy');
    if (transaction !== this.transaction) return;
    this.requests.invalidate('navigate');
    if (transaction !== this.transaction) return;
    // Preserve an initial/reset projection; only a reveal belongs to the cancelled search intent.
    if (this.current?.action.type === 'reveal') {
      this.current.settle(false); this.queued?.settle(false);
      this.current = undefined; this.queued = undefined;
      this.requests.invalidate('project');
      if (transaction !== this.transaction) return;
      this.loading = false; this.changed();
    }
  }
  search(): Promise<HierarchyCapabilityResult<SearchResult>> {
    const transaction = this.transaction + 1;
    this.cancelSearch();
    if (transaction !== this.transaction) return Promise.resolve({ status: 'stale' });
    const query = this.query.search;
    return this.capability('search', this.searchLane, (source, lease) => {
      const search = source.search;
      if (!lease.isCurrent() || source !== this.source) return UNAVAILABLE;
      return typeof search === 'function' ? search.call(source, { ...lease.context, query, limit: 10_000 }) : UNAVAILABLE;
    }, snapshotSearch);
  }
  copy(key: string | null, scope: 'node' | 'subtree' | 'document', maxBytes: number): Promise<HierarchyCapabilityResult<string>> {
    const transaction = ++this.transaction;
    this.clearCapability(this.copyLane); this.requests.invalidate('copy');
    if (transaction !== this.transaction) return Promise.resolve({ status: 'stale' });
    try {
      if (!['node', 'subtree', 'document'].includes(scope) || (scope === 'document') !== (key === null) ||
        !Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('Invalid hierarchy copy request');
      if (key !== null) hierarchyKey(key);
    } catch { return Promise.resolve({ status: 'error' }); }
    const owner = this.host.ownerDocument;
    return this.capability('copy', this.copyLane, (source, lease) => {
      const copy = source.copy;
      if (!lease.isCurrent() || source !== this.source) return UNAVAILABLE;
      return typeof copy === 'function' ? copy.call(source, { ...lease.context, key, scope, maxBytes }) : UNAVAILABLE;
    }, (value, current) => boundedCopy(value, maxBytes, owner, current));
  }

  whenReady(): Promise<boolean> { return this.completion; }
  cancelPending(): void {
    if (!this.projection) return;
    const transaction = ++this.transaction;
    this.current?.settle(false); this.queued?.settle(false);
    this.current = undefined; this.queued = undefined;
    this.requests.invalidate('project');
    if (transaction !== this.transaction) return;
    this.requests.invalidate('navigate');
    if (transaction !== this.transaction) return;
    this.loading = false; this.changed();
  }

  reveal(key: string): Promise<boolean> {
    try { hierarchyKey(key); } catch { return Promise.resolve(false); }
    return this.project({ type: 'reveal', key });
  }
  retry(): void { void this.project({ type: 'reset' }); }
  focusRow(index: number, row: Row<T>): void {
    if (row.disabled) return;
    if (this.payload) {
      const projection = this.projection;
      const transaction = this.transaction;
      try { this.rowUnits(row); } catch { return; }
      if (projection !== this.projection || transaction !== this.transaction || !this.host.isConnected) return;
    }
    this.activeIndex = index; this.activeKey = row.key; this.focused = { index, row }; this.changed();
  }
  private focusUnchanged(origin: Element | null): boolean {
    const active = deepActiveElementIn(this.host.ownerDocument);
    return active === origin || active === this.host.ownerDocument.body || active === this.host || active === null;
  }
  async navigate(index: number, step = 0, origin: Element | null = deepActiveElementIn(this.host.ownerDocument)): Promise<boolean> {
    const projection = this.projection;
    const lease = this.requests.begin('navigate', this.locale);
    if (!projection || !lease) return false;
    const current = () => lease.isCurrent() && this.projection === projection;
    for (let attempts = 0; attempts < 32 && index >= 0 && index < projection.rows.count; attempts++, index += step) {
      await this.host.updateComplete;
      if (!current() || !this.focusUnchanged(origin) || !this.list) return false;
      // Move the shared viewport before loading: its old page window must not evict the target.
      this.list.scrollToIndex(index, { align: 'auto', behavior: 'auto' });
      if (!await this.nextFrame(lease) || !current()) return false;
      if (!await this.window.ensure(index) || !current()) return false;
      const slot = this.window.source.itemAt(index);
      if (!current() || slot.state !== 'ready') return false;
      if (slot.value.disabled) { if (!step) return false; continue; }
      this.activeIndex = index; this.activeKey = slot.value.key;
      this.changed();
      await this.host.updateComplete;
      if (!current() || !this.list) return false;
      await this.list.updateComplete;
      if (!current() || !this.focusUnchanged(origin)) return false;
      const row = this.list.projectedRows.find(element => Number(element.dataset['rowIndex']) === index)
        ?.querySelector<HTMLElement>('[data-source-key]');
      if (!row) return false;
      row.focus({ preventScroll: true });
      if (!current()) return false;
      this.focusRow(index, slot.value);
      return true;
    }
    return false;
  }

  private nextFrame(lease: SourceRequestLease): Promise<boolean> {
    const view = this.host.ownerDocument.defaultView;
    if (!view || !lease.isCurrent()) return Promise.resolve(false);
    return new Promise(resolve => {
      const signal = lease.context.signal;
      const cancel = () => { view.cancelAnimationFrame(frame); resolve(false); };
      const frame = view.requestAnimationFrame(() => { signal.removeEventListener('abort', cancel); resolve(lease.isCurrent()); });
      signal.addEventListener('abort', cancel, { once: true });
      if (!lease.isCurrent()) cancel();
    });
  }

  keydown(event: KeyboardEvent, row: Row<T> | undefined, index: number, rtl: boolean,
    select: (row: Row<T>) => void): void {
    if (event.altKey || event.ctrlKey || event.metaKey || this.loading || this.error) return;
    let target: number | undefined;
    let step = 0;
    if (event.key === 'Home') { target = 0; step = 1; }
    else if (event.key === 'End') { target = (this.projection?.rows.count ?? 0) - 1; step = -1; }
    else if (event.key === 'ArrowDown') { target = index + 1; step = 1; }
    else if (event.key === 'ArrowUp') { target = index - 1; step = -1; }
    else if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(row); return; }
    else if (row && event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) {
      event.preventDefault();
      if (row.childCount && !row.expanded) void this.project({ type: 'toggle', key: row.key, expanded: true }, true, row);
      else if (row.childCount && row.expanded) void this.navigate(index + 1, 1);
      return;
    } else if (row && event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) {
      event.preventDefault();
      if (row.childCount && row.expanded) void this.project({ type: 'toggle', key: row.key, expanded: false }, true, row);
      else if (row.parentKey) void this.reveal(row.parentKey);
      return;
    }
    if (target !== undefined) { event.preventDefault(); void this.navigate(target, step); }
  }
  adopted(): void { this.dirty = true; this.requests.adopted(); this.window.adopted(); this.changed(); }
  hostConnected(): void { this.dirty = true; this.changed(); }
  hostDisconnected(): void { this.dirty = true; this.current?.settle(false); this.queued?.settle(false); this.list = undefined; }
}
