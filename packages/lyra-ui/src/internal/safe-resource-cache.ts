export interface ResourceCacheLease<T> {
  readonly promise: Promise<T>;
  release(): void;
}

export interface ResourceCacheAcquireOptions {
  /** When false, the load is independent and is neither deduplicated nor retained. */
  cache?: boolean;
}

type ResourceLoader<T> = (signal?: AbortSignal) => Promise<T>;
type AbortControllerConstructor = new () => AbortController;

interface ResourceCacheEntry<T> {
  readonly key: string;
  readonly promise: Promise<T>;
  readonly controller?: AbortController;
  readonly retained: boolean;
  subscribers: number;
  pending: boolean;
}

/**
 * A small LRU for already-validated resources. In-flight work is leased rather than owned by a
 * component: one subscriber can disconnect without aborting a request another subscriber still
 * needs. Rejected loads are never retained, and invalidation only affects future lookups.
 */
export class BoundedResourceCache<T> {
  private readonly entries = new Map<string, ResourceCacheEntry<T>>();
  private readonly maximumEntries: number;
  private readonly AbortControllerCtor: AbortControllerConstructor | null;

  constructor(
    maximumEntries: number,
    AbortControllerCtor: AbortControllerConstructor | null =
      typeof globalThis.AbortController === 'function' ? globalThis.AbortController : null,
  ) {
    this.maximumEntries =
      Number.isFinite(maximumEntries) && maximumEntries > 0
        ? Math.max(1, Math.floor(maximumEntries))
        : 1;
    this.AbortControllerCtor = AbortControllerCtor;
  }

  get size(): number {
    return this.entries.size;
  }

  acquire(
    key: string,
    loader: ResourceLoader<T>,
    options: ResourceCacheAcquireOptions = {},
  ): ResourceCacheLease<T> {
    const shouldCache = options.cache !== false;
    if (shouldCache) {
      const existing = this.entries.get(key);
      if (existing) {
        // Map insertion order doubles as recency order.
        this.entries.delete(key);
        this.entries.set(key, existing);
        existing.subscribers += 1;
        return this.lease(existing);
      }
    }

    const retained = shouldCache && this.reserveEntry();
    const entry = this.createEntry(key, loader, retained);
    if (retained) this.entries.set(key, entry);
    return this.lease(entry);
  }

  /** Removes a retained value from future lookups without disrupting active subscribers. */
  invalidate(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    if (entry.pending && entry.subscribers === 0) entry.controller?.abort();
  }

  /** Clears retained values. Active subscribers keep their promises and remain independently safe. */
  clear(): void {
    const entries = [...this.entries.values()];
    this.entries.clear();
    for (const entry of entries) {
      if (entry.pending && entry.subscribers === 0) entry.controller?.abort();
    }
  }

  private reserveEntry(): boolean {
    while (this.entries.size >= this.maximumEntries) {
      const settled = [...this.entries].find(([, entry]) => !entry.pending);
      if (!settled) {
        // All slots are actively loading. Start this request as no-store instead of exceeding the
        // hard bound or aborting useful work merely to make room for it.
        return false;
      }
      this.entries.delete(settled[0]);
    }
    return true;
  }

  private createEntry(
    key: string,
    loader: ResourceLoader<T>,
    retained: boolean,
  ): ResourceCacheEntry<T> {
    const controller = this.AbortControllerCtor
      ? new this.AbortControllerCtor()
      : undefined;
    let entry!: ResourceCacheEntry<T>;
    const promise = Promise.resolve()
      .then(() => loader(controller?.signal))
      .then(
        (value) => {
          entry.pending = false;
          return value;
        },
        (error: unknown) => {
          entry.pending = false;
          if (retained && this.entries.get(key) === entry) this.entries.delete(key);
          throw error;
        },
      );
    entry = {
      key,
      promise,
      controller,
      retained,
      subscribers: 1,
      pending: true,
    };
    return entry;
  }

  private lease(entry: ResourceCacheEntry<T>): ResourceCacheLease<T> {
    let released = false;
    return {
      promise: entry.promise,
      release: () => {
        if (released) return;
        released = true;
        entry.subscribers = Math.max(0, entry.subscribers - 1);
        if (!entry.pending || entry.subscribers > 0) return;
        if (entry.retained && this.entries.get(entry.key) === entry) {
          this.entries.delete(entry.key);
        }
        entry.controller?.abort();
      },
    };
  }
}
