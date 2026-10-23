import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';

export interface LyraMapInteractionOptions { readonly interactive?: boolean; readonly priority?: number; }
/**
 * Selects basemap style layers by their properties instead of by id. Every field given must match;
 * an empty selector matches nothing. Matching runs against `styleLayers`, the layers of the current
 * `mapStyle`, so it follows a style swap.
 */
export interface LyraMapStyleLayerSelector {
  /** The native `source` the layer reads. */
  readonly source?: string;
  /** The vector `source-layer` the layer reads, for example an OpenMapTiles `poi`. */
  readonly sourceLayer?: string;
  /** The native layer `type`, for example `symbol` or `fill`. */
  readonly layerType?: string;
}
/** One basemap layer of the current style, as reported by `styleLayers`. */
export interface LyraMapStyleLayer {
  readonly id: string;
  readonly type: string;
  readonly source?: string;
  readonly sourceLayer?: string;
}
/** One source of the current style, as reported by `styleSources`. */
export interface LyraMapStyleSource {
  readonly id: string;
  readonly type: string;
}
/** A basemap layer named by `layerId`, or every layer the selector fields match; an entry gives
 *  either `layerId` or at least one selector field, never both. Explicit ids win. */
export interface LyraMapBasemapInteraction extends LyraMapInteractionOptions, LyraMapStyleLayerSelector {
  readonly layerId?: string;
}
type CanonicalSelector = { readonly [K in keyof LyraMapStyleLayerSelector]-?: string | undefined };
const SELECTOR_KEYS = ['source', 'sourceLayer', 'layerType'] as const;

/** A canonical selector, `null` when absent, or `undefined` when invalid. */
export function projectMapStyleLayerSelector(value: object): CanonicalSelector | null | undefined {
  const selector: Record<string, string | undefined> = {};
  let present = false;
  for (const key of SELECTOR_KEYS) {
    const field = getOwnDataDescriptor(value, key);
    if (field === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
    if (field === MISSING_OWN_DATA_DESCRIPTOR || field.value === undefined) { selector[key] = undefined; continue; }
    if (typeof field.value !== 'string' || !field.value.trim() || field.value.length > 1024) return undefined;
    selector[key] = field.value; present = true;
  }
  return present ? Object.freeze(selector) as CanonicalSelector : null;
}
function matchesMapStyleLayer(selector: CanonicalSelector, layer: LyraMapStyleLayer): boolean {
  return (selector.source === undefined || selector.source === layer.source) &&
    (selector.sourceLayer === undefined || selector.sourceLayer === layer.sourceLayer) &&
    (selector.layerType === undefined || selector.layerType === layer.type);
}
/** Ids an ordered list of explicit ids and selectors names, explicit ids first, each once. */
export function expandMapStyleLayerTargets<T>(entries: readonly T[], layers: readonly LyraMapStyleLayer[],
  target: (entry: T) => { readonly layerId?: string; readonly selector?: CanonicalSelector }): { readonly layerId: string; readonly entry: T }[] {
  const result: { layerId: string; entry: T }[] = [], claimed = new Set<string>();
  for (const entry of entries) {
    const id = target(entry).layerId;
    if (id !== undefined && !claimed.has(id)) { claimed.add(id); result.push({ layerId: id, entry }); }
  }
  for (const entry of entries) {
    const selector = target(entry).selector;
    if (!selector) continue;
    for (const layer of layers) if (!claimed.has(layer.id) && matchesMapStyleLayer(selector, layer)) {
      claimed.add(layer.id); result.push({ layerId: layer.id, entry });
    }
  }
  return result;
}
export interface CanonicalMapInteraction { readonly interactive: boolean; readonly priority: number; }
const OFF = Object.freeze({ interactive: false, priority: 0 });
/** Invalid explicit interaction options cannot accidentally enable a query target. */
export function projectMapInteractionOptions(value: object): CanonicalMapInteraction {
  const enabled = getOwnDataDescriptor(value, 'interactive'), priority = getOwnDataDescriptor(value, 'priority');
  if (enabled === UNSAFE_OWN_DATA_DESCRIPTOR || priority === UNSAFE_OWN_DATA_DESCRIPTOR) return OFF;
  const interactive = enabled === MISSING_OWN_DATA_DESCRIPTOR ? undefined : enabled.value;
  const rank = priority === MISSING_OWN_DATA_DESCRIPTOR ? undefined : priority.value;
  if (interactive !== undefined && typeof interactive !== 'boolean' || rank !== undefined &&
    (typeof rank !== 'number' || !Number.isFinite(rank) || Math.abs(rank) > 1000000)) return OFF;
  return Object.freeze({ interactive: interactive !== false, priority: typeof rank === 'number' ? rank : 0 });
}
export type CanonicalMapBasemapInteraction = CanonicalMapInteraction &
  ({ readonly layerId: string; readonly selector?: undefined } | { readonly layerId?: undefined; readonly selector: CanonicalSelector });
export function projectMapBasemapInteractions(value: unknown): readonly CanonicalMapBasemapInteraction[] | undefined {
  try {
    if (value === undefined || value === null) return Object.freeze([]);
    if (!Array.isArray(value)) return undefined;
    const count = getOwnDataDescriptor(value, 'length');
    if (typeof count !== 'object' || typeof count.value !== 'number' || count.value > 4096) return undefined;
    const result: CanonicalMapBasemapInteraction[] = [], seen = new Set<string>();
    for (let index = 0; index < count.value; index++) {
      const item = getOwnDataDescriptor(value, String(index)); if (typeof item !== 'object' || !isPlainDataRecord(item.value)) return undefined;
      const id = getOwnDataDescriptor(item.value, 'layerId');
      const selector = projectMapStyleLayerSelector(item.value);
      if (selector === undefined || id === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
      if (id === MISSING_OWN_DATA_DESCRIPTOR || id.value === undefined) {
        if (!selector) return undefined;
        result.push(Object.freeze({ selector, ...projectMapInteractionOptions(item.value) }));
        continue;
      }
      if (selector || typeof id.value !== 'string' || !id.value.trim() || id.value.length > 1024 || seen.has(id.value)) return undefined;
      seen.add(id.value); result.push(Object.freeze({ layerId: id.value, ...projectMapInteractionOptions(item.value) }));
    }
    return Object.freeze(result);
  } catch { return undefined; }
}
