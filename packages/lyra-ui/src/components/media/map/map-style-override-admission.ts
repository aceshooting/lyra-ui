import { safeValue, forbidden, MAX_NODES, MAX_TEXT } from './map-style-value.js';
export { safeValue, MAX_NODES, MAX_TEXT } from './map-style-value.js';
import type { LyraMapStyleValue } from './map-style-value.js';
export type { LyraMapStyleValue, SafeValue } from './map-style-value.js';
import { getOwnDataDescriptor, isPlainDataRecord } from '../../../internal/data-descriptors.js';
import { expandMapStyleLayerTargets, projectMapStyleLayerSelector, type LyraMapStyleLayer, type LyraMapStyleLayerSelector } from './map-interaction-options.js';

/** Paint, layout and placement overrides applied to one basemap layer (`layerId`) or to every current style
 *  layer a selector (`source`, `sourceLayer`, `layerType`) matches. */
export interface LyraMapStyleOverride extends LyraMapStyleLayerSelector {
  /** One basemap layer; give either this or at least one selector field, never both. */
  readonly layerId?: string;
  /** Place the matched basemap layers below this layer/group; null appends above all layers.
   * Omit to release placement ownership and restore the prior relative position. */
  readonly before?: string | null;
  readonly paint?: Readonly<Record<string, LyraMapStyleValue>>;
  readonly layout?: Readonly<Record<string, LyraMapStyleValue>>;
}
/** Selector matches across all entries, after which an assignment fails as a whole. */
const MAX_EXPANDED_OVERRIDES = 1024;

/** Expanded roots have their own count limit; each expression keeps the ordinary snapshot limits. */
function snapshotExpandedOverrides(input: unknown): readonly LyraMapStyleValue[] | undefined {
  try {
    if (!Array.isArray(input)) return undefined;
    const length = getOwnDataDescriptor(input, 'length');
    if (typeof length !== 'object' || typeof length.value !== 'number' || !Number.isInteger(length.value) || length.value < 0 || length.value > MAX_EXPANDED_OVERRIDES) return undefined;
    const values: LyraMapStyleValue[] = [];
    let nodes = 1, text = 0;
    for (let index = 0; index < length.value; index++) {
      const descriptor = getOwnDataDescriptor(input, String(index));
      if (typeof descriptor !== 'object') return undefined;
      const safe = safeValue(descriptor.value);
      if (!safe || safe.value === undefined) return undefined;
      nodes += safe.nodes; text += safe.text;
      if (nodes > MAX_NODES || text > MAX_TEXT) return undefined;
      values.push(safe.value);
    }
    return Object.freeze(values);
  } catch { return undefined; }
}

/** Reject an invalid assignment as a whole; never retain a truncated override expression. */
export function projectMapStyleOverrides(input: unknown, expanded = false): readonly LyraMapStyleOverride[] | undefined {
  const value = expanded ? snapshotExpandedOverrides(input) : safeValue(input)?.value;
  if (!Array.isArray(value) || value.length > (expanded ? MAX_EXPANDED_OVERRIDES : 64)) return undefined;
  const ids = new Set<string>();
  for (const entry of value) {
    if (!isPlainDataRecord(entry) || Object.keys(entry).some((key) => !['layerId', 'paint', 'layout', 'source', 'sourceLayer', 'layerType', 'before'].includes(key))) return undefined;
    const id = entry['layerId'], selector = projectMapStyleLayerSelector(entry);
    if (selector === undefined || (id === undefined ? !selector || expanded : selector)) return undefined;
    if (id !== undefined && (typeof id !== 'string' || !id.trim() || id.length > 1024 || ids.has(id))) return undefined;
    const before = entry['before'];
    if (before !== undefined && before !== null && (typeof before !== 'string' || !before.trim() || before.length > 1024)) return undefined;
    if (typeof id === 'string') ids.add(id);
    for (const kind of ['paint', 'layout']) {
      if (!Object.hasOwn(entry, kind)) continue;
      const properties = entry[kind];
      if (!isPlainDataRecord(properties) || Object.keys(properties).length > 32 ||
        Object.keys(properties).some((property) => !/^[a-z][a-z0-9-]{0,127}$/u.test(property) || forbidden(property))) return undefined;
    }
  }
  return value as unknown as readonly LyraMapStyleOverride[];
}

/** Overrides addressed by layer id: explicit ids first, then each selector's current matches. */
export function expandMapStyleOverrides(overrides: readonly LyraMapStyleOverride[], layers: readonly LyraMapStyleLayer[]): readonly LyraMapStyleOverride[] | undefined {
  const expanded = expandMapStyleLayerTargets(overrides, layers, entry => {
    const selector = projectMapStyleLayerSelector(entry);
    return typeof entry.layerId === 'string' ? { layerId: entry.layerId } : selector ? { selector } : {};
  });
  if (expanded.length > MAX_EXPANDED_OVERRIDES) return undefined;
  return Object.freeze(expanded.map(({ layerId, entry }) => Object.freeze({ layerId,
    ...(entry.before !== undefined ? { before: entry.before } : {}),
    ...(entry.paint ? { paint: entry.paint } : {}), ...(entry.layout ? { layout: entry.layout } : {}) })));
}
