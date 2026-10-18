import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraIndexedView, LyraRangeSource, LyraSourceRevision } from '../data-sources.js';
import type { LyraVirtualListIndexedSource } from '../components/layout/virtual-list/virtual-list.class.js';
import { SourceRequestController, sourceCount, sourceRevision } from './source-request-controller.js';

export type SourceWindowSlot<T> =
  | { readonly state: 'ready'; readonly index: number; readonly value: T }
  | { readonly state: 'loading'; readonly index: number }
  | { readonly state: 'error'; readonly index: number; readonly error: unknown };

export interface SourceWindowBinding<T> {
  readonly owner: object;
  readonly revision: LyraSourceRevision;
  readonly epoch: number;
  readonly locale: string;
  readonly view: LyraIndexedView<T>;
}

export interface SourceWindowOptions<T> {
  readonly pageSize: number;
  readonly maxRows: number;
  readonly maxPages: number;
  readonly maxConcurrent: 1 | 2;
  /** Optional shared ceiling for normalized cached and staged values; requires weightOf. */
  readonly maxWeight?: number;
  /** Nonnegative safe-integer weight of a normalized value; requires maxWeight. */
  readonly weightOf?: (value: T, index: number) => number;
  readonly keyOf: (value: T) => string;
  readonly normalize: (value: unknown, index: number) => T;
  /** Update named reactive state; a keyless host refresh would invalidate the source again. */
  readonly onChange: () => void;
}

type RangeChannel = 'range-0' | 'range-1';
const MAX_SOURCE_KEY_UNITS = 65_536;
const MAX_CACHED_KEY_UNITS = 2_000_000;

function validKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length <= MAX_SOURCE_KEY_UNITS;
}

interface Page<T> {
  readonly start: number;
  readonly length: number;
  readonly done: Promise<boolean>;
  readonly settle: (ready: boolean) => void;
  state: 'queued' | 'loading' | 'ready' | 'error';
  slots?: SourceWindowSlot<T>[];
  keys?: string[];
  keyUnits?: number;
  weight?: number;
  staging?: SourceWindowSlot<T>[];
  error?: unknown;
  channel?: RangeChannel;
}
interface CachedSlot<T> { readonly slot: SourceWindowSlot<T>; readonly key?: string; readonly weight?: number; }
interface Lookup<T> {
  readonly key: string;
  readonly binding: SourceWindowBinding<T>;
  readonly generation: number;
  readonly owner: Document;
  readonly settle: (index: number | null) => void;
}

function isIndexed<T>(view: LyraIndexedView<T>): view is LyraVirtualListIndexedSource<T> {
  return typeof (view as LyraVirtualListIndexedSource<T>).itemAt === 'function';
}

/** Adapts a bounded cache to the existing logical virtual-list geometry. Keys retain at most
 * 65,536 UTF-16 units each and 2,000,000 units across cached rows. A staged range has the same
 * aggregate ceiling. Optional payload accounting shares one ceiling across normalized cache
 * and staging, protecting requested rows from weight eviction. Provider-owned values remain opaque. */
export class SourceWindowController<T> implements ReactiveController {
  readonly source: LyraVirtualListIndexedSource<SourceWindowSlot<T>>;
  private binding?: SourceWindowBinding<T>;
  private count = 0;
  private generation = 0;
  private bindingVersion = 0;
  private windowVersion = 0;
  private demandVersion = 0;
  private lookupVersion = 0;
  private lookupCurrent?: Lookup<T>;
  private lookupRunning?: Lookup<T>;
  private lookupScheduled = false;
  private requested?: { start: number; end: number };
  private connected: boolean;
  private readonly authority: SourceRequestController<RangeChannel | 'lookup'>;
  private readonly pages = new Map<number, Page<T>>();
  private readonly local = new Map<number, CachedSlot<T>>();
  private cachedKeyUnits = 0;
  private totalWeight = 0;
  private queue: Page<T>[] = [];
  // Revoked providers retain their permit until settlement, even when they ignore abort.
  private readonly running = new Map<RangeChannel, Page<T>>();
  private readonly pageCapacity: number;
  private pumpScheduled = false;
  private notification?: object;
  private readonly options: SourceWindowOptions<T>;

