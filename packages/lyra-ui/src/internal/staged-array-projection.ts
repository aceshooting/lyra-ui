import { readOwnArrayLength } from './data-descriptors.js';
import { isRuntimeArray } from './object-guards.js';

/** Reads indexed positions in bounded tasks until enough projected items survive. */
export function projectArrayInBatches<T>(
  source: unknown,
  options: {
    batchSize: number;
    retain: number;
    project(value: unknown): T | undefined;
    current(): boolean;
    canSchedule(): boolean;
    onComplete(items: readonly T[]): void;
  },
): () => void {
  const array = isRuntimeArray(source) ? source : [];
  const length = readOwnArrayLength(array) ?? 0;
  const items: T[] = [];
  let cursor = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function advance(): void {
    const end = Math.min(length, cursor + options.batchSize);
    for (; cursor < end && items.length < options.retain && options.current(); cursor++) {
      try {
        const value = array[cursor];
        if (!options.current()) return;
        const item = options.project(value);
        if (item !== undefined) items.push(item);
      } catch {
        // Later positions can still be readable after an indexed getter throws.
      }
    }
    if (!options.current()) return;
    if (cursor >= length || items.length >= options.retain) options.onComplete(items);
    else if (options.canSchedule()) timer = setTimeout(advance, 0);
  }
  advance();
  return () => clearTimeout(timer);
}
