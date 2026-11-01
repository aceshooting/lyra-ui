import { invalidPlacement, ownData } from './model-placement.js';
import type { SceneAllocation, SceneResourceLedger } from './types.js';

/** Accounts declared physical allocations, including shared backing, rather than process heap usage. */
export function createSceneResourceLedger(options: { readonly bytes: number }): SceneResourceLedger {
  const cap = ownData(options, 'bytes');
  if (typeof cap !== 'number' || !Number.isSafeInteger(cap) || cap < 0) return invalidPlacement();
  const live = new Map<string, { bytes: number; references: number }>();
  let total = 0;
  return Object.freeze({
    get bytes() { return total; },
    reserve(owner: string, allocations: readonly SceneAllocation[]) {
      if (typeof owner !== 'string' || !owner || !Array.isArray(allocations) || allocations.length > 100000) return invalidPlacement();
      const staged = new Map<string, number>();
      let increase = 0;
      for (let index = 0; index < allocations.length; index++) {
        const entry = ownData(allocations, String(index));
        const key = ownData(entry, 'key'), bytes = ownData(entry, 'bytes');
        if (typeof key !== 'string' || !key || key.length > 1024 || typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) return invalidPlacement();
        const previous = staged.get(key) ?? live.get(key)?.bytes;
        if (previous !== undefined && previous !== bytes) return invalidPlacement();
        if (!staged.has(key) && !live.has(key)) increase += bytes;
        if (!Number.isSafeInteger(increase) || increase > cap - total) return invalidPlacement();
        staged.set(key, bytes);
      }
      for (const [key, bytes] of staged) {
        const prior = live.get(key);
        if (prior) prior.references++;
        else live.set(key, { bytes, references: 1 });
      }
      total += increase;
      let released = false;
      return Object.freeze({ release() {
        if (released) return;
        released = true;
        for (const key of staged.keys()) {
          const entry = live.get(key);
          if (!entry) continue;
          if (--entry.references === 0) { total -= entry.bytes; live.delete(key); }
        }
      } });
    }
  });
}