  constructor(private readonly host: HTMLElement & ReactiveControllerHost, options: SourceWindowOptions<T>) {
    this.options = Object.freeze({ ...options });
    const pageSize = sourceCount(options.pageSize);
    const maxRows = sourceCount(options.maxRows);
    const maxPages = sourceCount(options.maxPages);
    if (pageSize < 1 || maxRows < 1 || maxRows > 500 || pageSize > maxRows || maxPages < 1 || maxPages > 5 ||
      (options.maxConcurrent !== 1 && options.maxConcurrent !== 2)) throw new RangeError('Invalid source window bounds');
    if ((options.maxWeight === undefined) !== (options.weightOf === undefined) ||
      (options.maxWeight !== undefined && (!Number.isSafeInteger(options.maxWeight) || options.maxWeight < 1 ||
        typeof options.weightOf !== 'function'))) throw new RangeError('Invalid source weight bounds');
    this.pageCapacity = Math.min(maxPages, Math.floor(maxRows / pageSize));
    this.connected = host.isConnected;
    this.authority = new SourceRequestController(host, {
      channels: ['range-0', 'range-1', 'lookup'], onReset: () => this.clear(),
    });
    const control = this;
    this.source = {
      get count() { return control.count; },
      itemAt: index => this.itemAt(index),
      keyAt: index => this.keyAt(index),
      indexOfKey: key => typeof key === 'string' ? this.cachedIndex(key) : -1,
    };
    host.addController(this);
  }

  bind(binding: SourceWindowBinding<T> | undefined): void {
    const transaction = ++this.bindingVersion;
    const previous = this.binding;
    let candidate: SourceWindowBinding<T> | undefined;
    let nextCount = 0;
    try {
      if (binding) {
        candidate = { owner: binding.owner, revision: binding.revision, epoch: binding.epoch,
          locale: binding.locale, view: binding.view };
        sourceRevision(candidate.revision);
        sourceCount(candidate.epoch);
        nextCount = sourceCount(candidate.view.count);
        const indexed = isIndexed(candidate.view);
        const ranged = typeof (candidate.view as LyraRangeSource<T>).read === 'function';
        if (indexed === ranged) throw new TypeError('Source must provide indexed or ranged access');
        if (previous && previous.owner === candidate.owner && previous.revision === candidate.revision &&
          previous.epoch === candidate.epoch && previous.view === candidate.view && previous.locale === candidate.locale && nextCount === this.count) return;
      }
    } catch (error) {
      if (transaction === this.bindingVersion) {
        this.binding = undefined;
        this.count = 0;
        this.requested = undefined;
        this.authority.setSource(undefined, undefined);
      }
      throw error;
    }
    if (transaction !== this.bindingVersion) return;
    this.binding = undefined;
    this.count = 0;
    this.requested = undefined;
    this.authority.refresh();
    if (transaction !== this.bindingVersion) return;
    this.authority.setSource(candidate?.owner, candidate?.revision);
    if (transaction !== this.bindingVersion) return;
    this.binding = candidate;
    this.count = nextCount;
  }

  requestRange(start: number, endExclusive: number): void {
    sourceCount(start);
    sourceCount(endExclusive);
    if (endExclusive < start) throw new RangeError('Invalid source range');
    if (!this.usable() || !this.binding) return;
    const transaction = ++this.windowVersion;
    const binding = this.binding;
    const generation = this.generation;
    const owner = this.host.ownerDocument;
    const boundedEnd = Math.min(endExclusive, this.count, start + this.options.maxRows);
    const boundedStart = Math.min(start, this.count);
    if (this.requested?.start !== boundedStart || this.requested.end !== boundedEnd) this.demandVersion++;
    this.requested = { start: boundedStart, end: boundedEnd };
    if (isIndexed(this.binding.view)) return;
    const first = this.pageStart(start);
    const end = Math.min(endExclusive, this.count);
    const size = Math.min(this.pageCapacity, Math.max(0, Math.ceil((end - first) / this.options.pageSize)));
    // Bound page count before constructing any queue or enumerating the requested interval.
    const wanted = new Set<number>();
    if (start < end) for (let i = 0; i < size; i++) wanted.add(first + i * this.options.pageSize);
    for (const page of [...this.pages.values()]) {
      if ((page.state === 'queued' || page.state === 'loading') && !wanted.has(page.start)) this.drop(page);
      if (transaction !== this.windowVersion || !this.current(binding, generation, owner)) return;
    }
    // Reserve every retained wanted page before a missing page can evict an older cache entry.
    // Otherwise an overlapping window whose first page is absent can discard all its ready rows.
    for (const offset of wanted) {
      const existing = this.pages.get(offset);
      if (existing) { this.pages.delete(offset); this.pages.set(offset, existing); }
    }
    for (const offset of wanted) {
      this.page(offset, false, transaction);
      if (transaction !== this.windowVersion || !this.current(binding, generation, owner)) return;
    }
  }

