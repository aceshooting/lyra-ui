/** Counts actual indexed reads made by native membership probes on selected fixture arrays.
 * The instrumentation exists only during one synchronous, attributed component operation. */
export function measureArrayProbeReads<T>(
  owns: (array: readonly unknown[], value: unknown) => boolean,
  operation: () => T,
): { value: T; reads: number } {
  const includes = Array.prototype.includes;
  const indexOf = Array.prototype.indexOf;
  let reads = 0;
  function receiver(array: unknown[], value: unknown): unknown[] {
    if (!owns(array, value)) return array;
    return new Proxy(array, {
      get(target, key, proxy) {
        if (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) reads += 1;
        return Reflect.get(target, key, proxy);
      },
    });
  }
  Array.prototype.includes = function (this: unknown[], value: unknown, fromIndex?: number): boolean {
    return includes.call(receiver(this, value), value, fromIndex);
  };
  Array.prototype.indexOf = function (this: unknown[], value: unknown, fromIndex?: number): number {
    return indexOf.call(receiver(this, value), value, fromIndex);
  };
  try {
    return { value: operation(), reads };
  } finally {
    Array.prototype.includes = includes;
    Array.prototype.indexOf = indexOf;
  }
}
