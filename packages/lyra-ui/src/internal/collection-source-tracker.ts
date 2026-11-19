type TrackedSource = { objects: WeakSet<object> } | { primitive: unknown };

/** Recognizes repeated collection bindings without keeping caller-owned collections alive. */
export class CollectionSourceTracker {
  private readonly sources = new Map<string, TrackedSource>();

  isRebind(name: string, value: unknown, current: unknown): boolean {
    if (value === current) return true;
    const previous = this.sources.get(name);
    if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
      if (previous && 'objects' in previous && previous.objects.has(value)) return true;
      this.sources.set(name, { objects: new WeakSet([value]) });
    } else {
      if (previous && 'primitive' in previous && previous.primitive === value) return true;
      this.sources.set(name, { primitive: value });
    }
    return false;
  }
}

/** The part of a reactive host {@link SnapshotProperty.assign} needs. */
export interface SnapshotPropertyHost {
  requestUpdate(name?: PropertyKey, oldValue?: unknown): void;
}

/**
 * Storage for a collection property whose setter publishes a normalized snapshot. Reassigning the
 * published snapshot or the same caller source (array identity, or an equal primitive) is a
 * no-op; a new source is normalized exactly once, published before `requestUpdate()` runs (so the
 * getter already returns it), and the former source is no longer retained.
 */
export class SnapshotProperty<T> {
  private value: T;
  private source: TrackedSource | undefined;

  constructor(initial: T, private readonly normalize: (input: unknown) => T) {
    this.value = initial;
  }

  /** The published snapshot. */
  read(): T {
    return this.value;
  }

  /** Normalizes and publishes `input` unless it is a rebind; returns whether it published. */
  assign(host: SnapshotPropertyHost, name: PropertyKey, input: unknown): boolean {
    if (Object.is(input, this.value) || this.isSameSource(input)) return false;
    const next = this.normalize(input);
    this.source = (typeof input === 'object' && input !== null) || typeof input === 'function'
      ? { objects: new WeakSet([input]) }
      : { primitive: input };
    const previous = this.value;
    this.value = next;
    host.requestUpdate(name, previous);
    return true;
  }

  private isSameSource(input: unknown): boolean {
    const source = this.source;
    if (!source) return false;
    if ((typeof input === 'object' && input !== null) || typeof input === 'function') {
      return 'objects' in source && source.objects.has(input);
    }
    return 'primitive' in source && Object.is(source.primitive, input);
  }
}