  async ensure(index: number): Promise<boolean> {
    if (!this.usable() || !this.validIndex(index) || !this.binding) return false;
    this.rememberIndex(index);
    if (isIndexed(this.binding.view)) {
      if (this.local.get(index)?.slot.state === 'error') this.removeLocal(index);
      return this.itemAt(index).state === 'ready';
    }
    const generation = this.generation;
    const page = this.page(this.pageStart(index), true);
    if (!page) return false;
    const ready = await page.done;
    return ready && this.usable() && this.generation === generation && this.pages.get(page.start) === page;
  }

  resolveKey(key: string): Promise<number | null> {
    const transaction = ++this.lookupVersion;
    const binding = this.binding;
    const generation = this.generation;
    const owner = this.host.ownerDocument;
    this.lookupCurrent?.settle(null);
    this.lookupCurrent = undefined;
    this.authority.invalidate('lookup');
    if (!binding || transaction !== this.lookupVersion || !this.current(binding, generation, owner) || !validKey(key)) return Promise.resolve(null);
    let settle!: (index: number | null) => void;
    const done = new Promise<number | null>(resolve => { settle = resolve; });
    this.lookupCurrent = { key, binding, generation, owner, settle };
    this.scheduleLookup();
    return done;
  }

  private scheduleLookup(): void {
    if (this.lookupScheduled) return;
    this.lookupScheduled = true;
    queueMicrotask(() => { this.lookupScheduled = false; this.pumpLookup(); });
  }

  private pumpLookup(): void {
    if (this.lookupRunning) return;
    const lookup = this.lookupCurrent;
    if (!lookup) return;
    const current = () => this.lookupCurrent === lookup && this.current(lookup.binding, lookup.generation, lookup.owner);
    if (!current()) { lookup.settle(null); this.lookupCurrent = undefined; return; }
    // One physical lookup and one latest logical request; ignored abort cannot grow this queue.
    this.lookupRunning = lookup;
    const lease = this.authority.begin('lookup', lookup.binding.locale);
    if (!lease || !current() || !lease.isCurrent()) {
      lookup.settle(null);
      if (this.lookupCurrent === lookup) this.lookupCurrent = undefined;
      this.lookupRunning = undefined;
      this.scheduleLookup();
      return;
    }
    void Promise.resolve().then(() => {
      if (!current() || !lease.isCurrent()) return null;
      const view = lookup.binding.view;
      return isIndexed(view) ? view.indexOfKey?.(lookup.key) : view.indexOfKey?.(lookup.key, lease.context);
    }).then(index => {
      lookup.settle(current() && lease.isCurrent() && typeof index === 'number' && this.validIndex(index) ? index : null);
    }).catch(() => lookup.settle(null)).finally(() => {
      if (this.lookupCurrent === lookup) this.lookupCurrent = undefined;
      if (this.lookupRunning === lookup) this.lookupRunning = undefined;
      this.scheduleLookup();
    });
  }

  private current(binding: SourceWindowBinding<T>, generation: number, owner: Document): boolean {
    return this.binding === binding && this.generation === generation && this.host.ownerDocument === owner && this.usable();
  }

  private rememberIndex(index: number): void {
    if (!this.requested || index < this.requested.start || index >= this.requested.end) {
      this.requested = { start: index, end: index + 1 };
      if (this.options.maxWeight !== undefined) this.demandVersion++;
    }
  }

  private usable(): boolean { return this.connected && this.host.isConnected; }
  private validIndex(index: number): boolean { return Number.isSafeInteger(index) && index >= 0 && index < this.count; }
  private pageStart(index: number): number { return Math.floor(index / this.options.pageSize) * this.options.pageSize; }

