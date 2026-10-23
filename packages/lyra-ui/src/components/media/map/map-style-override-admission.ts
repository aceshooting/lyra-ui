import { snapshotPublicCollection } from '../../../internal/collection-snapshot.js';
import { isPlainDataRecord } from '../../../internal/data-descriptors.js';
import { expandMapStyleLayerTargets, projectMapStyleLayerSelector, type LyraMapStyleLayer, type LyraMapStyleLayerSelector } from './map-interaction-options.js';

export type LyraMapStyleValue = null | boolean | number | string | readonly LyraMapStyleValue[] | { readonly [key: string]: LyraMapStyleValue };
/** Paint and layout values applied to one basemap layer (`layerId`) or to every current style
 *  layer a selector (`source`, `sourceLayer`, `layerType`) matches. */
export interface LyraMapStyleOverride extends LyraMapStyleLayerSelector {
  /** One basemap layer; give either this or at least one selector field, never both. */
  readonly layerId?: string;
  readonly paint?: Readonly<Record<string, LyraMapStyleValue>>;
  readonly layout?: Readonly<Record<string, LyraMapStyleValue>>;
}
/** Selector matches across all entries, after which an assignment fails as a whole. */
const MAX_EXPANDED_OVERRIDES = 1024;
export const MAX_NODES = 8192;
export const MAX_TEXT = 1024 * 1024;
const forbidden = (key: string) => key === '__proto__' || key === 'prototype' || key === 'constructor';
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

/** Reject an invalid assignment as a whole; never retain a truncated override expression. */
export function projectMapStyleOverrides(input: unknown, expanded = false): readonly LyraMapStyleOverride[] | undefined {
  const safe = safeValue(input);
  if (!safe || !Array.isArray(safe.value) || safe.value.length > (expanded ? MAX_EXPANDED_OVERRIDES : 64)) return undefined;
  const ids = new Set<string>();
  for (const entry of safe.value) {
    if (!isPlainDataRecord(entry) || Object.keys(entry).some((key) => !['layerId', 'paint', 'layout', 'source', 'sourceLayer', 'layerType'].includes(key))) return undefined;
    const id = entry['layerId'], selector = projectMapStyleLayerSelector(entry);
    if (selector === undefined || (id === undefined ? !selector || expanded : selector)) return undefined;
    if (id !== undefined && (typeof id !== 'string' || !id.trim() || id.length > 1024 || ids.has(id))) return undefined;
    if (typeof id === 'string') ids.add(id);
    for (const kind of ['paint', 'layout']) {
      if (!Object.hasOwn(entry, kind)) continue;
      const properties = entry[kind];
      if (!isPlainDataRecord(properties) || Object.keys(properties).length > 32 ||
        Object.keys(properties).some((property) => !/^[a-z][a-z0-9-]{0,127}$/u.test(property) || forbidden(property))) return undefined;
    }
  }
  return safe.value as unknown as readonly LyraMapStyleOverride[];
}

/** Overrides addressed by layer id: explicit ids first, then each selector's current matches. */
export function expandMapStyleOverrides(overrides: readonly LyraMapStyleOverride[], layers: readonly LyraMapStyleLayer[]): readonly LyraMapStyleOverride[] | undefined {
  const expanded = expandMapStyleLayerTargets(overrides, layers, entry => {
    const selector = projectMapStyleLayerSelector(entry);
    return typeof entry.layerId === 'string' ? { layerId: entry.layerId } : selector ? { selector } : {};
  });
  if (expanded.length > MAX_EXPANDED_OVERRIDES) return undefined;
  return Object.freeze(expanded.map(({ layerId, entry }) => Object.freeze({ layerId,
    ...(entry.paint ? { paint: entry.paint } : {}), ...(entry.layout ? { layout: entry.layout } : {}) })));
}
