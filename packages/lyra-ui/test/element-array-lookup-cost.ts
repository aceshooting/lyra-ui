/** Counts identity comparisons on dense fixture-owned element arrays during one synchronous pass. */
export function measureElementArrayLookups(elements: readonly Element[], operation: () => void): number {
  const owned = new Set(elements);
  const includes = Array.prototype.includes;
  const indexOf = Array.prototype.indexOf;
  let comparisons = 0;
  const count = (array: unknown[], index: number, fromIndex: number | undefined) => {
    if (fromIndex === undefined && owned.has(array[0] as Element)) {
      comparisons += index < 0 ? array.length : index + 1;
    }
  };
  Array.prototype.includes = function (this: unknown[], value: unknown, fromIndex?: number): boolean {
    const result = includes.call(this, value, fromIndex);
    if (fromIndex === undefined && owned.has(this[0] as Element)) count(this, indexOf.call(this, value), fromIndex);
    return result;
  };
  Array.prototype.indexOf = function (this: unknown[], value: unknown, fromIndex?: number): number {
    const result = indexOf.call(this, value, fromIndex);
    count(this, result, fromIndex);
    return result;
  };
  try { operation(); return comparisons; }
  finally { Array.prototype.includes = includes; Array.prototype.indexOf = indexOf; }
}