  private itemAt(index: number): SourceWindowSlot<T> {
    if (!this.validIndex(index)) return { state: 'error', index, error: new RangeError('Invalid source index') };
    const binding = this.binding;
    if (!binding || !this.usable()) return { state: 'loading', index };
    this.rememberIndex(index);
    if (isIndexed(binding.view)) {
      const cached = this.local.get(index);
      if (cached) { this.local.delete(index); this.local.set(index, cached); return cached.slot; }
      const generation = this.generation;
      const owner = this.host.ownerDocument;
      const transaction = this.demandVersion;
      const current = () => this.current(binding, generation, owner) &&
        (this.options.maxWeight === undefined || transaction === this.demandVersion);
      let entry: CachedSlot<T>;
      try {
        const raw = binding.view.itemAt(index);
        if (!current()) return { state: 'loading', index };
        const value = this.options.normalize(raw, index);
        if (!current()) return { state: 'loading', index };
        const key = this.validateKey(value, index);
        if (!current()) return { state: 'loading', index };
        if (binding.view.keyAt && binding.view.keyAt(index) !== key) throw new TypeError('Source row key mismatch');
        if (!current()) return { state: 'loading', index };
        const weight = this.valueWeight(value, index);
        if (!current() || !this.admitWeight(weight, current)) return { state: 'loading', index };
        while (this.cachedKeyUnits + key.length > MAX_CACHED_KEY_UNITS) {
          const oldest = [...this.local.keys()].find(candidate => this.options.maxWeight === undefined || !this.demands(candidate, 1));
          if (oldest === undefined) throw new RangeError('Source window key budget exceeded');
          this.removeLocal(oldest);
        }
        entry = { slot: { state: 'ready', index, value }, key, weight };
      } catch (error) {
        entry = { slot: { state: 'error', index, error: this.options.maxWeight === undefined
          ? error : new Error('Source row admission failed') } };
      }
      if (!current()) return { state: 'loading', index };
      this.removeLocal(index);
      while (this.local.size >= this.options.maxRows) this.removeLocal(this.local.keys().next().value!);
      this.local.set(index, entry);
      this.cachedKeyUnits += entry.key?.length ?? 0;
      this.totalWeight += entry.weight ?? 0;
      return entry.slot;
    }
    const page = this.page(this.pageStart(index), false);
    if (page?.state === 'ready') return page.slots![index - page.start]!;
    if (page?.state === 'error') return { state: 'error', index, error: page.error };
    return { state: 'loading', index };
  }

  private keyAt(index: number): string | number {
    const binding = this.binding;
    if (!this.usable() || !this.validIndex(index)) return index;
    if (binding && isIndexed(binding.view) && binding.view.keyAt) {
      const generation = this.generation;
      const owner = this.host.ownerDocument;
      try {
        const key = binding.view.keyAt(index);
        if (this.current(binding, generation, owner) && validKey(key)) return key;
      } catch { /* Invalid values are exposed as row errors when the row is read. */ }
      return index;
    }
    const local = this.local.get(index);
    if (local?.key) return local.key;
    const page = this.pages.get(this.pageStart(index));
    return page?.keys?.[index - page.start] ?? index;
  }

  private cachedIndex(key: string): number {
    const binding = this.binding;
    if (!binding || !this.usable() || !validKey(key)) return -1;
    const generation = this.generation;
    const owner = this.host.ownerDocument;
    const view = binding.view;
    if (isIndexed(view) && view.indexOfKey) {
      try {
        const index = view.indexOfKey(key);
        return this.current(binding, generation, owner) && this.validIndex(index) ? index : -1;
      } catch { return -1; }
    }
    for (const [index, entry] of this.local) if (entry.key === key) return index;
    for (const page of this.pages.values()) {
      const offset = page.keys?.indexOf(key) ?? -1;
      if (offset >= 0) return page.start + offset;
    }
    return -1;
  }

  private validateKey(value: T, index: number): string {
    const key = this.options.keyOf(value);
    if (!validKey(key)) throw new TypeError('Invalid source key');
    for (const [other, entry] of this.local) if (other !== index && entry.key === key) throw new TypeError('Duplicate source key');
    for (const page of this.pages.values()) {
      const offset = page.keys?.indexOf(key) ?? -1;
      if (offset >= 0 && page.start + offset !== index) throw new TypeError('Duplicate source key');
    }
    return key;
  }

  private removeLocal(index: number): void {
    const entry = this.local.get(index);
    if (!entry) return;
    this.cachedKeyUnits -= entry.key?.length ?? 0;
    this.totalWeight -= entry.weight ?? 0;
    this.local.delete(index);
  }

  private demands(start: number, length: number): boolean {
    return !!this.requested && start < this.requested.end && start + length > this.requested.start;
  }

