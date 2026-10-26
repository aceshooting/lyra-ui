import { resolveLimits, snapshotJson } from '../schema.js';
import type { JsonObject, JsonPrimitive, JsonValue, LyraGenLimits, LyraGenResult } from '../types.js';

/** Protocol state retains deleted array entries and gaps without inventing JSON null values. */
export type A2uiDataValue = JsonPrimitive | undefined | readonly A2uiDataValue[] | A2uiDataObject;
export interface A2uiDataObject { readonly [key: string]: A2uiDataValue }
export interface A2uiDataSnapshot {
  readonly data: A2uiDataValue;
  /** JSON transport projection: undefined object members disappear and array entries become null. */
  readonly json: JsonValue | undefined;
}

/** Own, bound and freeze protocol state while retaining the distinction between holes and undefined. */
export function snapshotA2uiData(input: unknown, overrides?: Partial<LyraGenLimits>): LyraGenResult<A2uiDataSnapshot> {
  const limits = resolveLimits(overrides); const active = new WeakSet<object>(); let nodes = 0; let bytes = 0;
  const encoder = new TextEncoder();
  const countBytes = (amount: number): void => { bytes += amount; if (bytes > limits.maxBytes) throw new Error('Protocol state exceeds its byte budget.'); };
  const visit = (value: unknown, depth: number): A2uiDataSnapshot => {
    if (++nodes > limits.maxNodes || depth > limits.maxDepth) throw new Error('Protocol state exceeds its structural budget.');
    if (value === undefined) { countBytes(4); return { data: undefined, json: undefined }; }
    if (value === null || typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Protocol numbers must be finite.');
      if (typeof value === 'string' && value.length > limits.maxStringLength) throw new Error('Protocol string exceeds its character budget.');
      countBytes(encoder.encode(JSON.stringify(value)).byteLength);
      return { data: value, json: value };
    }
    if (typeof value !== 'object' || active.has(value)) throw new Error('Protocol state must be an acyclic data tree.');
    const array = Array.isArray(value); const prototype: unknown = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error('Protocol state must use plain containers.');
    active.add(value);
    if (array) {
      if (value.length > limits.maxArrayLength) throw new Error('Protocol array exceeds its item budget.');
      const keys = Reflect.ownKeys(value);
      if (keys.some(key => key !== 'length' && (typeof key !== 'string' || !/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw new Error('Protocol arrays cannot carry additional properties.');
      countBytes(2 + Math.max(0, value.length - 1));
      const data: A2uiDataValue[] = new Array(value.length); const json: JsonValue[] = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor) {
          if (++nodes > limits.maxNodes) throw new Error('Protocol state exceeds its value budget.');
          countBytes(4); json.push(null); continue;
        }
        if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('Protocol accessors are not permitted.');
        const child = visit(descriptor.value, depth + 1); data[index] = child.data; json.push(child.json ?? null);
      }
      active.delete(value); return { data: Object.freeze(data), json: Object.freeze(json) };
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > limits.maxObjectKeys) throw new Error('Protocol object exceeds its key budget.');
    countBytes(2 + Math.max(0, keys.length - 1));
    const data: Record<string, A2uiDataValue> = {}; const json: Record<string, JsonValue> = {};
    for (const key of keys) {
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) || key.length > limits.maxStringLength) throw new Error('Unsafe protocol object key.');
      countBytes(encoder.encode(JSON.stringify(key)).byteLength + 1);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('Protocol accessors are not permitted.');
      const child = visit(descriptor.value, depth + 1); data[key] = child.data;
      if (child.json !== undefined) json[key] = child.json;
    }
    active.delete(value); return { data: Object.freeze(data), json: Object.freeze(json) as JsonObject };
  };
  try {
    const result = visit(input, 0);
    if (result.json !== undefined) {
      const admitted = snapshotJson(result.json, limits);
      if (!admitted.ok) return admitted;
    }
    return { ok: true, value: result, diagnostics: [] };
  } catch {
    return { ok: false, diagnostics: [{ code: 'a2ui-data', path: '', message: 'Protocol state is invalid or exceeds its configured limits.', severity: 'error' }] };
  }
}
