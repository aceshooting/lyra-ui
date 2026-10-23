import { snapshotPublicCollection } from '../../../internal/collection-snapshot.js';
import { isPlainDataRecord } from '../../../internal/data-descriptors.js';

export type LyraMapStyleValue = null | boolean | number | string | readonly LyraMapStyleValue[] | { readonly [key: string]: LyraMapStyleValue };
export const MAX_NODES = 8192;
export const MAX_TEXT = 1024 * 1024;
export const forbidden = (key: string) => key === '__proto__' || key === 'prototype' || key === 'constructor';
export interface SafeValue { readonly value: LyraMapStyleValue | undefined; readonly key: string; readonly nodes: number; readonly text: number; }

/** Strict bounded plain-data snapshot; shared collection truncation is always a rejection here. */
export function safeValue(input: unknown, absent = false): SafeValue | undefined {
  if (absent && input === undefined) return { value: undefined, key: 'undefined', nodes: 1, text: 0 };
  let unsafe = false;
  const value = snapshotPublicCollection(input, undefined, {
    limits: { entries: 256, nodes: MAX_NODES, depth: 12 },
    recordKey: (key) => { if (forbidden(key)) { unsafe = true; return 'omit'; } return 'copy'; },
    onResult: (result) => { unsafe ||= result.invalid || result.truncated; },
  });
  if (unsafe) return undefined;
  let nodes = 0; let text = 0;
  const visiting = new WeakSet<object>();
  const valid = (entry: unknown): boolean => {
    if (++nodes > MAX_NODES) return false;
    if (typeof entry === 'string') { text += entry.length; return entry.length <= 4096 && text <= MAX_TEXT; }
    if (entry === null || typeof entry === 'boolean') return true;
    if (typeof entry === 'number') return Number.isFinite(entry);
    if (typeof entry !== 'object' || visiting.has(entry)) return false;
    visiting.add(entry);
    let accepted = true;
    if (Array.isArray(entry)) {
      for (let index = 0; index < entry.length; index += 1) if (!Object.hasOwn(entry, index) || !valid(entry[index])) { accepted = false; break; }
    } else if (isPlainDataRecord(entry)) {
      for (const key of Object.keys(entry)) {
        text += key.length;
        if (forbidden(key) || key.length > 4096 || text > MAX_TEXT || !valid(entry[key])) { accepted = false; break; }
      }
    } else accepted = false;
    visiting.delete(entry);
    return accepted;
  };
  if (!valid(value)) return undefined;
  const key = JSON.stringify(value);
  return typeof key === 'string' ? { value: value as LyraMapStyleValue, key, nodes, text } : undefined;
}
