/** Measures matching work only on a fixture's distinctly prefixed string arrays. */
export function measureArrayMembership<T>(prefix: string, operation: () => T): { value: T; comparisons: number } {
  const original = Array.prototype.includes;
  const indexOf = Array.prototype.indexOf;
  let comparisons = 0;
  Array.prototype.includes = function (this: unknown[], value: unknown, fromIndex?: number): boolean {
    const result = original.call(this, value, fromIndex);
    if (fromIndex === undefined && typeof this[0] === 'string' && this[0].startsWith(prefix)) {
      const index = indexOf.call(this, value);
      comparisons += index < 0 ? this.length : index + 1;
    }
    return result;
  };
  try {
    return { value: operation(), comparisons };
  } finally {
    Array.prototype.includes = original;
  }
}
