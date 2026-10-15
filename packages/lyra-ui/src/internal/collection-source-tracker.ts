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