  private valueWeight(value: T, index: number): number {
    if (this.options.maxWeight === undefined) return 0;
    const weight = this.options.weightOf!(value, index);
    if (!Number.isSafeInteger(weight) || weight < 0 || weight > this.options.maxWeight)
      throw new RangeError('Invalid source row weight');
    return weight;
  }

  private admitWeight(weight: number, current: () => boolean, staging?: Page<T>): boolean {
    const maximum = this.options.maxWeight;
    if (maximum === undefined) return current();
    while (weight > maximum - this.totalWeight) {
      const local = [...this.local.entries()].find(([index, entry]) => (entry.weight ?? 0) > 0 && !this.demands(index, 1));
      if (local) this.removeLocal(local[0]);
      else {
        const page = [...this.pages.values()].find(candidate => candidate !== staging &&
          (candidate.weight ?? 0) > 0 && !this.demands(candidate.start, candidate.length));
        if (!page) throw new RangeError('Source window weight budget exceeded');
        this.drop(page);
      }
      // Evicting a loading page can synchronously invoke a provider's abort callback.
      if (!current()) return false;
    }
    return current();
  }

  private releasePageValues(page: Page<T>): void {
    this.cachedKeyUnits -= page.keyUnits ?? 0;
    this.totalWeight -= page.weight ?? 0;
    if (page.staging) page.staging.length = 0;
    page.staging = undefined;
    page.keys = undefined;
    page.slots = undefined;
    page.keyUnits = undefined;
    page.weight = undefined;
  }

  private page(start: number, retry: boolean, transaction = ++this.windowVersion): Page<T> | undefined {
    const binding = this.binding;
    const generation = this.generation;
    const owner = this.host.ownerDocument;
    if (!binding || !this.usable() || !this.validIndex(start)) return undefined;
    const existing = this.pages.get(start);
    if (existing && !(retry && existing.state === 'error')) {
      this.pages.delete(start); this.pages.set(start, existing);
      return existing;
    }
    if (existing) this.drop(existing);
    if (transaction !== this.windowVersion || !this.current(binding, generation, owner)) return undefined;
    while (this.pages.size >= this.pageCapacity) {
      this.drop(this.pages.values().next().value!);
      if (transaction !== this.windowVersion || !this.current(binding, generation, owner)) return undefined;
    }
    let settle!: (ready: boolean) => void;
    const done = new Promise<boolean>(resolve => { settle = resolve; });
    const page: Page<T> = { start, length: Math.min(this.options.pageSize, this.count - start), state: 'queued', done, settle };
    this.pages.set(start, page);
    this.queue.push(page);
    this.schedulePump();
    return page;
  }

  private drop(page: Page<T>): void {
    if (this.pages.get(page.start) === page) {
      this.pages.delete(page.start);
    }
    this.releasePageValues(page);
    this.queue = this.queue.filter(candidate => candidate !== page);
    if (page.channel && this.running.get(page.channel) === page) this.authority.invalidate(page.channel);
    page.settle(false);
  }

  private clear(): void {
    this.generation++;
    this.windowVersion++;
    this.demandVersion++;
    this.lookupVersion++;
    this.lookupCurrent?.settle(null);
    this.lookupCurrent = undefined;
    this.notification = undefined;
    const pages = [...this.pages.values()];
    this.pages.clear();
    this.queue = [];
    this.local.clear();
    this.cachedKeyUnits = 0;
    this.totalWeight = 0;
    for (const page of pages) {
      if (page.staging) page.staging.length = 0;
      page.staging = undefined;
      page.weight = undefined;
      page.keys = undefined;
      page.slots = undefined;
      page.keyUnits = undefined;
      page.settle(false);
      if (page.channel && this.running.get(page.channel) === page) this.authority.invalidate(page.channel);
    }
  }

  private schedulePump(): void {
    if (this.pumpScheduled) return;
    this.pumpScheduled = true;
    queueMicrotask(() => { this.pumpScheduled = false; this.pump(); });
  }

  private pump(): void {
    const binding = this.binding;
    if (!binding || !this.usable() || isIndexed(binding.view)) return;
    for (let i = 0; i < this.options.maxConcurrent; i++) {
      const channel: RangeChannel = i === 0 ? 'range-0' : 'range-1';
      if (this.running.has(channel)) continue;
      const page = this.queue.shift();
      if (!page) break;
      const generation = this.generation;
      const owner = this.host.ownerDocument;
      const lease = this.authority.begin(channel, binding.locale);
      if (!lease || !this.current(binding, generation, owner)) { this.drop(page); continue; }
      const view = binding.view;
      page.state = 'loading'; page.channel = channel;
      this.running.set(channel, page);
      const current = () => lease.isCurrent() && this.current(binding, generation, owner) && this.pages.get(page.start) === page;
      let acceptanceVersion: number | undefined;
      let restart = false;
      void Promise.resolve().then(() => current()
        ? view.read({ ...lease.context, offset: page.start, limit: page.length }) : undefined,
      ).then(values => {
        if (!current()) return;
        if (!Array.isArray(values) || values.length !== page.length) throw new RangeError('Invalid source range response');
        const transaction = this.demandVersion;
        acceptanceVersion = transaction;
        const accepting = () => current() && (this.options.maxWeight === undefined || transaction === this.demandVersion);
        const keys: string[] = [];
        let keyUnits = 0;
        const seen = new Set<string>();
        const slots: SourceWindowSlot<T>[] = [];
        if (this.options.maxWeight !== undefined) page.staging = slots;
        for (let offset = 0; offset < page.length; offset++) {
          const index = page.start + offset;
          const raw = values[offset];
          if (!accepting()) throw new Error('Source demand changed');
          const value = this.options.normalize(raw, index);
          if (!accepting()) throw new Error('Source demand changed');
          const key = this.validateKey(value, index);
          if (!accepting()) throw new Error('Source demand changed');
          keyUnits += key.length;
          if (keyUnits > MAX_CACHED_KEY_UNITS) throw new RangeError('Source range key budget exceeded');
          if (seen.has(key)) throw new TypeError('Duplicate source key');
          const weight = this.valueWeight(value, index);
          if (!accepting() || !this.admitWeight(weight, accepting, page)) throw new Error('Source demand changed');
          page.weight = (page.weight ?? 0) + weight;
          this.totalWeight += weight;
          seen.add(key); keys.push(key); slots.push({ state: 'ready', index, value });
        }
        if (!accepting()) throw new Error('Source demand changed');
        // A range is indivisible. Weighted callers retain demanded pages and expose a
        // stable error when the complete requested payload cannot fit its shared budget.
        for (const cached of this.pages.values()) {
          if (this.cachedKeyUnits + keyUnits <= MAX_CACHED_KEY_UNITS) break;
          if (cached !== page && cached.keys && (this.options.maxWeight === undefined || !this.demands(cached.start, cached.length))) this.drop(cached);
          if (!accepting()) throw new Error('Source demand changed');
        }
        if (this.cachedKeyUnits + keyUnits > MAX_CACHED_KEY_UNITS) throw new RangeError('Source window key budget exceeded');
        page.keys = keys; page.slots = slots; page.keyUnits = keyUnits; page.staging = undefined;
        this.cachedKeyUnits += keyUnits;
        page.state = 'ready'; page.settle(true);
        this.notify();
      }).catch((error: unknown) => {
        if (!current()) return;
        this.releasePageValues(page);
        if (this.options.maxWeight !== undefined && acceptanceVersion !== undefined && acceptanceVersion !== this.demandVersion) {
          // Superseded admission is cancellation, not a payload failure. Keep waiters
          // pending and restart only after this attempt releases its physical permit.
          if (this.demands(page.start, page.length)) restart = true;
          else this.drop(page);
          return;
        }
        page.error = this.options.maxWeight === undefined ? error : new Error('Source range admission failed');
        page.state = 'error'; page.settle(false); this.notify();
      }).finally(() => {
        if (this.running.get(channel) === page) this.running.delete(channel);
        page.channel = undefined;
        if (restart && current()) {
          page.state = 'queued';
          this.queue.push(page);
        }
        this.schedulePump();
      });
    }
  }

  private notify(): void {
    if (this.notification) return;
    const token = {};
    const generation = this.generation;
    const owner = this.host.ownerDocument;
    this.notification = token;
    queueMicrotask(() => {
      if (this.notification !== token) return;
      this.notification = undefined;
      if (this.usable() && this.generation === generation && this.host.ownerDocument === owner) this.options.onChange();
    });
  }

  adopted(): void { this.authority.adopted(); }
  hostConnected(): void {
    const reconnecting = !this.connected;
    this.connected = true;
    if (reconnecting && this.binding) {
      const requested = this.requested;
      if (requested) this.requestRange(requested.start, requested.end);
      this.notify();
    }
  }
  hostDisconnected(): void { this.connected = false; this.clear(); }
}
